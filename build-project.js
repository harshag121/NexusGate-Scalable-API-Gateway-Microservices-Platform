const fs = require('fs');
const path = require('path');

// Ensure directory exists
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Write file with directory creation
function writeFile(filepath, content) {
    const dir = path.dirname(filepath);
    ensureDir(dir);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✓ Created: ${filepath}`);
}

console.log('🚀 Building NexusGate Project Structure...\n');

// Create all necessary directories
const dirs = [
    'services/gateway/src/middleware',
    'services/gateway/src/routes',
    'services/gateway/src/config',
    'services/auth-service/src/controllers',
    'services/auth-service/src/routes',
    'services/auth-service/src/models',
    'services/auth-service/src/services',
    'services/auth-service/src/config',
    'services/user-service/src/controllers',
    'services/user-service/src/routes',
    'services/user-service/src/models',
    'services/user-service/src/config',
    'services/order-service/src/controllers',
    'services/order-service/src/routes',
    'services/order-service/src/models',
    'services/order-service/src/consumers',
    'services/order-service/src/config',
    'services/notification-service/src/consumers',
    'services/notification-service/src/config',
    'shared/logger',
    'shared/metrics',
    'shared/kafka',
    'shared/consul',
    'shared/jwt',
    'shared/middleware',
    'infrastructure/postgres/init-scripts',
    'infrastructure/kafka',
    'infrastructure/consul/config',
    'infrastructure/prometheus',
    'infrastructure/grafana/dashboards',
    'infrastructure/grafana/provisioning/dashboards',
    'infrastructure/grafana/provisioning/datasources',
    'infrastructure/loki',
    'k8s/base',
    'k8s/overlays/dev',
    'k8s/overlays/prod',
    'scripts',
    'docs',
    'tests/integration',
    'tests/load',
    'keys'
];

console.log('📁 Creating directories...');
dirs.forEach(dir => {
    ensureDir(dir);
});
console.log(`✓ Created ${dirs.length} directories\n`);

// ============================================================
// INFRASTRUCTURE FILES
// ============================================================

console.log('🏗️  Creating infrastructure files...\n');

// PostgreSQL init script for multiple databases
writeFile('infrastructure/postgres/init-scripts/01-create-databases.sh', `#!/bin/bash
# PostgreSQL Multiple Database Initialization Script

set -e
set -u

function create_user_and_database() {
    local database=$1
    echo "Creating database '$database'"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE DATABASE $database;
        GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_user_and_database $db
    done
    echo "Multiple databases created"
fi
`);

// PostgreSQL schema
writeFile('infrastructure/postgres/init-scripts/02-create-schemas.sql', `-- ============================================================
-- AUTH DATABASE SCHEMA
-- ============================================================

\\c auth_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- USER DATABASE SCHEMA
-- ============================================================

\\c user_db;

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    avatar_url TEXT,
    bio TEXT,
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_email ON user_profiles(email);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ORDER DATABASE SCHEMA
-- ============================================================

\\c order_db;

CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status order_status DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    shipping_address JSONB,
    billing_address JSONB,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`);

// Prometheus configuration
writeFile('infrastructure/prometheus/prometheus.yml', `global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'nexusgate'
    environment: 'production'

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'api-gateway'
    static_configs:
      - targets: ['gateway:8080']
    metrics_path: '/metrics'

  - job_name: 'auth-service'
    static_configs:
      - targets: ['auth-service:3001']
    metrics_path: '/metrics'

  - job_name: 'user-service'
    static_configs:
      - targets: ['user-service:3002']
    metrics_path: '/metrics'

  - job_name: 'order-service'
    static_configs:
      - targets: ['order-service:3003']
    metrics_path: '/metrics'

  - job_name: 'notification-service'
    static_configs:
      - targets: ['notification-service:3004']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: []
`);

// Grafana datasource provisioning
writeFile('infrastructure/grafana/provisioning/datasources/datasources.yml', `apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true

  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
    editable: true
`);

// Grafana dashboard provisioning
writeFile('infrastructure/grafana/provisioning/dashboards/dashboards.yml', `apiVersion: 1

providers:
  - name: 'NexusGate Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
`);

// Loki configuration
writeFile('infrastructure/loki/loki-config.yml', `auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-05-15
      store: boltdb
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 168h

storage_config:
  boltdb:
    directory: /loki/index

  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
`);

// Promtail configuration
writeFile('infrastructure/loki/promtail-config.yml', `server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          __path__: /var/log/*log
`);

console.log('✅ Infrastructure files created!\n');

// ============================================================
// SHARED LIBRARIES
// ============================================================

console.log('📦 Creating shared libraries...\n');

// Shared Logger
writeFile('shared/logger/index.js', `const pino = require('pino');

function createLogger(serviceName, options = {}) {
    const logger = pino({
        name: serviceName,
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
            level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
            service: serviceName,
            env: process.env.NODE_ENV || 'development',
        },
        ...options,
    });
    return logger;
}

function requestLogger(logger) {
    return (req, res, next) => {
        const startTime = Date.now();
        const correlationId = req.headers['x-correlation-id'] || 
                              req.headers['x-request-id'] || 
                              \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
        
        req.correlationId = correlationId;
        req.log = logger.child({ 
            correlationId,
            traceId: req.headers['x-trace-id'],
            spanId: req.headers['x-span-id']
        });

        req.log.info({
            type: 'request',
            method: req.method,
            url: req.url,
            ip: req.ip || req.connection.remoteAddress,
        }, 'Incoming request');

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const logLevel = res.statusCode >= 400 ? 'error' : 'info';
            req.log[logLevel]({
                type: 'response',
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                duration,
            }, 'Request completed');
        });

        next();
    };
}

module.exports = { createLogger, requestLogger };
`);

writeFile('shared/logger/package.json', JSON.stringify({
    name: '@nexusgate/logger',
    version: '1.0.0',
    description: 'Shared logging utilities',
    main: 'index.js',
    dependencies: {
        pino: '^8.16.0'
    }
}, null, 2));

// Shared Metrics
writeFile('shared/metrics/index.js', `const promClient = require('prom-client');

const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    registers: [register],
});

const httpRequestTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

const circuitBreakerState = new promClient.Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['service'],
    registers: [register],
});

function metricsMiddleware() {
    return (req, res, next) => {
        const start = Date.now();
        
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            const route = req.route ? req.route.path : req.path;
            
            httpRequestDuration.observe({
                method: req.method,
                route,
                status_code: res.statusCode,
            }, duration);
            
            httpRequestTotal.inc({
                method: req.method,
                route,
                status_code: res.statusCode,
            });
        });
        
        next();
    };
}

function getMetricsHandler() {
    return async (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    };
}

module.exports = {
    register,
    httpRequestDuration,
    httpRequestTotal,
    circuitBreakerState,
    metricsMiddleware,
    getMetricsHandler,
};
`);

writeFile('shared/metrics/package.json', JSON.stringify({
    name: '@nexusgate/metrics',
    version: '1.0.0',
    description: 'Prometheus metrics utilities',
    main: 'index.js',
    dependencies: {
        'prom-client': '^15.0.0'
    }
}, null, 2));

// Shared JWT Utilities
writeFile('shared/jwt/index.js', `const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

class JWTService {
    constructor(options = {}) {
        this.algorithm = options.algorithm || 'RS256';
        this.issuer = options.issuer || 'nexusgate';
        this.accessTokenTTL = options.accessTokenTTL || '15m';
        this.refreshTokenTTL = options.refreshTokenTTL || '7d';
        
        this.privateKeyPath = options.privateKeyPath || path.join(__dirname, '../../keys/private.pem');
        this.publicKeyPath = options.publicKeyPath || path.join(__dirname, '../../keys/public.pem');
        
        this.loadKeys();
    }

    loadKeys() {
        try {
            if (fs.existsSync(this.privateKeyPath)) {
                this.privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');
            }
            if (fs.existsSync(this.publicKeyPath)) {
                this.publicKey = fs.readFileSync(this.publicKeyPath, 'utf8');
            }
        } catch (error) {
            console.error('Failed to load JWT keys:', error.message);
        }
    }

    generateAccessToken(payload) {
        return jwt.sign(payload, this.privateKey, {
            algorithm: this.algorithm,
            issuer: this.issuer,
            expiresIn: this.accessTokenTTL,
        });
    }

    generateRefreshToken(payload) {
        return jwt.sign(payload, this.privateKey, {
            algorithm: this.algorithm,
            issuer: this.issuer,
            expiresIn: this.refreshTokenTTL,
        });
    }

    verifyToken(token) {
        return jwt.verify(token, this.publicKey, {
            algorithms: [this.algorithm],
            issuer: this.issuer,
        });
    }

    decodeToken(token) {
        return jwt.decode(token, { complete: true });
    }
}

module.exports = JWTService;
`);

writeFile('shared/jwt/package.json', JSON.stringify({
    name: '@nexusgate/jwt',
    version: '1.0.0',
    description: 'JWT utilities for authentication',
    main: 'index.js',
    dependencies: {
        jsonwebtoken: '^9.0.2'
    }
}, null, 2));

// Shared Kafka Client
writeFile('shared/kafka/index.js', `const { Kafka, logLevel } = require('kafkajs');

class KafkaClient {
    constructor(options = {}) {
        this.brokers = options.brokers || (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
        this.clientId = options.clientId || process.env.KAFKA_CLIENT_ID || 'nexusgate';
        this.groupId = options.groupId || process.env.KAFKA_GROUP_ID || 'nexusgate-services';
        
        this.kafka = new Kafka({
            clientId: this.clientId,
            brokers: this.brokers,
            logLevel: logLevel.ERROR,
            retry: {
                retries: parseInt(process.env.KAFKA_RETRY_ATTEMPTS || '5'),
                initialRetryTime: parseInt(process.env.KAFKA_RETRY_BACKOFF_MS || '300'),
            },
        });

        this.producer = null;
        this.consumer = null;
    }

    async getProducer() {
        if (!this.producer) {
            this.producer = this.kafka.producer({
                allowAutoTopicCreation: true,
                transactionTimeout: 30000,
            });
            await this.producer.connect();
        }
        return this.producer;
    }

    async getConsumer() {
        if (!this.consumer) {
            this.consumer = this.kafka.consumer({
                groupId: this.groupId,
                sessionTimeout: 30000,
                heartbeatInterval: 3000,
            });
            await this.consumer.connect();
        }
        return this.consumer;
    }

    async publishEvent(topic, event) {
        const producer = await this.getProducer();
        await producer.send({
            topic,
            messages: [{
                key: event.eventId || Date.now().toString(),
                value: JSON.stringify(event),
                headers: {
                    'event-type': event.eventType,
                    'timestamp': Date.now().toString(),
                },
            }],
        });
    }

    async subscribe(topics, handler) {
        const consumer = await this.getConsumer();
        await consumer.subscribe({ topics, fromBeginning: false });
        
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const event = JSON.parse(message.value.toString());
                await handler(event, topic, partition);
            },
        });
    }

    async disconnect() {
        if (this.producer) await this.producer.disconnect();
        if (this.consumer) await this.consumer.disconnect();
    }
}

module.exports = KafkaClient;
`);

writeFile('shared/kafka/package.json', JSON.stringify({
    name: '@nexusgate/kafka',
    version: '1.0.0',
    description: 'Kafka client utilities',
    main: 'index.js',
    dependencies: {
        kafkajs: '^2.2.4'
    }
}, null, 2));

// Shared Consul Client
writeFile('shared/consul/index.js', `const Consul = require('consul');

class ConsulClient {
    constructor(options = {}) {
        this.consul = new Consul({
            host: options.host || process.env.CONSUL_HOST || 'localhost',
            port: options.port || process.env.CONSUL_PORT || '8500',
            promisify: true,
        });
        
        this.serviceId = null;
        this.serviceName = null;
    }

    async registerService(config) {
        const {
            name,
            port,
            address = 'localhost',
            tags = [],
            check = {},
        } = config;

        this.serviceName = name;
        this.serviceId = \`\${name}-\${port}\`;

        const registration = {
            id: this.serviceId,
            name,
            address,
            port,
            tags,
            check: {
                http: \`http://\${address}:\${port}/health\`,
                interval: check.interval || '10s',
                timeout: check.timeout || '5s',
                deregisterCriticalServiceAfter: check.deregisterAfter || '1m',
                ...check,
            },
        };

        await this.consul.agent.service.register(registration);
        console.log(\`Service \${this.serviceId} registered with Consul\`);
        
        process.on('SIGTERM', () => this.deregister());
        process.on('SIGINT', () => this.deregister());
    }

    async deregister() {
        if (this.serviceId) {
            await this.consul.agent.service.deregister(this.serviceId);
            console.log(\`Service \${this.serviceId} deregistered from Consul\`);
        }
    }

    async getService(serviceName) {
        const services = await this.consul.health.service({
            service: serviceName,
            passing: true,
        });
        
        if (services && services.length > 0) {
            const service = services[Math.floor(Math.random() * services.length)];
            return {
                address: service.Service.Address,
                port: service.Service.Port,
            };
        }
        
        throw new Error(\`Service \${serviceName} not found\`);
    }
}

module.exports = ConsulClient;
`);

writeFile('shared/consul/package.json', JSON.stringify({
    name: '@nexusgate/consul',
    version: '1.0.0',
    description: 'Consul service discovery client',
    main: 'index.js',
    dependencies: {
        consul: '^1.1.0'
    }
}, null, 2));

// Shared Middleware
writeFile('shared/middleware/error-handler.js', `function errorHandler(logger) {
    return (err, req, res, next) => {
        const correlationId = req.correlationId || 'unknown';
        
        const statusCode = err.statusCode || err.status || 500;
        const message = err.message || 'Internal Server Error';
        
        logger.error({
            correlationId,
            error: {
                message: err.message,
                stack: err.stack,
                statusCode,
            },
            request: {
                method: req.method,
                url: req.url,
            },
        }, 'Request error');

        res.status(statusCode).json({
            error: {
                message,
                correlationId,
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
            },
        });
    };
}

module.exports = errorHandler;
`);

writeFile('shared/middleware/validation.js', `const Joi = require('joi');

function validate(schema, property = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            return res.status(400).json({
                error: {
                    message: 'Validation failed',
                    details: errors,
                },
            });
        }

        req[property] = value;
        next();
    };
}

module.exports = { validate, Joi };
`);

writeFile('shared/middleware/package.json', JSON.stringify({
    name: '@nexusgate/middleware',
    version: '1.0.0',
    description: 'Shared middleware utilities',
    main: 'error-handler.js',
    dependencies: {
        joi: '^17.11.0'
    }
}, null, 2));

console.log('✅ Shared libraries created!\n');
console.log('Build script completed successfully!');
console.log('\n🎉 NexusGate project structure is ready!');
console.log('Next steps:');
console.log('1. Review the generated files');
console.log('2. Install dependencies in each service');
console.log('3. Generate JWT keys with: node scripts/generate-keys.js');
console.log('4. Start with: docker-compose up -d');
