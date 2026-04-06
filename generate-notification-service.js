const fs = require('fs');
const path = require('path');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeFile(filepath, content) {
    try {
        ensureDir(path.dirname(filepath));
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✓ ${filepath.replace(process.cwd() + path.sep, '')}`);
    } catch (e) {
        console.error(`✗ ${filepath}: ${e.message}`);
    }
}

console.log('🚀 GENERATING NOTIFICATION SERVICE\n');

// Notification Service - Server
writeFile('services/notification-service/src/server.js', `require('dotenv').config();
const express = require('express');
const { createLogger } = require('../../../shared/logger');
const { metricsMiddleware, getMetricsHandler } = require('../../../shared/metrics');
const { registerWithConsul } = require('./config/consul');
const { startUserEventsConsumer } = require('./consumers/user-events.consumer');
const { startOrderEventsConsumer } = require('./consumers/order-events.consumer');

const app = express();
const PORT = process.env.PORT || 3004;
const SERVICE_NAME = 'notification-service';
const logger = createLogger(SERVICE_NAME);

app.use(metricsMiddleware());

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: SERVICE_NAME });
});

app.get('/metrics', getMetricsHandler());

async function start() {
    try {
        await startUserEventsConsumer(logger);
        await startOrderEventsConsumer(logger);
        logger.info('Kafka consumers started');

        app.listen(PORT, async () => {
            logger.info(\`\${SERVICE_NAME} listening on port \${PORT}\`);
            await registerWithConsul(SERVICE_NAME, PORT);
        });
    } catch (error) {
        logger.error({ error }, 'Failed to start service');
        process.exit(1);
    }
}

start();
`);

writeFile('services/notification-service/src/config/kafka.js', `const { Kafka } = require('kafkajs');

let kafka;

function getKafka() {
    if (!kafka) {
        kafka = new Kafka({
            clientId: 'notification-service',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        });
    }
    return kafka;
}

module.exports = { getKafka };
`);

writeFile('services/notification-service/src/config/consul.js', `const Consul = require('consul');

async function registerWithConsul(serviceName, port) {
    const consul = new Consul({
        host: process.env.CONSUL_HOST || 'localhost',
        port: process.env.CONSUL_PORT || '8500',
        promisify: true,
    });
    
    const serviceId = \`\${serviceName}-\${port}\`;
    await consul.agent.service.register({
        id: serviceId,
        name: serviceName,
        address: 'localhost',
        port,
        check: { http: \`http://localhost:\${port}/health\`, interval: '10s' },
    });
}

module.exports = { registerWithConsul };
`);

writeFile('services/notification-service/src/consumers/user-events.consumer.js', `const { getKafka } = require('../config/kafka');

async function sendEmail(to, subject, body) {
    console.log(\`📧 Sending email to \${to}: \${subject}\`);
    // Simulate email sending
}

async function startUserEventsConsumer(logger) {
    const kafka = getKafka();
    const consumer = kafka.consumer({ groupId: 'notification-service-group' });
    
    await consumer.connect();
    await consumer.subscribe({ topic: 'user.events', fromBeginning: false });
    
    await consumer.run({
        eachMessage: async ({ message }) => {
            const event = JSON.parse(message.value.toString());
            
            logger.info({ event: event.eventType }, 'Processing user event');
            
            switch (event.eventType) {
                case 'user.created':
                    await sendEmail(
                        event.data.email,
                        'Welcome to NexusGate!',
                        \`Hello \${event.data.firstName}, welcome to our platform!\`
                    );
                    logger.info({ email: event.data.email }, 'Sent welcome email');
                    break;
                    
                case 'user.login':
                    logger.info({ userId: event.data.userId }, 'User login event received');
                    break;
            }
        },
    });
}

module.exports = { startUserEventsConsumer };
`);

writeFile('services/notification-service/src/consumers/order-events.consumer.js', `const { getKafka } = require('../config/kafka');

async function sendEmail(to, subject, body) {
    console.log(\`📧 Email: \${to} - \${subject}\`);
}

async function startOrderEventsConsumer(logger) {
    const kafka = getKafka();
    const consumer = kafka.consumer({ groupId: 'notification-service-group' });
    
    await consumer.connect();
    await consumer.subscribe({ topic: 'order.events', fromBeginning: false });
    
    await consumer.run({
        eachMessage: async ({ message }) => {
            const event = JSON.parse(message.value.toString());
            
            logger.info({ event: event.eventType }, 'Processing order event');
            
            switch (event.eventType) {
                case 'order.created':
                    logger.info({ orderId: event.data.orderId }, 'Order created - send confirmation email');
                    break;
                    
                case 'order.status_updated':
                    logger.info({ orderId: event.data.orderId, status: event.data.status }, 'Order status updated');
                    break;
            }
        },
    });
}

module.exports = { startOrderEventsConsumer };
`);

writeFile('services/notification-service/Dockerfile', `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3004
CMD ["node", "src/server.js"]
`);

writeFile('services/notification-service/.dockerignore', `node_modules
.env
.git
`);

console.log('✅ Notification Service complete!\n');
`);
