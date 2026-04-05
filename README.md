# Application Configuration Management Platform

A dynamic feature flag and configuration management system that enables real-time control of application behavior without code deployments.

## Architecture

The system consists of three main components:

- **Backend API** (NestJS): REST API for configuration management, rule evaluation, and authentication
- **Dashboard** (Next.js): Web interface for managing configurations and rules
- **SDK** (TypeScript): Lightweight client library for fetching and caching configurations

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for PostgreSQL and Redis)

### 1. Start Database Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5433
- Redis on port 6379

The database schema will be automatically initialized from `backend/database/schema.sql`.

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

The backend API will be available at http://localhost:3000

### 3. Dashboard Setup

```bash
cd dashboard
npm install
cp .env.example .env
npm run dev
```

The dashboard will be available at http://localhost:3001

### 4. SDK Usage

```bash
cd sdk
npm install
npm run build
```

Example usage:

```typescript
import { ConfigClient } from '@config-management/sdk';

const client = new ConfigClient({
  apiKey: 'your-api-key',
  apiUrl: 'http://localhost:3000',
  projectId: 'project-id',
  environmentId: 'env-id',
}, {
  user_id: 'user-123',
  region: 'us-east-1',
});

const featureEnabled = await client.get('feature.new_ui', false);
```

## Testing

### Backend Tests

```bash
cd backend
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:cov        # With coverage
```

### Dashboard Tests

```bash
cd dashboard
npm test
```

### SDK Tests

```bash
cd sdk
npm test
```

## Project Structure

```
.
├── backend/              # NestJS backend API
│   ├── src/             # Source code
│   ├── database/        # Database schema and migrations
│   └── package.json
├── dashboard/           # Next.js dashboard
│   ├── src/            # Source code
│   └── package.json
├── sdk/                # TypeScript SDK
│   ├── src/           # Source code
│   └── package.json
└── docker-compose.yml  # PostgreSQL and Redis services
```

## Features

- ✅ Configuration key management with version history
- ✅ Context-aware rule evaluation
- ✅ Percentage-based rollouts
- ✅ Multi-layer caching (SDK → Redis → PostgreSQL)
- ✅ Role-based access control (RBAC)
- ✅ Comprehensive audit logging
- ✅ High availability with graceful degradation
- ✅ Multi-tenancy (Organizations → Projects → Environments)
- ✅ SDK with offline-first design

## License

MIT
