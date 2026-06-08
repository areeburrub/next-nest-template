#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import { downloadTemplate } from 'giget';
import { execa } from 'execa';
import pc from 'picocolors';
import {
    buildProjectNames,
    copyDirectory,
    isValidProjectName,
    pathExists,
    finalizeScaffoldedProject,
    removeTemplateOnlyPaths,
    setupEnvFiles,
    toKebabCase,
    transformProject,
} from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_TEMPLATE =
    process.env.NEXT_NEST_TEMPLATE_REPO ?? 'github:areeburrub/next-nest-template';

interface CliOptions {
    projectName?: string;
    targetDir?: string;
    fromLocal: boolean;
    template: string;
    install: boolean;
    git: boolean;
    scope?: string;
    packageManager: 'bun' | 'npm' | 'pnpm';
}

function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = {
        fromLocal: false,
        template: DEFAULT_TEMPLATE,
        install: true,
        git: true,
        packageManager: 'bun',
    };

    const positional: string[] = [];

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--from-local') {
            options.fromLocal = true;
        } else if (arg === '--no-install') {
            options.install = false;
        } else if (arg === '--no-git') {
            options.git = false;
        } else if (arg === '--template' && argv[i + 1]) {
            options.template = argv[++i];
        } else if (arg === '--scope' && argv[i + 1]) {
            options.scope = argv[++i];
        } else if (arg === '--pm' && argv[i + 1]) {
            const pm = argv[++i] as CliOptions['packageManager'];
            if (pm === 'bun' || pm === 'npm' || pm === 'pnpm') {
                options.packageManager = pm;
            }
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else if (!arg.startsWith('-')) {
            positional.push(arg);
        }
    }

    if (positional[0]) options.projectName = positional[0];
    if (positional[1]) options.targetDir = positional[1];

    return options;
}

function printHelp(): void {
    console.log(`
${pc.bold('create-next-nest-template')} — Scaffold a NestJS + Next.js + Clerk + Prisma monorepo

${pc.bold('Usage')}
  npx create-next-nest-template [project-name] [directory]
  bunx create-next-nest-template [project-name] [directory]

${pc.bold('Options')}
  --from-local          Use the local monorepo as template (for development)
  --template <source>   Giget source (default: ${DEFAULT_TEMPLATE})
  --scope <@scope>      npm scope for packages (default: @project-name)
  --pm <bun|npm|pnpm>   Package manager (default: bun)
  --no-install          Skip dependency installation
  --no-git              Skip git init
  -h, --help            Show this help

${pc.bold('Examples')}
  npx create-next-nest-template my-saas
  bunx create-next-nest-template my-saas ./my-saas --scope @myorg
  node packages/create/dist/index.js demo --from-local
`);
}

function hasAllCliArgs(options: CliOptions): boolean {
    return Boolean(
        options.projectName &&
            (options.targetDir || options.projectName) &&
            options.scope &&
            (process.argv.includes('--pm') ||
                process.argv.includes('--no-install') ||
                process.argv.includes('--no-git')),
    );
}

async function promptForMissing(options: CliOptions): Promise<{
    projectName: string;
    targetDir: string;
    scope: string;
    packageManager: CliOptions['packageManager'];
    install: boolean;
    git: boolean;
}> {
    if (hasAllCliArgs(options)) {
        const kebab = toKebabCase(options.projectName!);
        return {
            projectName: kebab,
            targetDir: options.targetDir ?? kebab,
            scope: options.scope!,
            packageManager: options.packageManager,
            install: options.install,
            git: options.git,
        };
    }

    p.intro(pc.bgCyan(pc.black(' create-next-nest-template ')));

    let projectName = options.projectName;
    if (!projectName) {
        const answer = await p.text({
            message: 'Project name',
            placeholder: 'my-saas-app',
            validate: (value) => {
                if (!value?.trim()) return 'Project name is required';
                if (!isValidProjectName(value)) {
                    return 'Use letters, numbers, and hyphens only';
                }
            },
        });
        if (p.isCancel(answer)) process.exit(0);
        projectName = answer;
    }

    const kebab = toKebabCase(projectName);
    if (!isValidProjectName(kebab)) {
        p.cancel(`Invalid project name: ${projectName}`);
        process.exit(1);
    }

    let targetDir = options.targetDir ?? kebab;
    if (!options.targetDir && !options.projectName) {
        const dirAnswer = await p.text({
            message: 'Directory',
            defaultValue: kebab,
            validate: (value) => {
                if (!value?.trim()) return 'Directory is required';
            },
        });
        if (p.isCancel(dirAnswer)) process.exit(0);
        targetDir = dirAnswer;
    }

    let scope = options.scope;
    if (!scope) {
        const scopeAnswer = await p.text({
            message: 'Package scope',
            defaultValue: `@${kebab}`,
            validate: (value) => {
                if (!value?.trim()) return 'Scope is required';
                if (!value.startsWith('@')) return 'Scope must start with @';
            },
        });
        if (p.isCancel(scopeAnswer)) process.exit(0);
        scope = scopeAnswer;
    }

    let packageManager = options.packageManager;
    if (!process.argv.includes('--pm')) {
        const pmAnswer = await p.select({
            message: 'Package manager',
            options: [
                { value: 'bun', label: 'bun (recommended)' },
                { value: 'npm', label: 'npm' },
                { value: 'pnpm', label: 'pnpm' },
            ],
            initialValue: 'bun',
        });
        if (p.isCancel(pmAnswer)) process.exit(0);
        packageManager = pmAnswer as CliOptions['packageManager'];
    }

    let install = options.install;
    let git = options.git;
    if (!process.argv.includes('--no-install')) {
        const installAnswer = await p.confirm({
            message: 'Install dependencies?',
            initialValue: true,
        });
        if (p.isCancel(installAnswer)) process.exit(0);
        install = installAnswer;
    }
    if (!process.argv.includes('--no-git')) {
        const gitAnswer = await p.confirm({
            message: 'Initialize git repository?',
            initialValue: true,
        });
        if (p.isCancel(gitAnswer)) process.exit(0);
        git = gitAnswer;
    }

    return { projectName: kebab, targetDir, scope, packageManager, install, git };
}

