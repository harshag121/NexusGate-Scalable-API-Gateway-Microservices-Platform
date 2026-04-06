#!/usr/bin/env node
/**
 * NexusGate Complete Project Generator
 * 
 * This script generates the entire microservices platform including:
 * - 4 Microservices (Auth, User, Order, Notification)
 * - API Gateway with advanced features
 * - Kubernetes manifests
 * - Utility scripts
 * - Complete documentation
 * 
 * Usage: node generate-everything.js
 */

const fs = require('fs');
const path = require('path');

// Utility functions
const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
const write = (file, content) => {
    ensure(path.dirname(file));
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✓ ${file.replace(process.cwd(), '.')}`);
};

console.log('�� NEXUSGATE COMPLETE PROJECT GENERATOR\n');
console.log('='.repeat(70));
console.log('Building production-grade API Gateway with Microservices Platform\n');

let fileCount = 0;

// Import sub-generators
const generators = {
    infrastructure: require('./generators/infrastructure'),
    shared: require('./generators/shared-libs'),
    auth: require('./generators/auth-service'),
    user: require('./generators/user-service'),
    order: require('./generators/order-service'),
    notification: require('./generators/notification-service'),
    gateway: require('./generators/gateway'),
    kubernetes: require('./generators/kubernetes'),
    scripts: require('./generators/scripts'),
    docs: require('./generators/documentation'),
};

async function generate() {
    try {
        console.log('📁 Phase 1: Infrastructure Configuration...');
        generators.infrastructure(write);
        
        console.log('\n📦 Phase 2: Shared Libraries...');
        generators.shared(write);
        
        console.log('\n🔐 Phase 3: Auth Service...');
        generators.auth(write);
        
        console.log('\n👤 Phase 4: User Service...');
        generators.user(write);
        
        console.log('\n📦 Phase 5: Order Service...');
        generators.order(write);
        
        console.log('\n📧 Phase 6: Notification Service...');
        generators.notification(write);
        
        console.log('\n🚪 Phase 7: API Gateway...');
        generators.gateway(write);
        
        console.log('\n☸️  Phase 8: Kubernetes Manifests...');
        generators.kubernetes(write);
        
        console.log('\n🛠️  Phase 9: Utility Scripts...');
        generators.scripts(write);
        
        console.log('\n📚 Phase 10: Documentation...');
        generators.docs(write);
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ GENERATION COMPLETE!\n');
        console.log(`📊 Total files created: ${fileCount}`);
        console.log('\n🎉 NexusGate platform is ready!');
        console.log('\nNext steps:');
        console.log('  1. Review .env.example and create .env');
        console.log('  2. Run: npm install (in each service directory)');
        console.log('  3. Run: node scripts/generate-jwt-keys.js');
        console.log('  4. Run: docker-compose up -d');
        console.log('  5. Run: node scripts/seed-database.js');
        console.log('  6. Test: http://localhost:8080/health');
        console.log('\n📖 See README.md for complete documentation\n');
        
    } catch (error) {
        console.error('\n❌ Generation failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Check if generator modules exist, if not create inline
if (!fs.existsSync('./generators')) {
    console.log('\n📝 Creating generator modules...\n');
    createGeneratorModules();
}

generate();

function createGeneratorModules() {
    console.log('⚠️  Generator modules not found. Using standalone generation...\n');
    generateInline();
}

function generateInline() {
    console.log('🏗️  Starting complete project generation...\n');
    
    const projectFiles = {};
    
    // =====================================================
    // UTILITY SCRIPT: JWT Key Generator
    // =====================================================
    
    projectFiles['scripts/generate-jwt-keys.js'] = `const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '../keys');

if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

console.log('Generating RSA key pair for JWT signing...');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey);
fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

console.log('✓ Keys generated successfully!');
console.log('  - keys/private.pem');
console.log('  - keys/public.pem');
`;

    // =====================================================
    // UTILITY SCRIPT: Database Seeder
    // =====================================================
    
    projectFiles['scripts/seed-database.js'] = `const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pools = {
    auth: new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: 5432,
        database: 'auth_db',
        user: 'nexusgate',
        password: 'nexusgate_secret',
    }),
    user: new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: 5432,
        database: 'user_db',
        user: 'nexusgate',
        password: 'nexusgate_secret',
    }),
    order: new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: 5432,
        database: 'order_db',
        user: 'nexusgate',
        password: 'nexusgate_secret',
    }),
};

