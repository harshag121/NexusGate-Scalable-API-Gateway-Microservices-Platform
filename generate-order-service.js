const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filepath, content) {
    try {
        ensureDir(path.dirname(filepath));
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✓ ${filepath.replace(process.cwd() + path.sep, '')}`);
        return true;
    } catch (e) {
        console.error(`✗ ${filepath}: ${e.message}`);
        return false;
    }
}

console.log('🚀 GENERATING ORDER SERVICE\n');

// Order Service - Server
writeFile('services/order-service/src/server.js', `require('dotenv').config();
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createLogger, requestLogger } = require('../../../shared/logger');
const { metricsMiddleware, getMetricsHandler } = require('../../../shared/metrics');
const errorHandler = require('../../../shared/middleware/error-handler');
const routes = require('./routes');
const { initDatabase } = require('./config/database');
const { initRedis } = require('./config/redis');
const { initKafka } = require('./config/kafka');
const { registerWithConsul } = require('./config/consul');
const { startUserEventsConsumer } = require('./consumers/user-events.consumer');

const app = express();
const PORT = process.env.PORT || 3003;
const SERVICE_NAME = process.env.SERVICE_NAME || 'order-service';

const logger = createLogger(SERVICE_NAME);

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(','), credentials: true }));
app.use(express.json());
app.use(requestLogger(logger));
app.use(metricsMiddleware());

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: SERVICE_NAME, timestamp: new Date().toISOString() });
});

app.get('/metrics', getMetricsHandler());
app.use('/', routes);
app.use(errorHandler(logger));

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

