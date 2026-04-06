const fs = require('fs');
const path = require('path');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeFile(filepath, content) {
    try {
        ensureDir(path.dirname(filepath));
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✓ ${filepath.replace(process.cwd() + path.sep, '')}`);
    } catch (e) {}
}

console.log('☸️  GENERATING KUBERNETES MANIFESTS\n');

// Namespace
writeFile('k8s/base/namespace.yaml', `apiVersion: v1
kind: Namespace
metadata:
  name: nexusgate
`);

// ConfigMap
writeFile('k8s/base/configmap.yaml', `apiVersion: v1
kind: ConfigMap
metadata:
  name: nexusgate-config
  namespace: nexusgate
data:
  POSTGRES_HOST: "postgres"
  POSTGRES_PORT: "5432"
  POSTGRES_USER: "nexusgate"
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  KAFKA_BROKERS: "kafka:9092"
  CONSUL_HOST: "consul"
  CONSUL_PORT: "8500"
  NODE_ENV: "production"
`);

// Secrets
writeFile('k8s/base/secrets.yaml', `apiVersion: v1
kind: Secret
metadata:
  name: nexusgate-secrets
  namespace: nexusgate
type: Opaque
stringData:
  POSTGRES_PASSWORD: "nexusgate_secret"
  JWT_ISSUER: "nexusgate-auth"
`);

// Auth Service Deployment
writeFile('k8s/base/auth-service-deployment.yaml', `apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: nexusgate
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: nexusgate/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        - name: POSTGRES_DB
          value: "auth_db"
        envFrom:
        - configMapRef:
            name: nexusgate-config
        - secretRef:
            name: nexusgate-secrets
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: nexusgate
spec:
  selector:
    app: auth-service
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
`);

// Gateway Deployment
writeFile('k8s/base/gateway-deployment.yaml', `apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
  namespace: nexusgate
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
    spec:
      containers:
      - name: gateway
        image: nexusgate/gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: PORT
          value: "8080"
        - name: AUTH_SERVICE_URL
          value: "http://auth-service:3001"
        - name: USER_SERVICE_URL
          value: "http://user-service:3002"
        - name: ORDER_SERVICE_URL
          value: "http://order-service:3003"
        envFrom:
        - configMapRef:
            name: nexusgate-config
        - secretRef:
            name: nexusgate-secrets
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: gateway
  namespace: nexusgate
spec:
  selector:
    app: gateway
  ports:
  - port: 8080
    targetPort: 8080
  type: LoadBalancer
`);

// Ingress
writeFile('k8s/base/ingress.yaml', `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nexusgate-ingress
  namespace: nexusgate
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: nexusgate.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway
            port:
              number: 8080
`);

// Kustomization
writeFile('k8s/base/kustomization.yaml', `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - configmap.yaml
  - secrets.yaml
  - auth-service-deployment.yaml
  - gateway-deployment.yaml
  - ingress.yaml

commonLabels:
  app.kubernetes.io/name: nexusgate
  app.kubernetes.io/version: "1.0.0"
`);

// Dev Overlay
writeFile('k8s/overlays/dev/kustomization.yaml', `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

replicas:
  - name: auth-service
    count: 1
  - name: gateway
    count: 1

commonLabels:
  environment: dev
`);

// Prod Overlay
writeFile('k8s/overlays/prod/kustomization.yaml', `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

replicas:
  - name: auth-service
    count: 3
  - name: gateway
    count: 3

commonLabels:
  environment: prod
`);

console.log('\n✅ Kubernetes Manifests Complete!');
console.log('\nDeploy with:');
console.log('  kubectl apply -k k8s/overlays/dev/');
console.log('  kubectl apply -k k8s/overlays/prod/\n');
`);
