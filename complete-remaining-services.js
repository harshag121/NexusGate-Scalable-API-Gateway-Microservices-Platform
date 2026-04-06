const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function writeFile(filepath, content) {
    ensureDir(path.dirname(filepath));
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✓ ${filepath.replace(process.cwd(), '.')}`);
}

console.log('🚀 COMPLETING NEXUSGATE PROJECT (40% REMAINING)');
console.log('='.repeat(70));
console.log('\nGenerating:\n- User Service\n- Order Service\n- Notification Service\n- API Gateway\n\n');

let fileCount = 0;

// ============================================================
// USER SERVICE - COMPLETE IMPLEMENTATION
// ============================================================

console.log('📦 Creating User Service...\n');

writeFile('services/user-service/src/server.js', `require('dotenv').config();
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createLogger, requestLogger } = require('../../../shared/logger');
const { metricsMiddleware, getMetricsHandler } = require('../../../shared/metrics');
const errorHandler = require('../../../shared/middleware/error-handler');
const routes = require('./routes');
const { initDatabase } = require('./config/database');
const { initKafka } = require('./config/kafka');
const { registerWithConsul } = require('./config/consul');

const app = express();
const PORT = process.env.PORT || 3002;
const SERVICE_NAME = process.env.SERVICE_NAME || 'user-service';

const logger = createLogger(SERVICE_NAME);

app.use(helmet());
app.use(cors({
    origin: (process.env.CORS_ORIGIN || '').split(','),
    credentials: true,
}));
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

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

async function start() {
    try {
        await initDatabase();
        logger.info('Database initialized');

        await initKafka();
        logger.info('Kafka initialized');

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
fileCount++;

writeFile('services/user-service/src/config/database.js', `const { Pool } = require('pg');

let pool;

function getPool() {
    if (!pool) {
        pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB || 'user_db',
            user: process.env.POSTGRES_USER || 'nexusgate',
            password: process.env.POSTGRES_PASSWORD || 'nexusgate_secret',
            max: parseInt(process.env.POSTGRES_POOL_MAX || '10'),
            min: parseInt(process.env.POSTGRES_POOL_MIN || '2'),
        });

        pool.on('error', (err) => {
            console.error('Unexpected database pool error', err);
        });
    }
    return pool;
}

async function initDatabase() {
    const pool = getPool();
    await pool.query('SELECT NOW()');
}

async function query(text, params) {
    const pool = getPool();
    return pool.query(text, params);
}

async function getClient() {
    const pool = getPool();
    return pool.connect();
}

module.exports = {
    query,
    getClient,
    initDatabase,
    getPool,
};
`);
fileCount++;

writeFile('services/user-service/src/config/kafka.js', `const { Kafka } = require('kafkajs');

let kafka;
let producer;

function getKafka() {
    if (!kafka) {
        kafka = new Kafka({
            clientId: process.env.KAFKA_CLIENT_ID || 'user-service',
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
        messages: [{
            key: event.eventId || Date.now().toString(),
            value: JSON.stringify(event),
        }],
    });
}

module.exports = {
    getKafka,
    getProducer,
    initKafka,
    publishEvent,
};
`);
fileCount++;

writeFile('services/user-service/src/config/consul.js', `const Consul = require('consul');

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
        port: port,
        check: {
            http: \`http://\${process.env.SERVICE_HOST || 'localhost'}:\${port}/health\`,
            interval: '10s',
            timeout: '5s',
        },
    });

    const deregister = async () => {
        await consul.agent.service.deregister(serviceId);
        console.log(\`Deregistered \${serviceId} from Consul\`);
    };

    process.on('SIGTERM', deregister);
    process.on('SIGINT', deregister);
}

module.exports = {
    getConsulClient,
    registerWithConsul,
};
`);
fileCount++;

writeFile('services/user-service/src/controllers/user.controller.js', `const { query } = require('../config/database');
const { publishEvent } = require('../config/kafka');
const crypto = require('crypto');

async function getUser(req, res) {
    const { id } = req.params;
    
    const result = await query(
        \`SELECT id, email, first_name, last_name, phone, address, city, 
                country, postal_code, avatar_url, bio, preferences, 
                created_at, updated_at
         FROM user_profiles WHERE id = $1\`,
        [id]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    res.json({ user: result.rows[0] });
}

async function updateUser(req, res) {
    const { id } = req.params;
    const { firstName, lastName, phone, address, city, country, postalCode, bio } = req.body;
    
    const result = await query(
        \`UPDATE user_profiles 
        SET first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            phone = COALESCE($4, phone),
            address = COALESCE($5, address),
            city = COALESCE($6, city),
            country = COALESCE($7, country),
            postal_code = COALESCE($8, postal_code),
            bio = COALESCE($9, bio),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *\`,
        [id, firstName, lastName, phone, address, city, country, postalCode, bio]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    await publishEvent('user.events', {
        eventType: 'user.updated',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: { userId: id, ...result.rows[0] },
    });
    
    res.json({ user: result.rows[0] });
}

async function getUserProfile(req, res) {
    const { id } = req.params;
    
    const result = await query(
        'SELECT * FROM user_profiles WHERE id = $1',
        [id]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    res.json({ profile: result.rows[0] });
}

async function deleteUser(req, res) {
    const { id } = req.params;
    
    const result = await query('DELETE FROM user_profiles WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    await publishEvent('user.events', {
        eventType: 'user.deleted',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: { userId: id },
    });
    
    res.json({ message: 'User deleted successfully' });
}

module.exports = {
    getUser,
    updateUser,
    getUserProfile,
    deleteUser,
};
`);
fileCount++;

writeFile('services/user-service/src/routes/index.js', `const express = require('express');
const { validate, Joi } = require('../../../shared/middleware/validation');
const userController = require('../controllers/user.controller');

const router = express.Router();

const updateUserSchema = Joi.object({
    firstName: Joi.string().min(2).max(100),
    lastName: Joi.string().min(2).max(100),
    phone: Joi.string().max(20),
    address: Joi.string().max(500),
    city: Joi.string().max(100),
    country: Joi.string().max(100),
    postalCode: Joi.string().max(20),
    bio: Joi.string().max(1000),
});

router.get('/users/:id', userController.getUser);
router.put('/users/:id', validate(updateUserSchema), userController.updateUser);
router.get('/users/:id/profile', userController.getUserProfile);
router.delete('/users/:id', userController.deleteUser);

module.exports = router;
`);
fileCount++;

writeFile('services/user-service/Dockerfile', `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3002

CMD ["node", "src/server.js"]
`);
fileCount++;

writeFile('services/user-service/.dockerignore', `node_modules
npm-debug.log
.env
.git
.gitignore
README.md
`);
fileCount++;

console.log('✅ User Service complete!\n');

// Continue in next response due to length...
console.log(\`\nGenerated \${fileCount} files for User Service\`);
console.log('Next: Run this script to continue with remaining services...');
`);
fileCount++;
