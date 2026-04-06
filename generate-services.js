const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function writeFile(filepath, content) {
    const dir = path.dirname(filepath);
    ensureDir(dir);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✓ ${filepath}`);
}

console.log('🚀 Generating NexusGate Services...\n');

// ============================================================
// AUTH SERVICE
// ============================================================

console.log('📦 Creating Auth Service...');

writeFile('services/auth-service/package.json', JSON.stringify({
    name: 'nexusgate-auth-service',
    version: '1.0.0',
    description: 'Authentication service with JWT',
    main: 'src/server.js',
    scripts: {
        start: 'node src/server.js',
        dev: 'nodemon src/server.js'
    },
    dependencies: {
        express: '^4.18.2',
        'express-async-errors': '^3.1.1',
        bcrypt: '^5.1.1',
        jsonwebtoken: '^9.0.2',
        pg: '^8.11.3',
        redis: '^4.6.10',
        kafkajs: '^2.2.4',
        consul: '^1.1.0',
        pino: '^8.16.0',
        'prom-client': '^15.0.0',
        joi: '^17.11.0',
        helmet: '^7.1.0',
        cors: '^2.8.5',
        'jaeger-client': '^3.19.0',
        dotenv: '^16.3.1'
    },
    devDependencies: {
        nodemon: '^3.0.1'
    }
}, null, 2));

writeFile('services/auth-service/Dockerfile', `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "src/server.js"]
`);

writeFile('services/auth-service/.dockerignore', `node_modules
npm-debug.log
.env
.git
.gitignore
README.md
`);

writeFile('services/auth-service/src/server.js', `require('dotenv').config();
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
const { generateKeysIfNotExist } = require('./services/key-generator');

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'auth-service';

const logger = createLogger(SERVICE_NAME);

// Middleware
app.use(helmet());
app.use(cors({
    origin: (process.env.CORS_ORIGIN || '').split(','),
    credentials: true,
}));
app.use(express.json());
app.use(requestLogger(logger));
app.use(metricsMiddleware());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: SERVICE_NAME, timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', getMetricsHandler());

// Routes
app.use('/', routes);

