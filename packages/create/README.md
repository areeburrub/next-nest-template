# create-next-nest-template

CLI to scaffold a **Next.js + NestJS + Clerk + Prisma** Turborepo monorepo.

## Usage

```bash
npx create-next-nest-template
bunx create-next-nest-template my-app
```

## Options

| Flag | Description |
|------|-------------|
| `--from-local` | Use local repo as template (development) |
| `--template <source>` | Giget source (default: `github:areeburrub/next-nest-template`) |
| `--scope @myorg` | npm scope for workspace packages |
| `--pm bun\|npm\|pnpm` | Package manager |
| `--no-install` | Skip install |
| `--no-git` | Skip git init |

## Publish

Publishes automatically on push to `main` when this package changes (see `.github/workflows/publish-cli.yml`).

Requires `NPM_TOKEN` GitHub secret. Bump `version` in `package.json` before each release.

Manual publish:

```bash
npm login
bun run build
npm publish
```

Template repo: [next-nest-template](https://github.com/areeburrub/next-nest-template)