async function downloadOrCopyTemplate(
    targetDir: string,
    options: CliOptions,
): Promise<void> {
    const absoluteTarget = path.resolve(targetDir);

    if (await pathExists(absoluteTarget)) {
        const entries = await fs.readdir(absoluteTarget);
        if (entries.length > 0) {
            throw new Error(`Directory already exists and is not empty: ${absoluteTarget}`);
        }
    }

    if (options.fromLocal) {
        const templateRoot = path.resolve(__dirname, '../../..');
        p.log.step(`Copying from local template: ${templateRoot}`);
        await copyDirectory(templateRoot, absoluteTarget);
        return;
    }

    p.log.step(`Downloading template: ${options.template}`);
    const { dir } = await downloadTemplate(options.template, {
        dir: absoluteTarget,
        force: true,
    });
    p.log.success(`Template downloaded to ${dir}`);
}

async function runInstall(
    targetDir: string,
    packageManager: CliOptions['packageManager'],
): Promise<void> {
    const absoluteTarget = path.resolve(targetDir);
    const installCmd =
        packageManager === 'bun'
            ? ['bun', 'install']
            : packageManager === 'pnpm'
              ? ['pnpm', 'install']
              : ['npm', 'install'];

    const spinner = p.spinner();
    spinner.start(`Installing dependencies with ${packageManager}...`);
    await execa(installCmd[0], installCmd.slice(1), {
        cwd: absoluteTarget,
        stdio: 'inherit',
    });
    spinner.stop('Dependencies installed');
}

async function runGitInit(targetDir: string): Promise<void> {
    const absoluteTarget = path.resolve(targetDir);
    const spinner = p.spinner();
    spinner.start('Initializing git repository...');
    await execa('git', ['init'], { cwd: absoluteTarget, stdio: 'ignore' });
    spinner.stop('Git repository initialized');
}

function printNextSteps(
    targetDir: string,
    names: ReturnType<typeof buildProjectNames>,
    packageManager: string,
): void {
    const run = packageManager === 'npm' ? 'npm run' : `${packageManager} run`;

    p.note(
        [
            `cd ${targetDir}`,
            'cp .env.example .env',
            'cp packages/database/.env.example packages/database/.env',
            'cp apps/backend/.env.example apps/backend/.env',
            'cp apps/website/.env.example apps/website/.env.local',
            '# Add your Clerk keys to the env files',
            'docker compose up -d',
            `${run} db:migrate:deploy`,
            `${run} dev`,
        ].join('\n'),
        'Next steps',
    );

    p.outro(
        `${pc.green('Success!')} Created ${pc.cyan(names.title)} at ${pc.cyan(path.resolve(targetDir))}`,
    );
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));

    try {
        const answers = await promptForMissing(options);
        const names = buildProjectNames(answers.projectName, answers.scope);
        const absoluteTarget = path.resolve(answers.targetDir);

        const s = p.spinner();
        s.start('Creating project...');

        await downloadOrCopyTemplate(answers.targetDir, options);
        await removeTemplateOnlyPaths(absoluteTarget);
        await transformProject(absoluteTarget, names);
        await finalizeScaffoldedProject(absoluteTarget, names);
        await setupEnvFiles(absoluteTarget);

        s.stop(`Project scaffolded at ${answers.targetDir}`);

        if (answers.install) {
            await runInstall(answers.targetDir, answers.packageManager);
        }

        if (answers.git) {
            await runGitInit(answers.targetDir);
        }

        printNextSteps(answers.targetDir, names, answers.packageManager);
    } catch (error) {
        p.cancel(error instanceof Error ? error.message : 'Failed to create project');
        process.exit(1);
    }
}

main();