async function start() {
    try {
        await initDatabase();
        logger.info('Database initialized');

        await initRedis();
        logger.info('Redis initialized');

        await initKafka();
        logger.info('Kafka initialized');

        await startUserEventsConsumer(logger);
        logger.info('Kafka consumer started');

        app.listen(PORT, async () => {
            logger.info(\`\${SERVICE_NAME} listening on port \${PORT}\`);
            await registerWithConsul(SERVICE_NAME, PORT);
            logger.info('Registered with Consul');
        });
    } catch (error) {
        logger.error({ error }, 'Failed to start service');
        process.exit(1);
    }
}

start();
`);

// Order Service - Config files (database, redis, kafka, consul - same pattern)
writeFile('services/order-service/src/config/database.js', `const { Pool } = require('pg');

let pool;

function getPool() {
    if (!pool) {
        pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB || 'order_db',
            user: process.env.POSTGRES_USER || 'nexusgate',
            password: process.env.POSTGRES_PASSWORD || 'nexusgate_secret',
            max: parseInt(process.env.POSTGRES_POOL_MAX || '10'),
            min: parseInt(process.env.POSTGRES_POOL_MIN || '2'),
        });
        pool.on('error', (err) => console.error('Database pool error', err));
    }
    return pool;
}

async function initDatabase() {
    await getPool().query('SELECT NOW()');
}

async function query(text, params) {
    return getPool().query(text, params);
}

async function getClient() {
    return getPool().connect();
}

module.exports = { query, getClient, initDatabase, getPool };
`);

writeFile('services/order-service/src/config/redis.js', `const { createClient } = require('redis');

let redisClient;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
            },
        });
        redisClient.on('error', (err) => console.error('Redis Client Error', err));
        await redisClient.connect();
    }
    return redisClient;
}

async function initRedis() {
    await getRedisClient();
}

module.exports = { getRedisClient, initRedis };
`);

writeFile('services/order-service/src/config/kafka.js', `const { Kafka } = require('kafkajs');

let kafka, producer;

function getKafka() {
    if (!kafka) {
        kafka = new Kafka({
            clientId: 'order-service',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        });
    }
    return kafka;
}

async function getProducer() {
    if (!producer) {
        producer = getKafka().producer();
        await producer.connect();
    }
    return producer;
}

async function initKafka() {
    await getProducer();
}

async function publishEvent(topic, event) {
    const producer = await getProducer();
    await producer.send({
        topic,
        messages: [{ key: event.eventId || Date.now().toString(), value: JSON.stringify(event) }],
    });
}

module.exports = { getKafka, getProducer, initKafka, publishEvent };
`);

writeFile('services/order-service/src/config/consul.js', `const Consul = require('consul');

let consulClient;

function getConsulClient() {
    if (!consulClient) {
        consulClient = new Consul({
            host: process.env.CONSUL_HOST || 'localhost',
            port: process.env.CONSUL_PORT || '8500',
            promisify: true,
        });
    }
    return consulClient;
}

async function registerWithConsul(serviceName, port) {
    const consul = getConsulClient();
    const serviceId = \`\${serviceName}-\${port}\`;
    await consul.agent.service.register({
        id: serviceId,
        name: serviceName,
        address: process.env.SERVICE_HOST || 'localhost',
        port,
        check: {
            http: \`http://\${process.env.SERVICE_HOST || 'localhost'}:\${port}/health\`,
            interval: '10s',
            timeout: '5s',
        },
    });

    const deregister = async () => {
        await consul.agent.service.deregister(serviceId);
    };
    process.on('SIGTERM', deregister);
    process.on('SIGINT', deregister);
}

module.exports = { getConsulClient, registerWithConsul };
`);

// Order Controller
writeFile('services/order-service/src/controllers/order.controller.js', `const { query, getClient } = require('../config/database');
const { publishEvent } = require('../config/kafka');
const crypto = require('crypto');

async function createOrder(req, res) {
    const { userId, items, shippingAddress, billingAddress } = req.body;
    
    const client = await getClient();
    
    try {
        await client.query('BEGIN');
        
        const orderNumberResult = await client.query('SELECT generate_order_number() as number');
        const orderNumber = orderNumberResult.rows[0].number;
        
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        
        const orderResult = await client.query(
            \`INSERT INTO orders (user_id, order_number, total_amount, shipping_address, billing_address, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *\`,
            [userId, orderNumber, totalAmount, JSON.stringify(shippingAddress), JSON.stringify(billingAddress)]
        );
        
        const order = orderResult.rows[0];
        
        for (const item of items) {
            await client.query(
                \`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
                VALUES ($1, $2, $3, $4, $5, $6)\`,
                [order.id, item.productId, item.productName, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
        }
        
        await client.query('COMMIT');
        
        await publishEvent('order.events', {
            eventType: 'order.created',
            eventId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            data: { orderId: order.id, userId, orderNumber, totalAmount, items },
        });
        
        res.status(201).json({ order });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getOrder(req, res) {
    const { id } = req.params;
    const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Order not found' } });
    }
    
    const items = await query('SELECT * FROM order_items WHERE order_id = $1', [id]);
    res.json({ order: { ...result.rows[0], items: items.rows } });
}

async function getUserOrders(req, res) {
    const { userId } = req.params;
    const result = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json({ orders: result.rows });
}

async function updateOrderStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, id]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Order not found' } });
    }
    
    await publishEvent('order.events', {
        eventType: 'order.status_updated',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: { orderId: id, status },
    });
    
    res.json({ order: result.rows[0] });
}

module.exports = { createOrder, getOrder, getUserOrders, updateOrderStatus };
`);

// Order Routes
writeFile('services/order-service/src/routes/index.js', `const express = require('express');
const { validate, Joi } = require('../../../shared/middleware/validation');
const orderController = require('../controllers/order.controller');

const router = express.Router();

const createOrderSchema = Joi.object({
    userId: Joi.string().uuid().required(),
    items: Joi.array().items(Joi.object({
        productId: Joi.string().required(),
        productName: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        unitPrice: Joi.number().min(0).required(),
    })).min(1).required(),
    shippingAddress: Joi.object().required(),
    billingAddress: Joi.object(),
});

const updateStatusSchema = Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled').required(),
});

router.post('/orders', validate(createOrderSchema), orderController.createOrder);
router.get('/orders/:id', orderController.getOrder);
router.get('/users/:userId/orders', orderController.getUserOrders);
router.patch('/orders/:id/status', validate(updateStatusSchema), orderController.updateOrderStatus);

module.exports = router;
`);

// Kafka Consumer for User Events
writeFile('services/order-service/src/consumers/user-events.consumer.js', `const { getKafka } = require('../config/kafka');

async function startUserEventsConsumer(logger) {
    const kafka = getKafka();
    const consumer = kafka.consumer({ groupId: 'order-service-group' });
    
    await consumer.connect();
    await consumer.subscribe({ topic: 'user.events', fromBeginning: false });
    
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            
            logger.info({ event: event.eventType }, 'Processing user event');
            
            switch (event.eventType) {
                case 'user.created':
                    logger.info({ userId: event.data.userId }, 'New user created');
                    break;
                    
                case 'user.deleted':
                    logger.info({ userId: event.data.userId }, 'User deleted - may need to handle pending orders');
                    break;
            }
        },
    });
}

module.exports = { startUserEventsConsumer };
`);

// Dockerfile
writeFile('services/order-service/Dockerfile', `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3003
CMD ["node", "src/server.js"]
`);

writeFile('services/order-service/.dockerignore', `node_modules
npm-debug.log
.env
.git
`);

console.log('\n✅ Order Service complete!');
console.log('\nNext: Run notification service generator...');
`);
