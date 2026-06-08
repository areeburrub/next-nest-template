import fs from 'node:fs/promises';
import path from 'node:path';

const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    '.turbo',
    'coverage',
    'packages/create',
]);

const SKIP_FILES = new Set(['bun.lock', '.env', '.env.local']);

const TEXT_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.example',
    '.prisma',
    '.sql',
    '.css',
    '.html',
    '.txt',
    '.toml',
]);

export type PackageManager = 'bun' | 'npm' | 'pnpm';

export interface ProjectNames {
    kebab: string;
    snake: string;
    title: string;
    scope: string;
}

export function toKebabCase(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

export function toSnakeCase(kebab: string): string {
    return kebab.replace(/-/g, '_');
}

export function toTitleCase(kebab: string): string {
    return kebab
        .split('-')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function isValidProjectName(name: string): boolean {
    const kebab = toKebabCase(name);
    return kebab.length > 0 && /^[a-z][a-z0-9-]*$/.test(kebab);
}

export function buildProjectNames(name: string, scope?: string): ProjectNames {
    const kebab = toKebabCase(name);
    const snake = toSnakeCase(kebab);
    const title = toTitleCase(kebab);
    const scopeName = scope?.trim() || `@${kebab}`;
    const normalizedScope = scopeName.startsWith('@') ? scopeName : `@${scopeName}`;

    return {
        kebab,
        snake,
        title,
        scope: normalizedScope,
    };
}

export function buildDatabaseUrl(names: ProjectNames, port = 5434): string {
    return `postgresql://postgres:postgres@localhost:${port}/${names.snake}?schema=public`;
}

export function getReplacements(names: ProjectNames): Array<[string, string]> {
    return [
        ['@next-nest-template', names.scope],
        ['next-nest-template-postgres', `${names.kebab}-postgres`],
        ['next_nest_template_postgres_data', `${names.snake}_postgres_data`],
        ['create-next-nest-template', names.kebab],
        ['next-nest-template', names.kebab],
        ['next_nest_template', names.snake],
        ['Next Nest Template', names.title],
    ];
}

const TEMPLATE_ONLY_PATHS = [
    'packages/create',
    '.github/workflows/publish-cli.yml',
];

export async function pathExists(target: string): Promise<boolean> {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

export async function copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            await copyDirectory(srcPath, destPath);
            continue;
        }

        if (SKIP_FILES.has(entry.name)) continue;
        await fs.copyFile(srcPath, destPath);
    }
}

function shouldTransformFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    if (TEXT_EXTENSIONS.has(ext)) return true;
    if (filePath.endsWith('.env.example')) return true;
    if (path.basename(filePath) === 'LICENSE') return true;
    return false;
}

export async function transformProject(targetDir: string, names: ProjectNames): Promise<void> {
    const replacements = getReplacements(names);
    await walkAndTransform(targetDir, replacements);
}

async function walkAndTransform(dir: string, replacements: Array<[string, string]>): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            await walkAndTransform(fullPath, replacements);
            continue;
        }

        if (!shouldTransformFile(fullPath)) continue;

        let content = await fs.readFile(fullPath, 'utf8');
        for (const [from, to] of replacements) {
            content = content.split(from).join(to);
        }
        await fs.writeFile(fullPath, content, 'utf8');
    }
}

async function setDatabaseUrlInEnvFile(filePath: string, databaseUrl: string): Promise<void> {
    if (!(await pathExists(filePath))) return;

    let content = await fs.readFile(filePath, 'utf8');
    const databaseUrlLine = `DATABASE_URL="${databaseUrl}"`;

    if (/^DATABASE_URL=.*$/m.test(content)) {
        content = content.replace(/^DATABASE_URL=.*$/m, databaseUrlLine);
    } else {
        content = `${content.trimEnd()}\n${databaseUrlLine}\n`;
    }

    await fs.writeFile(filePath, content, 'utf8');
}