async function seed() {
    console.log('🌱 Seeding databases...');
    
    try {
        // Seed auth_db
        const hash = await bcrypt.hash('password123', 12);
        const authResult = await pools.auth.query(\`
            INSERT INTO users (email, password_hash, first_name, last_name, is_verified)
            VALUES 
                ('john.doe@example.com', $1, 'John', 'Doe', true),
                ('jane.smith@example.com', $1, 'Jane', 'Smith', true)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email
        \`, [hash]);
        
        console.log(\`✓ Created \${authResult.rowCount} test users in auth_db\`);
        
        // Seed user_db
        for (const user of authResult.rows) {
            await pools.user.query(\`
                INSERT INTO user_profiles (id, email, first_name, last_name, city, country)
                VALUES ($1, $2, $3, $4, 'San Francisco', 'USA')
                ON CONFLICT (id) DO NOTHING
            \`, [user.id, user.email, user.email.split('.')[0], user.email.split('.')[1].split('@')[0]]);
        }
        
        console.log('✓ Created user profiles in user_db');
        
        // Seed order_db  
        if (authResult.rows.length > 0) {
            const userId = authResult.rows[0].id;
            await pools.order.query(\`
                INSERT INTO orders (user_id, order_number, status, total_amount, currency)
                VALUES 
                    ($1, 'ORD-20240101-001', 'delivered', 99.99, 'USD'),
                    ($1, 'ORD-20240102-002', 'processing', 149.99, 'USD')
                ON CONFLICT (order_number) DO NOTHING
            \`, [userId]);
            
            console.log('✓ Created sample orders in order_db');
        }
        
        console.log('\\n🎉 Database seeding completed!');
        console.log('\\nTest credentials:');
        console.log('  Email: john.doe@example.com');
        console.log('  Password: password123');
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await pools.auth.end();
        await pools.user.end();
        await pools.order.end();
    }
}

seed();
`;

    // =====================================================
    // UTILITY SCRIPT: Health Check
    // =====================================================
    
    projectFiles['scripts/health-check.js'] = `const http = require('http');

const services = [
    { name: 'Gateway', url: 'http://localhost:8080/health' },
    { name: 'Auth Service', url: 'http://localhost:3001/health' },
    { name: 'User Service', url: 'http://localhost:3002/health' },
    { name: 'Order Service', url: 'http://localhost:3003/health' },
    { name: 'Notification Service', url: 'http://localhost:3004/health' },
];

async function checkService(service) {
    return new Promise((resolve) => {
        http.get(service.url, (res) => {
            resolve({ ...service, status: res.statusCode === 200 ? '✓' : '✗', code: res.statusCode });
        }).on('error', () => {
            resolve({ ...service, status: '✗', code: 'ERROR' });
        });
    });
}

async function checkAll() {
    console.log('🏥 Checking service health...\\n');
    
    const results = await Promise.all(services.map(checkService));
    
    results.forEach(r => {
        console.log(\`\${r.status} \${r.name.padEnd(20)} - \${r.code}\`);
    });
    
    const healthy = results.filter(r => r.status === '✓').length;
    console.log(\`\\n\${healthy}/\${services.length} services healthy\`);
}

checkAll();
`;

    // =====================================================
    // PACKAGE.JSON FILES FOR EACH SERVICE
    // =====================================================
    
    projectFiles['services/auth-service/package.json'] = JSON.stringify({
        name: 'nexusgate-auth-service',
        version: '1.0.0',
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
            dotenv: '^16.3.1'
        }
    }, null, 2);
    
    projectFiles['services/user-service/package.json'] = JSON.stringify({
        name: 'nexusgate-user-service',
        version: '1.0.0',
        main: 'src/server.js',
        scripts: {
            start: 'node src/server.js',
            dev: 'nodemon src/server.js'
        },
        dependencies: {
            express: '^4.18.2',
            'express-async-errors': '^3.1.1',
            pg: '^8.11.3',
            kafkajs: '^2.2.4',
            consul: '^1.1.0',
            pino: '^8.16.0',
            'prom-client': '^15.0.0',
            joi: '^17.11.0',
            helmet: '^7.1.0',
            cors: '^2.8.5',
            dotenv: '^16.3.1'
        }
    }, null, 2);
    
    projectFiles['services/order-service/package.json'] = JSON.stringify({
        name: 'nexusgate-order-service',
        version: '1.0.0',
        main: 'src/server.js',
        scripts: {
            start: 'node src/server.js',
            dev: 'nodemon src/server.js'
        },
        dependencies: {
            express: '^4.18.2',
            'express-async-errors': '^3.1.1',
            pg: '^8.11.3',
            redis: '^4.6.10',
            kafkajs: '^2.2.4',
            consul: '^1.1.0',
            pino: '^8.16.0',
            'prom-client': '^15.0.0',
            joi: '^17.11.0',
            helmet: '^7.1.0',
            cors: '^2.8.5',
            dotenv: '^16.3.1'
        }
    }, null, 2);
    
    projectFiles['services/notification-service/package.json'] = JSON.stringify({
        name: 'nexusgate-notification-service',
        version: '1.0.0',
        main: 'src/server.js',
        scripts: {
            start: 'node src/server.js',
            dev: 'nodemon src/server.js'
        },
        dependencies: {
            express: '^4.18.2',
            kafkajs: '^2.2.4',
            consul: '^1.1.0',
            pino: '^8.16.0',
            'prom-client': '^15.0.0',
            dotenv: '^16.3.1'
        }
    }, null, 2);
    
    projectFiles['services/gateway/package.json'] = JSON.stringify({
        name: 'nexusgate-gateway',
        version: '1.0.0',
        main: 'src/server.js',
        scripts: {
            start: 'node src/server.js',
            dev: 'nodemon src/server.js'
        },
        dependencies: {
            express: '^4.18.2',
            'http-proxy-middleware': '^2.0.6',
            jsonwebtoken: '^9.0.2',
            redis: '^4.6.10',
            consul: '^1.1.0',
            opossum: '^8.1.0',
            pino: '^8.16.0',
            'prom-client': '^15.0.0',
            helmet: '^7.1.0',
            cors: '^2.8.5',
            axios: '^1.6.0',
            dotenv: '^16.3.1'
        }
    }, null, 2);
    
    // Write all files
    console.log('\\n📝 Writing files...\\n');
    
    for (const [filepath, content] of Object.entries(projectFiles)) {
        write(filepath, content);
        fileCount++;
    }
    
    console.log(\`\\n✅ Generated \${fileCount} files!\`);
    console.log('\\n🎯 Next steps:');
    console.log('  1. Run: setup-dirs.bat');
    console.log('  2. Run: node generate-everything.js');
    console.log('  3. Install deps: cd services/auth-service && npm install');
    console.log('  4. Generate keys: node scripts/generate-jwt-keys.js');
    console.log('  5. Start: docker-compose up -d');
}