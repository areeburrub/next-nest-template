# Publishing `create-next-nest-template`

Uses **npm Trusted Publishing** (OIDC). No long-lived npm tokens.

## One-time setup

### 1. First publish (from your machine)

```bash
cd packages/create
bun run build
npm login
npm publish
```

### 2. Trusted Publisher on npm

[npmjs.com/package/create-next-nest-template](https://www.npmjs.com/package/create-next-nest-template) → **Settings** → **Trusted Publisher** → **GitHub Actions**

| Field | Value |
|-------|-------|
| Organization or user | `areeburrub` |
| Repository | `next-nest-template` |
| Workflow filename | `publish-cli.yml` |
| Allowed actions | `npm publish` |

## Automatic publish on merge to `main`

When a PR is merged into `main` and changes touch `packages/create/**`:

1. Workflow runs [publish-cli.yml](../../.github/workflows/publish-cli.yml)
2. If the current version is already on npm → auto-bumps **patch** version (e.g. `0.1.0` → `0.1.1`)
3. Builds and publishes to npm via Trusted Publishing
4. Commits the version bump back to `main` with `[skip ci]`

You do **not** need to manually bump the version for routine CLI updates.

To release a **minor** or **major** version, bump `version` in `packages/create/package.json` in your PR before merging.

## Requirements

- Trusted Publishing enabled on npm
- `permissions: id-token: write` in the workflow
- npm CLI ≥ 11.5.1 in CI
- GitHub-hosted runners
