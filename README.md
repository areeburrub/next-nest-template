# next-nest-template

A production-ready monorepo boilerplate for full-stack TypeScript applications.

**Next.js** · **NestJS** · **Clerk** · **Prisma 7** · **Turborepo** · **Bun**

Scaffold a new project with the CLI, clone this repo to contribute, or fork and customize. Auth, database sync, API validation, and frontend patterns are already wired up.

## What's included

- **Turborepo monorepo** with Bun workspaces
- **NestJS API** with global validation, Clerk auth guard, and user sync
- **Next.js 16** App Router with landing page, protected dashboard, and shadcn/ui sidebar
- **Clerk authentication** on frontend (middleware) and backend (JWT verification)
- **Prisma 7** with PostgreSQL adapter, migrations, and Docker Compose for local dev
- **Shared types package** with `class-validator` DTOs used by API controllers and server actions
- **Dark mode** with theme toggle
- **Server actions** pattern for authenticated API calls from Next.js
- **Scaffold CLI** (`create-next-nest-template`) published to npm

## Tech stack

| Layer | Technology |
|-------|------------|
| Monorepo | [Turborepo](https://turbo.build) + [Bun](https://bun.sh) workspaces |
| API | [NestJS](https://nestjs.com) |
| Frontend | [Next.js 16](https://nextjs.org), Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com) |
| Auth | [Clerk](https://clerk.com) |
| Database | [Prisma 7](https://prisma.io) + PostgreSQL |
| Types | Shared DTOs with `class-validator` |

## Project structure

This repository is the **template source**. It includes the scaffold CLI under `packages/create`.

```
next-nest-template/
├── apps/
│   ├── backend/                 # NestJS API (port 3001)
│   │   └── src/
│   │       ├── common/guards/   # ClerkAuthGuard
│   │       ├── common/decorators/
│   │       └── user/            # User module (Clerk ↔ DB sync)
│   └── website/                 # Next.js frontend (port 3000)
│       └── src/
│           ├── app/
│           │   ├── (landing)/   # Public landing page (/)
│           │   ├── (dashboard)/ # Protected dashboard (/dashboard)
│           │   ├── sign-in/
│           │   └── sign-up/
│           ├── _actions/        # Server actions → backend API
│           └── components/      # UI + shadcn components
├── packages/
│   ├── create/                  # create-next-nest-template CLI (template only)
│   ├── database/                # Prisma schema, migrations, client
│   └── types/                   # Shared DTOs and response types
├── docker-compose.yml           # Local PostgreSQL
└── turbo.json
```

When someone scaffolds a new project, the CLI removes template-only files (`packages/create`, publish workflow) and renames packages to their project scope. The generated app only contains `apps/` and `packages/database` + `packages/types`.

## Quick start

### Option A — Scaffold with CLI (recommended)

```bash
npx create-next-nest-template my-app
cd my-app
```

The CLI asks for a **project name** and **package manager**. It then:

- Creates a `./my-app` directory with scope `@my-app`
- Renames `@next-nest-template/*` packages to your project scope
- Removes template-only files (`packages/create`, CI publish workflow)
- Creates `.env` and `.env.local` files with the correct `DATABASE_URL`
- Installs dependencies and initializes git
- Starts PostgreSQL via Docker/Podman (if available) and runs migrations

### Option B — Clone directly

Use this when contributing to the template or working from a fork:

```bash
git clone https://github.com/areeburrub/next-nest-template.git
cd next-nest-template
bun install
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and pull request guidelines.

### Environment setup

```bash
cp .env.example .env
cp packages/database/.env.example packages/database/.env
cp apps/backend/.env.example apps/backend/.env
cp apps/website/.env.example apps/website/.env.local
```

Add your [Clerk](https://dashboard.clerk.com) keys to the env files.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `BACKEND_URL` | API URL (`http://localhost:3001`) |
| `WEBSITE_URL` | Frontend URL for CORS (`http://localhost:3000`) |

### Database

```bash
docker compose up -d
bun run db:migrate:deploy
```

Default local connection:

```
postgresql://postgres:postgres@localhost:5434/next_nest_template
```

### Run locally

```bash
bun run dev
```

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 |
| Backend | http://localhost:3001 |
| Prisma Studio | `bun run db:studio` |

## Authentication

- **Public routes**: `/`, `/sign-in`, `/sign-up`
- **Protected routes**: everything else (e.g. `/dashboard`)
- **User sync**: on first protected visit, middleware calls `GET /user/me` to create the user in PostgreSQL from Clerk
- **Backend**: `ClerkAuthGuard` verifies Bearer tokens
- **Frontend**: `_actions/_base.ts` attaches the Clerk session token to API requests

After sign-in/sign-up, users are redirected to `/dashboard`.

## API

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/user/me` | Clerk | Get or sync current user |
| `PATCH` | `/user/me` | Clerk | Update current user |
| `DELETE` | `/user/me` | Clerk | Delete current user |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps |
| `bun run build` | Build all packages and apps |
| `bun run lint` | Lint all packages |
| `bun run db:migrate` | Create and apply a migration (dev) |
| `bun run db:migrate:deploy` | Apply migrations (CI/production) |
| `bun run db:studio` | Open Prisma Studio |
| `bun run create` | Run the scaffold CLI locally (`--from-local`) |

Run a single app:

```bash
cd apps/backend && bun run dev
cd apps/website && bun run dev
```

## Customization

### Rename for your product

Use the CLI — it renames packages, database names, and Docker resources automatically.

If you cloned manually, search and replace `@next-nest-template` with your scope (e.g. `@my-app`) across `package.json` files, imports, and `next.config.ts`.

### Add a database model

1. Edit `packages/database/prisma/schema.prisma`
2. Run `bun run db:migrate`
3. Add DTOs in `packages/types/src/dtos/`
4. Create a NestJS module in `apps/backend/src/`
5. Add server actions in `apps/website/src/_actions/`

### Add a dashboard page

```
apps/website/src/app/(dashboard)/my-feature/page.tsx
```

Register it in `(dashboard)/_components/app-sidebar.tsx`.

### Add shadcn components

```bash
cd apps/website
bunx shadcn@latest add <component>
```

## Validation errors (backend)

```json
{
  "statusCode": 400,
  "error_code": "VALIDATION_FAILED",
  "message": "email: email must be an email"
}
```

DTOs live in `packages/types` with `class-validator` decorators.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Local development setup
- Testing scaffold changes with `--from-local`
- Pull request expectations
- CLI release process

## Requirements

- Node.js 20.19+ (see `.nvmrc`)
- Bun 1.3+
- Docker (local PostgreSQL)
- Clerk application

## License

MIT
