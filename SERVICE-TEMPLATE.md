# 🛠️ Service Implementation Template

Use this template to create the remaining services (User, Order, Notification).

## Generic Service Structure

Every service follows this pattern (Auth Service is the complete example):

```
services/YOUR-SERVICE/
├── src/
│   ├── server.js           # Main application file
│   ├── config/
│   │   ├── database.js     # PostgreSQL connection
│   │   ├── redis.js        # Redis client (if needed)
│   │   ├── kafka.js        # Kafka producer/consumer
│   │   └── consul.js       # Service registration
│   ├── controllers/
│   │   └── *.controller.js # Business logic
│   ├── routes/
│   │   └── index.js        # Route definitions
│   ├── models/             # Data models (optional)
│   ├── services/           # Service layer (optional)
│   ├── consumers/          # Kafka consumers (if needed)
│   └── middleware/         # Custom middleware
├── Dockerfile
├── .dockerignore
└── package.json
```

## Step-by-Step: Create User Service

### 1. Copy Auth Service Structure

```bash
# Copy entire auth-service as template
cp -r services/auth-service services/user-service

# Clean up auth-specific files
cd services/user-service
rm -rf node_modules
```

### 2. Update package.json

```json
{
  "name": "nexusgate-user-service",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-async-errors": "^3.1.1",
    "pg": "^8.11.3",
    "kafkajs": "^2.2.4",
    "consul": "^1.1.0",
    "pino": "^8.16.0",
    "prom-client": "^15.0.0",
    "joi": "^17.11.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

### 3. Update src/server.js

Change:
- `PORT`: 3002
- `SERVICE_NAME`: 'user-service'
- Database: 'user_db'
- Remove Redis if not needed
- Keep Kafka, Consul

### 4. Create src/controllers/user.controller.js

```javascript
const { query } = require('../config/database');
const { publishEvent } = require('../config/kafka');
const crypto = require('crypto');

