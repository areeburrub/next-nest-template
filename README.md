# nest-next-template

A clone-and-go monorepo boilerplate for full-stack TypeScript apps:

**NestJS** (API) · **Next.js** (frontend) · **Clerk** (auth) · **Prisma 7** (database) · **Turborepo** · **Bun**

Use this repo as a starting point for any product. Fork it, rename packages, and build on top of the auth, database, and API patterns already wired up.

## Create a new project (recommended)

Scaffold a fresh monorepo with the interactive CLI:

```bash
npx create-nest-next-template
# or
bunx create-nest-next-template
```

With a project name:

```bash
npx create-nest-next-template my-saas-app
bunx create-nest-next-template my-saas-app --scope @myorg
```

The CLI will:

1. Ask for project name, directory, and npm scope (`@my-app`)
2. Download this template from GitHub (or copy locally with `--from-local`)
3. Replace all `nest-next-template` / `@nest-next-template` references with your project name
4. Copy `.env.example` files to `.env`
5. Optionally install dependencies and run `git init`

**Options**

| Flag | Description |
|------|-------------|
| `--from-local` | Use the local repo as template (for CLI development) |
| `--template <source>` | Giget source (default: `github:YOUR_USERNAME/nest-next-template`) |
| `--scope @myorg` | npm scope for workspace packages |
| `--pm bun\|npm\|pnpm` | Package manager |
| `--no-install` | Skip dependency installation |
| `--no-git` | Skip `git init` |

**Publish the CLI** (maintainers): update `repository.url` and `NEST_NEXT_TEMPLATE_REPO` in `packages/create`, then:

```bash
cd packages/create && bun run build && npm publish --access public
```

**Local development**

```bash
bun run create -- my-test-app --from-local --no-install
```

## Tech stack

