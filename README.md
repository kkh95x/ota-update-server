# CUSTOM_OS_NAME OTA Update Server

Self-hosted OTA platform for a GrapheneOS-based custom Android build (Pixel devices).

## Stack

- **Monorepo:** pnpm + Turborepo
- **Dashboard:** Next.js 15 (App Router)
- **Worker:** BullMQ + Redis
- **Database:** PostgreSQL + Prisma
- **Storage:** MinIO (S3-compatible) in Docker Compose
- **Domain:** `https://release.mod-syria.org/`

## Quick start (development)

### 1. Prerequisites

- Node.js 22+
- pnpm 9 (`corepack enable` or `npx pnpm`)
- Docker + Docker Compose

### 2. Infrastructure

```bash
# Generate passwords and sync .env files (Windows or Ubuntu)
pnpm generate-env
# Or directly:
#   Windows:  .\scripts\generate-env.ps1
#   Ubuntu:   bash scripts/generate-env.sh
# Re-copy templates first:  -Force / --force

cd infra/docker
docker compose up -d postgres redis minio minio-init
```

### 3. Application

```bash
cd ../..
# Root .env is created by generate-env (or copy .env.example manually)

# Windows: pnpm is usually not global — use from repo root:
#   npm run db:push
#   .\run-pnpm.cmd db:push
#   node scripts/run-pnpm.mjs install

node scripts/run-pnpm.mjs install
npm run db:generate
npm run db:push
npm run db:seed
npm run create-admin -- admin@example.com "YourSecurePassword123!"
npm run dev
```

- Dashboard: http://localhost:3000/admin
- Health: http://localhost:3000/health/ready

### 4. Create first admin (one-time)

```bash
npm run create-admin -- admin@example.com "YourSecurePassword"
```

## Documentation

- [GrapheneOS Updater protocol](docs/grapheneos-updater-protocol. -md)
- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Device groups & rollouts](docs/device-groups-and-rollouts.md)
- [Observability & logging](docs/observability-and-logging.md)
- [Update pause controls](docs/update-pause-controls.md)

## Project stages

| Stage | Status |
|-------|--------|
| 1 Discovery | Done |
| 2 Foundation | Done |
| 3 Release management | In progress |
| 4 OTA protocol | Planned |

See [implementation plan](docs/implementation-plan.md).