async function getUser(req, res) {
    const { id } = req.params;
    
    const result = await query(
        'SELECT id, email, first_name, last_name, phone, city, country FROM user_profiles WHERE id = $1',
        [id]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    res.json({ user: result.rows[0] });
}

async function updateUser(req, res) {
    const { id } = req.params;
    const { firstName, lastName, phone, address, city, country } = req.body;
    
    const result = await query(
        `UPDATE user_profiles 
        SET first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            phone = COALESCE($4, phone),
            address = COALESCE($5, address),
            city = COALESCE($6, city),
            country = COALESCE($7, country),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
        [id, firstName, lastName, phone, address, city, country]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    // Publish user.updated event
    await publishEvent('user.events', {
        eventType: 'user.updated',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: { userId: id, ...result.rows[0] },
    });
    
    res.json({ user: result.rows[0] });
}

async function deleteUser(req, res) {
    const { id } = req.params;
    
    const result = await query('DELETE FROM user_profiles WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    // Publish user.deleted event
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
    deleteUser,
};
```

### 5. Create src/routes/index.js

```javascript
const express = require('express');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.get('/users/:id', userController.getUser);
router.put('/users/:id', userController.updateUser);
router.delete('/users/:id', userController.deleteUser);

module.exports = router;
```

### 6. Update config files

All config files (database.js, kafka.js, consul.js) are the same!
Just update environment variables:
- Change POSTGRES_DB to 'user_db'
- Change SERVICE_NAME to 'user-service'

### 7. Build and Run

```bash
npm install
npm start
```

Or with Docker:
```bash
docker-compose build user-service
docker-compose up -d user-service
```

## Step-by-Step: Create Order Service

Follow same pattern as User Service, but add:

### Additional: Kafka Consumer

Create `src/consumers/user-events.consumer.js`:

```javascript
const { getKafka } = require('../config/kafka');

async function startUserEventsConsumer() {
    const kafka = getKafka();
    const consumer = kafka.consumer({ groupId: 'order-service-group' });
    
    await consumer.connect();
    await consumer.subscribe({ topic: 'user.events', fromBeginning: false });
    
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            
            console.log('Received user event:', event.eventType);
            
            // Handle different event types
            switch (event.eventType) {
                case 'user.created':
                    // Maybe create user wallet/credit
                    break;
                case 'user.deleted':
                    // Maybe cancel pending orders
                    break;
            }
        },
    });
}

module.exports = { startUserEventsConsumer };
```

Then in `src/server.js`, add:

```javascript
const { startUserEventsConsumer } = require('./consumers/user-events.consumer');

// After other initialization
await startUserEventsConsumer();
logger.info('Kafka consumer started');
```

### Order Controller Example

```javascript
async function createOrder(req, res) {
    const { userId, items, shippingAddress } = req.body;
    
    const client = await getClient();
    
    try {
        await client.query('BEGIN');
        
        // Generate order number
        const orderNumber = await client.query('SELECT generate_order_number()');
        
        // Calculate total
        const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        
        // Insert order
        const orderResult = await client.query(
            `INSERT INTO orders (user_id, order_number, total_amount, shipping_address, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *`,
            [userId, orderNumber.rows[0].generate_order_number, total, JSON.stringify(shippingAddress)]
        );
        
        const order = orderResult.rows[0];
        
        // Insert order items
        for (const item of items) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [order.id, item.productId, item.productName, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
        }
        
        await client.query('COMMIT');
        
        // Publish order.created event
        await publishEvent('order.events', {
            eventType: 'order.created',
            eventId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            data: { orderId: order.id, userId, total, items },
        });
        
        res.status(201).json({ order });
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
```

## Step-by-Step: Create Notification Service

This is the simplest - just Kafka consumers!

### src/server.js

```javascript
require('dotenv').config();
const express = require('express');
const { createLogger } = require('../../../shared/logger');
const { metricsMiddleware, getMetricsHandler } = require('../../../shared/metrics');
const { startUserEventsConsumer } = require('./consumers/user-events.consumer');
const { startOrderEventsConsumer } = require('./consumers/order-events.consumer');
const { registerWithConsul } = require('./config/consul');

const app = express();
const PORT = process.env.PORT || 3004;
const logger = createLogger('notification-service');

app.use(metricsMiddleware());

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

app.get('/metrics', getMetricsHandler());

async function start() {
    await startUserEventsConsumer(logger);
    await startOrderEventsConsumer(logger);
    
    app.listen(PORT, async () => {
        logger.info(`Notification service listening on port ${PORT}`);
        await registerWithConsul('notification-service', PORT);
    });
}

start();
```

### src/consumers/user-events.consumer.js

```javascript
const { getKafka } = require('../config/kafka');

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
                    // Send welcome email
                    logger.info({ email: event.data.email }, 'Sending welcome email');
                    // await sendEmail(event.data.email, 'Welcome!', 'Thanks for signing up');
                    break;
                    
                case 'user.login':
                    // Could send login notification
                    logger.info({ userId: event.data.userId }, 'User logged in');
                    break;
            }
        },
    });
}

module.exports = { startUserEventsConsumer };
```

## Step-by-Step: Create API Gateway

This is the most complex service. Here's the structure:

### src/server.js

```javascript
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createProxy Middleware } = require('http-proxy-middleware');
const { createLogger, requestLogger } = require('../../../shared/logger');
const { metricsMiddleware, getMetricsHandler } = require('../../../shared/metrics');
const authMiddleware = require('./middleware/auth.middleware');
const rateLimiterMiddleware = require('./middleware/rate-limiter.middleware');
const circuitBreakerMiddleware = require('./middleware/circuit-breaker.middleware');
const correlationIdMiddleware = require('./middleware/correlation-id.middleware');
const errorHandler = require('../../../shared/middleware/error-handler');
const aggregateRoutes = require('./routes/aggregate.routes');
const { registerWithConsul } = require('./config/consul');

const app = express();
const PORT = process.env.PORT || 8080;
const logger = createLogger('api-gateway');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware());
app.use(requestLogger(logger));
app.use(metricsMiddleware());
app.use(rateLimiterMiddleware());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'api-gateway' });
});

app.get('/metrics', getMetricsHandler());

// Aggregation routes
app.use('/api/v1/aggregate', aggregateRoutes);

// Auth service (public routes)
app.use('/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: { '^/auth': '' },
}));

// Protected routes
app.use('/users', authMiddleware, circuitBreakerMiddleware('user-service'), createProxyMiddleware({
    target: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/users': '/users' },
}));

app.use('/orders', authMiddleware, circuitBreakerMiddleware('order-service'), createProxyMiddleware({
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/orders': '/orders' },
}));

app.use(errorHandler(logger));

app.listen(PORT, async () => {
    logger.info(`API Gateway listening on port ${PORT}`);
    await registerWithConsul('api-gateway', PORT);
});
```

### src/middleware/auth.middleware.js

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const publicKey = fs.readFileSync(path.join(__dirname, '../../../../keys/public.pem'), 'utf8');

function authMiddleware(req, res, next) {
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
        req.headers['x-user-id'] = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: { message: 'Invalid token' } });
    }
}

module.exports = authMiddleware;
```

### src/middleware/rate-limiter.middleware.js

```javascript
const { getRedisClient } = require('../config/redis');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

function rateLimiterMiddleware() {
    return async (req, res, next) => {
        const redis = await getRedisClient();
        const key = `rate_limit:${req.ip}`;
        
        const current = await redis.incr(key);
        
        if (current === 1) {
            await redis.pExpire(key, WINDOW_MS);
        }
        
        if (current > MAX_REQUESTS) {
            return res.status(429).json({
                error: { message: 'Too many requests' },
            });
        }
        
        res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - current));
        
        next();
    };
}

