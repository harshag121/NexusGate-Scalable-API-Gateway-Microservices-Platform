const fs = require('fs');
const path = require('path');

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
    'tests/load'
];

console.log('Creating directory structure...');
dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    fs.mkdirSync(fullPath, { recursive: true });
});

console.log('✓ Successfully created all directories');
console.log(`Total directories: ${dirs.length}`);