// Error handler
app.use(errorHandler(logger));

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
async function start() {
    try {
        // Generate JWT keys if they don't exist
        await generateKeysIfNotExist();
        
        // Initialize database
        await initDatabase();
        logger.info('Database initialized');

        // Initialize Redis
        await initRedis();
        logger.info('Redis initialized');

        // Initialize Kafka
        await initKafka();
        logger.info('Kafka initialized');

        // Start server
        app.listen(PORT, async () => {
            logger.info(\`\${SERVICE_NAME} listening on port \${PORT}\`);
            
            // Register with Consul
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

writeFile('services/auth-service/src/config/database.js', `const { Pool } = require('pg');

let pool;

function getPool() {
    if (!pool) {
        pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB || 'auth_db',
            user: process.env.POSTGRES_USER || 'nexusgate',
            password: process.env.POSTGRES_PASSWORD || 'nexusgate_secret',
            max: parseInt(process.env.POSTGRES_POOL_MAX || '10'),
            min: parseInt(process.env.POSTGRES_POOL_MIN || '2'),
            idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT_MS || '30000'),
            connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || '2000'),
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

writeFile('services/auth-service/src/config/redis.js', `const { createClient } = require('redis');

let redisClient;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
            },
            password: process.env.REDIS_PASSWORD || undefined,
        });

        redisClient.on('error', (err) => console.error('Redis Client Error', err));
        
        await redisClient.connect();
    }
    return redisClient;
}

async function initRedis() {
    await getRedisClient();
}

module.exports = {
    getRedisClient,
    initRedis,
};
`);

writeFile('services/auth-service/src/config/kafka.js', `const { Kafka } = require('kafkajs');

let kafka;
let producer;

function getKafka() {
    if (!kafka) {
        kafka = new Kafka({
            clientId: process.env.KAFKA_CLIENT_ID || 'auth-service',
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

writeFile('services/auth-service/src/config/consul.js', `const Consul = require('consul');

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

writeFile('services/auth-service/src/services/key-generator.js', `const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function generateKeysIfNotExist() {
    const keysDir = path.join(__dirname, '../../../../keys');
    const privateKeyPath = path.join(keysDir, 'private.pem');
    const publicKeyPath = path.join(keysDir, 'public.pem');

    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
    }

    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
        console.log('Generating RSA key pair...');
        
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
            },
        });

        fs.writeFileSync(privateKeyPath, privateKey);
        fs.writeFileSync(publicKeyPath, publicKey);
        
        console.log('✓ RSA key pair generated');
    }
}

module.exports = { generateKeysIfNotExist };
`);

// Continue with controllers and routes...
writeFile('services/auth-service/src/controllers/auth.controller.js', `const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../config/database');
const { getRedisClient } = require('../config/redis');
const { publishEvent } = require('../config/kafka');

const privateKey = fs.readFileSync(path.join(__dirname, '../../../../keys/private.pem'), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, '../../../../keys/public.pem'), 'utf8');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';
const JWT_ISSUER = process.env.JWT_ISSUER || 'nexusgate-auth';

function generateAccessToken(payload) {
    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        issuer: JWT_ISSUER,
        expiresIn: ACCESS_TOKEN_TTL,
    });
}

function generateRefreshToken(payload) {
    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        issuer: JWT_ISSUER,
        expiresIn: REFRESH_TOKEN_TTL,
    });
}

async function register(req, res) {
    const { email, password, firstName, lastName } = req.body;

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: { message: 'User already exists' } });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const result = await query(
        \`INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, first_name, last_name, created_at\`,
        [email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Publish user.created event
    await publishEvent('user.events', {
        eventType: 'user.created',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: {
            userId: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
        },
    });

    res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
        },
    });
}

async function login(req, res) {
    const { email, password } = req.body;

    // Find user
    const result = await query(
        'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
        [email]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    // Generate tokens
    const payload = {
        userId: user.id,
        email: user.email,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in Redis
    const redis = await getRedisClient();
    await redis.setEx(\`refresh_token:\${user.id}\`, 7 * 24 * 60 * 60, refreshToken);

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Publish login event
    await publishEvent('user.events', {
        eventType: 'user.login',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: { userId: user.id, email: user.email },
    });

    res.json({
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
        },
    });
}

async function refresh(req, res) {
    const { refreshToken } = req.body;

    try {
        const decoded = jwt.verify(refreshToken, publicKey, {
            algorithms: ['RS256'],
            issuer: JWT_ISSUER,
        });

        // Verify token exists in Redis
        const redis = await getRedisClient();
        const storedToken = await redis.get(\`refresh_token:\${decoded.userId}\`);
        
        if (storedToken !== refreshToken) {
            return res.status(401).json({ error: { message: 'Invalid refresh token' } });
        }

        // Generate new access token
        const accessToken = generateAccessToken({
            userId: decoded.userId,
            email: decoded.email,
        });

        res.json({ accessToken });
    } catch (error) {
        res.status(401).json({ error: { message: 'Invalid refresh token' } });
    }
}

async function logout(req, res) {
    const { userId } = req.user;

    // Remove refresh token from Redis
    const redis = await getRedisClient();
    await redis.del(\`refresh_token:\${userId}\`);

    res.json({ message: 'Logged out successfully' });
}

async function verify(req, res) {
    res.json({ valid: true, user: req.user });
}

module.exports = {
    register,
    login,
    refresh,
    logout,
    verify,
};
`);

writeFile('services/auth-service/src/routes/index.js', `const express = require('express');
const { validate, Joi } = require('../../../shared/middleware/validation');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(100),
    lastName: Joi.string().min(2).max(100),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

const refreshSchema = Joi.object({
    refreshToken: Joi.string().required(),
});

// Routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authMiddleware, authController.logout);
router.get('/verify', authMiddleware, authController.verify);

module.exports = router;
`);

writeFile('services/auth-service/src/middleware/auth.middleware.js', `const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const publicKey = fs.readFileSync(path.join(__dirname, '../../../../keys/public.pem'), 'utf8');

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: { message: 'No token provided' } });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, publicKey, {
            algorithms: ['RS256'],
            issuer: process.env.JWT_ISSUER || 'nexusgate-auth',
        });

        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: { message: 'Invalid token' } });
    }
}

module.exports = authMiddleware;
`);

console.log('✅ Auth Service created!\n');
console.log('Generation complete!');
console.log('Next: Run "node build-project.js" to set up infrastructure, then run this script.');
