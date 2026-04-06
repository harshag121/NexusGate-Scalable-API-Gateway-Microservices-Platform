# 🚀 NexusGate - Production-Grade API Gateway & Microservices Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-%3E%3D24.0-blue)](https://www.docker.com/)

A production-ready API Gateway with microservices architecture featuring JWT authentication, rate limiting, circuit breakers, service discovery, event streaming, and comprehensive observability.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Services](#services)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Testing](#testing)

## ✨ Features

### API Gateway
- **Dynamic Routing** - Route requests to appropriate microservices
- **JWT Authentication** - RS256 algorithm with access & refresh tokens
- **Rate Limiting** - Token bucket algorithm with Redis backend
- **Circuit Breaker** - Automatic failover using Opossum
- **Request Aggregation** - BFF pattern for complex client needs
- **Distributed Tracing** - Correlation ID propagation

### Microservices
- **Auth Service** - User registration, login, JWT token management
- **User Service** - User profile CRUD operations
- **Order Service** - Order management with saga pattern
- **Notification Service** - Event-driven notifications

### Infrastructure
- **Service Discovery** - HashiCorp Consul
- **Message Queue** - Apache Kafka
- **Caching** - Redis
- **Database** - PostgreSQL 15

### Observability
- **Metrics** - Prometheus
- **Tracing** - Jaeger
- **Logging** - Loki + Promtail
- **Dashboards** - Grafana

## 🏗️ Architecture

```
CLIENT → API GATEWAY (8080) → Microservices (3001-3004) → Infrastructure (PostgreSQL, Redis, Kafka) → Observability (Prometheus, Grafana, Jaeger)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### Installation

1. **Setup directories**
   ```batch
   setup-dirs.bat
   ```

2. **Generate project files**
   ```bash
   node build-project.js
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

4. **Start everything**
   ```bash
   docker-compose up -d
   ```

5. **Test**
   ```bash
   curl http://localhost:8080/health
   ```

## 📦 Services

- **Gateway** (8080) - API Gateway with routing, auth, rate limiting
- **Auth** (3001) - Authentication service  
- **User** (3002) - User management
- **Order** (3003) - Order processing
- **Notification** (3004) - Event-driven notifications

## ⚙️ Configuration

See `.env.example` for all configuration options.

## 📊 Monitoring

- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686
- Consul: http://localhost:8500

## 🧪 Testing

```bash
npm run test:load
```

## 📝 License

MIT License

---

**NexusGate** - Production-Grade API Gateway & Microservices Platform