| Layer | Technology |
|-------|------------|
| Monorepo | [Turborepo](https://turbo.build) + [Bun](https://bun.sh) workspaces |
| API | [NestJS](https://nestjs.com) with global validation + Clerk guard |
| Frontend | [Next.js 16](https://nextjs.org) App Router, Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com) |
| Auth | [Clerk](https://clerk.com) (middleware, server actions, backend token verification) |
| Database | [Prisma 7](https://prisma.io) + PostgreSQL (`@prisma/adapter-pg`) |
| Shared types | `class-validator` DTOs consumed by NestJS controllers and Next.js server actions |

## Project structure

```
nest-next-template/
├── apps/
│   ├── backend/                 # NestJS API (default port 3001)
│   │   └── src/
│   │       ├── common/guards/   # ClerkAuthGuard
│   │       ├── common/decorators/
│   │       └── user/              # User module (Clerk ↔ DB sync)
│   └── website/                 # Next.js frontend (default port 3000)
│       └── src/
│           ├── app/
│           │   ├── (landing)/     # Public landing page (/)
│           │   ├── (dashboard)/   # Protected dashboard (/dashboard)
│           │   ├── sign-in/
│           │   └── sign-up/
│           ├── _actions/          # Server actions → backend API
│           └── components/        # UI + shadcn components
├── packages/
│   ├── create/                  # create-nest-next-template CLI (publishable)
│   ├── database/                # Prisma schema, migrations, client export
│   └── types/                   # Shared DTOs and response types
├── docker-compose.yml           # Local PostgreSQL
├── turbo.json
└── package.json
```

## Prerequisites

- **Node.js** 20.19+, 22.12+, or 24+ (required by Prisma 7). Run `nvm use` — `.nvmrc` is set to 22.
- **Bun** 1.3+ ([install](https://bun.sh/docs/installation))
- **Docker** (for local PostgreSQL)
- A **Clerk** application ([dashboard](https://dashboard.clerk.com))

## Quick start

### 1. Get the template

**Option A — CLI (recommended)**

```bash
npx create-nest-next-template my-app
cd my-app
```

**Option B — Clone manually**

```bash
git clone https://github.com/YOUR_USERNAME/nest-next-template.git my-app
cd my-app
```

### 2. Install dependencies

```bash
bun install
```

### 3. Set up environment variables

Copy the example env files and fill in your Clerk keys:

```bash
cp .env.example .env
cp packages/database/.env.example packages/database/.env
cp apps/backend/.env.example apps/backend/.env
cp apps/website/.env.example apps/website/.env.local
```

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | root, `packages/database`, `apps/backend` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | root, `apps/backend`, `apps/website` | Clerk secret key (backend + server actions) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/website` | Clerk publishable key |
| `BACKEND_URL` | `apps/website` | NestJS API URL (`http://localhost:3001`) |
| `WEBSITE_URL` | `apps/backend` | Next.js URL for CORS (`http://localhost:3000`) |
| `PORT` | `apps/backend` | Backend port (default `3001`) |

### 4. Start PostgreSQL

```bash
docker compose up -d
```

Default connection:

```
postgresql://postgres:postgres@localhost:5434/nest_next_template
```

Change the host port via `POSTGRES_PORT` in `.env` if 5434 is taken.

### 5. Run database migrations

```bash
bun run db:migrate:deploy
```

For a fresh dev database with interactive migration naming:

```bash
bun run db:migrate
```

### 6. Start development

```bash
bun run dev
```

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Prisma Studio | `bun run db:studio` |

## Clerk setup

1. Create a new application at [clerk.com](https://clerk.com).
2. Copy **Publishable key** and **Secret key** into your env files.
3. In the Clerk dashboard, set sign-in/sign-up paths to `/sign-in` and `/sign-up` (or match your env vars).
4. After sign-in/sign-up, users are redirected to `/dashboard` via `NEXT_PUBLIC_CLERK_*_FALLBACK_REDIRECT_URL`.

### How auth flows work

- **Frontend**: `src/proxy.ts` protects all routes except `/`, `/sign-in`, `/sign-up`.
- **First protected visit**: middleware calls `GET /user/me` to sync the Clerk user into PostgreSQL.
- **Backend**: `ClerkAuthGuard` verifies the Bearer token on protected endpoints.
- **Server actions**: `_actions/_base.ts` attaches the Clerk session token to axios requests.

## API reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/user/me` | Clerk | Get current user (syncs from Clerk if missing in DB) |
| `PATCH` | `/user/me` | Clerk | Update current user |
| `DELETE` | `/user/me` | Clerk | Delete current user |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in dev mode |
| `bun run build` | Build all packages and apps |
| `bun run lint` | Lint all packages |
| `bun run db:migrate` | Create and apply a new migration (dev) |
| `bun run db:migrate:deploy` | Apply migrations (CI/production) |
| `bun run db:studio` | Open Prisma Studio |
| `bun run build:backend` | Build backend + dependencies only |
| `bun run start:backend` | Run migrations + start backend |

Run a single app:

```bash
cd apps/backend && bun run dev
cd apps/website && bun run dev
```

## Customizing for your project

### Rename packages

Search and replace `@nest-next-template` with your scope (e.g. `@my-app`) in:

- `package.json` files (root + all workspaces)
- Import paths in `apps/backend` and `apps/website`
- `turbo.json` filter scripts in root `package.json`
- `next.config.ts` `transpilePackages`

### Add a Prisma model

1. Edit `packages/database/prisma/schema.prisma`
2. Run `bun run db:migrate`
3. Add DTOs in `packages/types/src/dtos/`
4. Create a NestJS module in `apps/backend/src/`
5. Add server actions in `apps/website/src/_actions/`

### Add a dashboard page

Create a route under `apps/website/src/app/(dashboard)/`:

```
(dashboard)/
  my-feature/
    page.tsx
```

Add a nav item in `(dashboard)/_components/app-sidebar.tsx`.

### Add shadcn components

```bash
cd apps/website
bunx shadcn@latest add <component>
```

## Validation (backend)

Global `ValidationPipe` in `apps/backend/src/main.ts` returns structured errors:

```json
{
  "statusCode": 400,
  "error_code": "VALIDATION_FAILED",
  "message": "email: email must be an email"
}
```

DTOs live in `packages/types` and use `class-validator` decorators.

## Production notes

- Set `NODE_ENV=production`
- Use managed PostgreSQL and set `DATABASE_URL` accordingly
- Run `bun run db:migrate:deploy` before starting the backend
- Set Clerk production keys and configure allowed origins in the Clerk dashboard
- Build: `bun run build` then `cd apps/backend && bun run start` and `cd apps/website && bun run start`

## License

MIT — use freely as a boilerplate for your projects.