module.exports = rateLimiterMiddleware;
```

### src/middleware/circuit-breaker.middleware.js

```javascript
const CircuitBreaker = require('opossum');
const axios = require('axios');

const breakers = {};

function circuitBreakerMiddleware(serviceName) {
    return (req, res, next) => {
        if (!breakers[serviceName]) {
            const options = {
                timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '3000'),
                errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50'),
                resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
            };
            
            breakers[serviceName] = new CircuitBreaker(async (req) => req, options);
            
            breakers[serviceName].on('open', () => {
                console.log(`Circuit breaker opened for ${serviceName}`);
            });
        }
        
        req.circuitBreaker = breakers[serviceName];
        next();
    };
}

module.exports = circuitBreakerMiddleware;
```

## Quick Reference

### Environment Variables by Service

**All Services:**
- `NODE_ENV`
- `PORT`
- `SERVICE_NAME`
- `CONSUL_HOST`
- `CONSUL_PORT`
- `KAFKA_BROKERS`

**Auth Service:**
- `POSTGRES_DB=auth_db`
- `REDIS_HOST`
- `JWT_ACCESS_TOKEN_TTL`
- `JWT_REFRESH_TOKEN_TTL`
- `BCRYPT_SALT_ROUNDS`

**User Service:**
- `POSTGRES_DB=user_db`

**Order Service:**
- `POSTGRES_DB=order_db`
- `REDIS_HOST`

**Gateway:**
- `REDIS_HOST`
- `AUTH_SERVICE_URL`
- `USER_SERVICE_URL`
- `ORDER_SERVICE_URL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `CIRCUIT_BREAKER_TIMEOUT`

### Common Patterns

1. **Always use** `require('express-async-errors')` to catch async errors
2. **Always register** with Consul on startup
3. **Always publish** Kafka events for state changes
4. **Always include** health check endpoint
5. **Always use** Prometheus metrics middleware
6. **Always handle** graceful shutdown

### File Checklist for Each Service

- [ ] package.json
- [ ] Dockerfile
- [ ] .dockerignore
- [ ] src/server.js
- [ ] src/config/database.js (if using Postgres)
- [ ] src/config/redis.js (if using Redis)
- [ ] src/config/kafka.js
- [ ] src/config/consul.js
- [ ] src/controllers/*.controller.js
- [ ] src/routes/index.js
- [ ] src/consumers/*.consumer.js (if needed)

---

Use Auth Service (`services/auth-service/`) as your complete reference implementation!