export async function setupEnvFiles(targetDir: string, names: ProjectNames): Promise<void> {
    const envCopies: Array<[string, string]> = [
        ['packages/database/.env.example', 'packages/database/.env'],
        ['apps/backend/.env.example', 'apps/backend/.env'],
        ['apps/website/.env.example', 'apps/website/.env.local'],
    ];

    for (const [from, to] of envCopies) {
        const source = path.join(targetDir, from);
        const destination = path.join(targetDir, to);
        if (!(await pathExists(source))) {
            throw new Error(`Missing environment template: ${from}`);
        }
        await fs.copyFile(source, destination);
    }

    const databaseUrl = buildDatabaseUrl(names);
    await setDatabaseUrlInEnvFile(path.join(targetDir, 'packages/database/.env'), databaseUrl);
    await setDatabaseUrlInEnvFile(path.join(targetDir, 'apps/backend/.env'), databaseUrl);
}

export async function removeTemplateOnlyPaths(targetDir: string): Promise<void> {
    for (const relPath of TEMPLATE_ONLY_PATHS) {
        const fullPath = path.join(targetDir, relPath);
        if (await pathExists(fullPath)) {
            await fs.rm(fullPath, { recursive: true, force: true });
        }
    }

    const workflowsDir = path.join(targetDir, '.github', 'workflows');
    if (await pathExists(workflowsDir)) {
        const entries = await fs.readdir(workflowsDir);
        if (entries.length === 0) {
            await fs.rm(workflowsDir, { recursive: true, force: true });
        }
    }

    const githubDir = path.join(targetDir, '.github');
    if (await pathExists(githubDir)) {
        const entries = await fs.readdir(githubDir);
        if (entries.length === 0) {
            await fs.rm(githubDir, { recursive: true, force: true });
        }
    }
}

export async function sanitizeRootPackageJson(
    targetDir: string,
    names: ProjectNames,
): Promise<void> {
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as Record<string, unknown>;

    pkg.name = names.kebab;
    pkg.description = `${names.title} — Next.js + NestJS + Clerk + Prisma monorepo`;

    if (pkg.scripts && typeof pkg.scripts === 'object') {
        delete (pkg.scripts as Record<string, string>).create;
    }

    delete pkg.repository;
    delete pkg.bugs;
    delete pkg.homepage;

    await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 4)}\n`);
}

export async function writeProjectReadme(
    targetDir: string,
    names: ProjectNames,
): Promise<void> {
    const readme = `# ${names.title}

A full-stack TypeScript monorepo powered by Next.js, NestJS, Clerk, Prisma, and Turborepo.

## Project structure

\`\`\`
${names.kebab}/
├── apps/
│   ├── backend/                 # NestJS API (port 3001)
│   └── website/                 # Next.js frontend (port 3000)
├── packages/
│   ├── database/                # Prisma schema, migrations, client
│   └── types/                   # Shared DTOs and response types
├── docker-compose.yml           # Local PostgreSQL
└── turbo.json
\`\`\`

Environment files are already created in each app package. Add your [Clerk](https://dashboard.clerk.com) keys before running the app.

## Database

\`\`\`bash
docker compose up -d
bun run db:migrate:deploy
\`\`\`

Default local connection:

\`\`\`
${buildDatabaseUrl(names)}
\`\`\`

## Development

\`\`\`bash
bun run dev
\`\`\`

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 |
| Backend | http://localhost:3001 |
| Prisma Studio | \`bun run db:studio\` |

## Packages

| Package | Description |
|---------|-------------|
| \`${names.scope}/backend\` | NestJS API |
| \`${names.scope}/website\` | Next.js app |
| \`${names.scope}/database\` | Prisma client and migrations |
| \`${names.scope}/types\` | Shared DTOs |

## License

MIT
`;

    await fs.writeFile(path.join(targetDir, 'README.md'), readme, 'utf8');
}

export async function finalizeScaffoldedProject(
    targetDir: string,
    names: ProjectNames,
): Promise<void> {
    await sanitizeRootPackageJson(targetDir, names);
    await writeProjectReadme(targetDir, names);

    const lockPath = path.join(targetDir, 'bun.lock');
    if (await pathExists(lockPath)) {
        await fs.rm(lockPath);
    }
}

export function getRunCommand(packageManager: PackageManager): string {
    return packageManager === 'npm' ? 'npm run' : `${packageManager} run`;
}
