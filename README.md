# Website Builder Monorepo

Turborepo monorepo with NestJS backend, Next.js website, Prisma database package, and shared types.

## Structure

```
apps/
  backend/     NestJS API (port 3001)
  website/     Next.js frontend (port 3000)
packages/
  database/    Prisma 7 + PostgreSQL
  types/       Shared DTOs and response types
```

## Requirements

- Node.js **20.19+**, **22.12+**, or **24+** (Prisma 7 requirement). Use `.nvmrc` with `nvm use`.
- [Bun](https://bun.sh) 1.3+
- PostgreSQL
- [Clerk](https://clerk.com) application

## Database (Docker)

Start PostgreSQL (host port **5434** — chosen because 5432, 5433, 5140, and 5544 are already in use):

```bash
docker compose up -d
```

Run migrations:

```bash
cd packages/database && bun run db:migrate:deploy
```

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy environment files and fill in values:

```bash
cp .env.example .env
cp packages/database/.env.example packages/database/.env
cp apps/backend/.env.example apps/backend/.env
cp apps/website/.env.example apps/website/.env.local
```

3. Run database migrations:

```bash
cd packages/database && bun run db:migrate:deploy
```

4. Build shared packages:

```bash
bun run build
```

## Development

Run all apps:

```bash
bun run dev
```

Or individually:

```bash
bun --filter @website-builder/backend dev
bun --filter @website-builder/website dev
```

## Key features

- **Backend**: Global `ValidationPipe` with custom error format, Clerk auth guard, user sync from Clerk to DB
- **Website**: Clerk auth, Tailwind CSS 4, shadcn/ui, server actions via `_actions/_base.ts`
- **Database**: Prisma 7 with `prisma.config.ts` and PostgreSQL adapter
- **Types**: Shared DTOs used by backend controllers and website server actions

## Clerk setup

1. Create a Clerk application
2. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in website and backend env files
3. Configure sign-in/sign-up URLs: `/sign-in` and `/sign-up`

## API

| Method | Route       | Auth   | Description              |
|--------|-------------|--------|--------------------------|
| GET    | `/user/me`  | Clerk  | Get or sync current user |
| PATCH  | `/user/me`  | Clerk  | Update current user      |
| DELETE | `/user/me`  | Clerk  | Delete current user      |
