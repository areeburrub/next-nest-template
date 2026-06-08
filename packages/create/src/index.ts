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
    getRunCommand,
    isValidProjectName,
    pathExists,
    finalizeScaffoldedProject,
    removeTemplateOnlyPaths,
    setupEnvFiles,
    toKebabCase,
    transformProject,
    type PackageManager,
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
    packageManager: PackageManager;
}

interface ProjectAnswers {
    projectName: string;
    targetDir: string;
    scope: string;
    packageManager: PackageManager;
}

interface SetupSummary {
    projectPath: string;
    scope: string;
    title: string;
    envFiles: boolean;
    installed: boolean;
    gitInit: boolean;
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
        } else if (arg === '--dir' && argv[i + 1]) {
            options.targetDir = argv[++i];
        } else if (arg === '--pm' && argv[i + 1]) {
            const pm = argv[++i] as PackageManager;
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

    return options;
}

function printHelp(): void {
    console.log(`
${pc.bold('create-next-nest-template')} — Scaffold a NestJS + Next.js + Clerk + Prisma monorepo

${pc.bold('Usage')}
  npx create-next-nest-template [project-name]
  bunx create-next-nest-template [project-name]

${pc.bold('Options')}
  --from-local          Use the local monorepo as template (for development)
  --template <source>   Giget source (default: ${DEFAULT_TEMPLATE})
  --dir <path>          Output directory (default: project name)
  --scope <@scope>      Override package scope (default: @project-name)
  --pm <bun|npm|pnpm>   Package manager (default: bun)
  --no-install          Skip dependency installation
  --no-git              Skip git init
  -h, --help            Show this help

${pc.bold('Examples')}
  npx create-next-nest-template my-saas
  bunx create-next-nest-template my-saas --pm pnpm
  node packages/create/dist/index.js demo --from-local --dir ../demo
`);
}

async function promptForMissing(options: CliOptions): Promise<ProjectAnswers> {
    if (options.projectName && process.argv.includes('--pm')) {
        const kebab = toKebabCase(options.projectName);
        return {
            projectName: kebab,
            targetDir: options.targetDir ?? kebab,
            scope: options.scope ?? `@${kebab}`,
            packageManager: options.packageManager,
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
        packageManager = pmAnswer as PackageManager;
    }

    return {
        projectName: kebab,
        targetDir: options.targetDir ?? kebab,
        scope: options.scope ?? `@${kebab}`,
        packageManager,
    };
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
        await copyDirectory(templateRoot, absoluteTarget);
        return;
    }

    await downloadTemplate(options.template, {
        dir: absoluteTarget,
        force: true,
    });
}

async function runInstall(
    targetDir: string,
    packageManager: PackageManager,
): Promise<void> {
    const installCmd =
        packageManager === 'bun'
            ? ['bun', 'install']
            : packageManager === 'pnpm'
              ? ['pnpm', 'install']
              : ['npm', 'install'];

    await execa(installCmd[0], installCmd.slice(1), {
        cwd: path.resolve(targetDir),
        stdio: 'inherit',
    });
}

async function runGitInit(targetDir: string): Promise<void> {
    await execa('git', ['init'], {
        cwd: path.resolve(targetDir),
        stdio: 'ignore',
    });
}

function printSummary(
    summary: SetupSummary,
    packageManager: PackageManager,
): void {
    const check = pc.green('✓');
    const run = getRunCommand(packageManager);

    const completed = [
        `${check} ${pc.bold(summary.title)} created at ${pc.cyan(summary.projectPath)}`,
        `${check} ${pc.cyan(`${summary.scope}/backend`)} ${pc.dim('(NestJS)')}`,
        `${check} ${pc.cyan(`${summary.scope}/website`)} ${pc.dim('(Next.js)')}`,
        `${check} ${pc.cyan(`${summary.scope}/database`)} ${pc.dim('(Prisma)')}`,
        `${check} shadcn/ui configured`,
        `${check} Clerk auth configured`,
    ];

    if (summary.envFiles) {
        completed.push(`${check} Environment files configured`);
    }

    if (summary.installed) {
        completed.push(`${check} Dependencies installed with ${pc.cyan(packageManager)}`);
    }

    if (summary.gitInit) {
        completed.push(`${check} Git repository initialized`);
    }

    console.log('');
    for (const line of completed) {
        console.log(`  ${line}`);
    }

    const nextSteps = [
        `cd ${summary.projectPath}`,
        'docker compose up -d',
        `${run} db:migrate:deploy`,
        'Add your Clerk keys to .env, apps/backend/.env, and apps/website/.env.local',
        `${run} dev`,
    ];

    p.note(nextSteps.join('\n'), 'Next steps');

    p.outro(`${pc.green('You are all set!')} Happy building.`);
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));

    try {
        const answers = await promptForMissing(options);
        const names = buildProjectNames(answers.projectName, answers.scope);
        const absoluteTarget = path.resolve(answers.targetDir);

        const spinner = p.spinner();
        spinner.start('Creating your project...');

        await downloadOrCopyTemplate(answers.targetDir, options);
        await removeTemplateOnlyPaths(absoluteTarget);
        await transformProject(absoluteTarget, names);
        await finalizeScaffoldedProject(absoluteTarget, names);
        await setupEnvFiles(absoluteTarget, names);

        const summary: SetupSummary = {
            projectPath: answers.targetDir,
            scope: names.scope,
            title: names.title,
            envFiles: true,
            installed: false,
            gitInit: false,
        };

        if (options.install) {
            spinner.message('Installing dependencies...');
            await runInstall(answers.targetDir, answers.packageManager);
            summary.installed = true;
        }

        if (options.git) {
            spinner.message('Initializing git...');
            await runGitInit(answers.targetDir);
            summary.gitInit = true;
        }

        spinner.stop('Project ready');

        printSummary(summary, answers.packageManager);
    } catch (error) {
        p.cancel(error instanceof Error ? error.message : 'Failed to create project');
        process.exit(1);
    }
}

main();
