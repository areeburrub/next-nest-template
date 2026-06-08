# Contributing

Thanks for helping improve **next-nest-template** and **create-next-nest-template**.

## Ways to contribute

- Report bugs or suggest features via [GitHub Issues](https://github.com/areeburrub/next-nest-template/issues)
- Fix bugs or add improvements via pull request
- Improve docs, examples, or the scaffold CLI
- Share feedback from using the template in a real project

## Development setup

### Prerequisites

- Node.js 20.19+
- [Bun](https://bun.sh) 1.3+
- Docker (for local PostgreSQL)
- A [Clerk](https://clerk.com) application for auth testing

### Clone and install

```bash
git clone https://github.com/areeburrub/next-nest-template.git
cd next-nest-template
bun install
```

### Environment files

```bash
cp .env.example .env
cp packages/database/.env.example packages/database/.env
cp apps/backend/.env.example apps/backend/.env
cp apps/website/.env.example apps/website/.env.local
```

Add your Clerk keys to the env files before running the apps.

### Database

```bash
docker compose up -d
bun run db:migrate:deploy
```

### Run the monorepo

```bash
bun run dev
```

Other useful commands:

```bash
bun run build
bun run lint
bun run check-types
bun run format
```

## Working on the scaffold CLI

The CLI lives in `packages/create`. Build and run it against the local template:

```bash
cd packages/create
bun run build
node dist/index.js my-test-app ../my-test-app --from-local --scope @my-test --no-install
```

Or from the repo root:

```bash
bun run create
```

### What to verify after CLI changes

Generated projects should:

- Contain only `apps/backend`, `apps/website`, `packages/database`, and `packages/types`
- **Not** include `packages/create` or `.github/workflows/publish-cli.yml`
- Use the chosen scope (e.g. `@my-saas/backend`) in package names and imports
- Ship a project-specific `README.md` and root `package.json` without template repo links

## Pull requests

1. Fork the repository and create a branch from `main`
2. Keep changes focused — one concern per PR when possible
3. Run checks before opening the PR:

```bash
bun run build
bun run lint
bun run check-types
```

4. If you changed `packages/create`, test scaffolding with `--from-local`
5. Open a PR with a clear description of what changed and why

### Commit messages

Use clear, descriptive messages. Examples:

- `fix(create): remove publish workflow from scaffolded projects`
- `feat(backend): add health check endpoint`
- `docs: update README quick start`

## Project layout for contributors

| Path | Purpose |
|------|---------|
| `apps/backend` | NestJS API |
| `apps/website` | Next.js frontend |
| `packages/database` | Prisma schema and client |
| `packages/types` | Shared DTOs |
| `packages/create` | Scaffold CLI (not included in generated projects) |
| `.github/workflows/publish-cli.yml` | Publishes the CLI on merge to `main` |

## Releasing the CLI

The `create-next-nest-template` package is published automatically when changes merge to `main` and touch `packages/create/**`.

- Patch versions are auto-bumped in CI if the current version is already on npm
- For a **minor** or **major** release, bump `version` in `packages/create/package.json` in your PR

See [packages/create/PUBLISHING.md](./packages/create/PUBLISHING.md) for Trusted Publishing setup and workflow details.

## Code style

- Match existing patterns in the file you are editing
- TypeScript with strict typing
- Run `bun run format` for Prettier formatting
- Avoid drive-by refactors unrelated to your change

## Questions

Open a [GitHub Issue](https://github.com/areeburrub/next-nest-template/issues) if something is unclear or you want feedback before starting a larger change.
