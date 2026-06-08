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

export function getReplacements(names: ProjectNames): Array<[string, string]> {
    return [
        ['@next-nest-template', names.scope],
        ['next-nest-template-postgres', `${names.kebab}-postgres`],
        ['next_nest_template_postgres_data', `${names.snake}_postgres_data`],
        ['next-nest-template', names.kebab],
        ['next_nest_template', names.snake],
        ['Next Nest Template', names.title],
    ];
}

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

export async function setupEnvFiles(targetDir: string): Promise<void> {
    const envCopies: Array<[string, string]> = [
        ['.env.example', '.env'],
        ['packages/database/.env.example', 'packages/database/.env'],
        ['apps/backend/.env.example', 'apps/backend/.env'],
        ['apps/website/.env.example', 'apps/website/.env.local'],
    ];

    for (const [from, to] of envCopies) {
        const source = path.join(targetDir, from);
        const destination = path.join(targetDir, to);
        if (await pathExists(source)) {
            await fs.copyFile(source, destination);
        }
    }
}

export async function removeCreatePackage(targetDir: string): Promise<void> {
    const createPath = path.join(targetDir, 'packages', 'create');
    if (await pathExists(createPath)) {
        await fs.rm(createPath, { recursive: true, force: true });
    }
}
