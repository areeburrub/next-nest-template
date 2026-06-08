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
  --scope <@alias>      Override import alias (default: @project-name)
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

function shouldSkipPrompts(options: CliOptions): boolean {
    return Boolean(options.projectName && process.argv.includes('--pm'));
}

function logProjectPlan(
    targetDir: string,
    packageManager: PackageManager,
): void {
    console.log('');
    console.log(`Creating a new monorepo in ${path.resolve(targetDir)}.`);
    console.log('');
    console.log(`Using ${packageManager}.`);
    console.log('');
}

async function promptForMissing(options: CliOptions): Promise<ProjectAnswers> {
    let projectName = options.projectName;

    if (!shouldSkipPrompts(options)) {
        p.note(
            [
                'A full-stack Turborepo with NestJS, Next.js, Clerk, Prisma, and shadcn/ui.',
                'Your project name is used for the folder and import alias (my-app → @my-app).',
            ].join('\n'),
            'create-next-nest-template',
        );

        if (!projectName) {
            const answer = await p.text({
                message: 'What is your project named?',
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
    }

    if (!projectName) {
        p.cancel('Project name is required');
        process.exit(1);
    }

    const kebab = toKebabCase(projectName);
    if (!isValidProjectName(kebab)) {
        p.cancel(`Invalid project name: ${projectName}`);
        process.exit(1);
    }

    const defaultScope = `@${kebab}`;
    let packageManager = options.packageManager;
    let scope = options.scope ?? defaultScope;
    let targetDir = options.targetDir ?? kebab;

    if (!shouldSkipPrompts(options)) {
        const defaultsAnswer = await p.select({
            message: 'Would you like to use the recommended defaults?',
            options: [
                {
                    value: 'yes',
                    label: 'Yes, use recommended defaults',
                    hint: `bun · ${defaultScope} · ./${kebab}`,
                },
                {
                    value: 'no',
                    label: 'No, customize settings',
                    hint: 'package manager, import alias, directory',
                },
            ],
            initialValue: 'yes',
        });
        if (p.isCancel(defaultsAnswer)) process.exit(0);

        if (defaultsAnswer === 'no') {
            if (!process.argv.includes('--pm')) {
                const pmAnswer = await p.select({
                    message: 'Which package manager would you like to use?',
                    options: [
                        { value: 'bun', label: 'bun', hint: 'recommended' },
                        { value: 'npm', label: 'npm' },
                        { value: 'pnpm', label: 'pnpm' },
                    ],
                    initialValue: 'bun',
                });
                if (p.isCancel(pmAnswer)) process.exit(0);
                packageManager = pmAnswer as PackageManager;
            }

            if (!options.scope) {
                const customizeAlias = await p.confirm({
                    message: `Would you like to customize the import alias (\`${defaultScope}\` by default)?`,
                    initialValue: false,
                });
                if (p.isCancel(customizeAlias)) process.exit(0);

                if (customizeAlias) {
                    const aliasAnswer = await p.text({
                        message: 'What import alias would you like configured?',
                        placeholder: 'Used in imports like @my-app/backend',
                        defaultValue: defaultScope,
                        validate: (value) => {
                            if (!value?.trim()) return 'Import alias is required';
                            if (!value.startsWith('@')) return 'Import alias must start with @';
                        },
                    });
                    if (p.isCancel(aliasAnswer)) process.exit(0);
                    scope = aliasAnswer;
                }
            }

            if (!options.targetDir) {
                const dirAnswer = await p.text({
                    message: 'Where should the project be created?',
                    placeholder: 'Relative to your current directory',
                    defaultValue: kebab,
                    validate: (value) => {
                        if (!value?.trim()) return 'Directory is required';
                    },
                });
                if (p.isCancel(dirAnswer)) process.exit(0);
                targetDir = dirAnswer;
            }
        } else {
            packageManager = process.argv.includes('--pm')
                ? options.packageManager
                : 'bun';
            scope = options.scope ?? defaultScope;
            targetDir = options.targetDir ?? kebab;
        }
    }

    logProjectPlan(targetDir, packageManager);

    return {
        projectName: kebab,
        targetDir,
        scope,
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
        `${check} ${pc.cyan(`${summary.scope}/backend`)} ${pc.dim('(NestJS)')}`,
        `${check} ${pc.cyan(`${summary.scope}/website`)} ${pc.dim('(Next.js)')}`,
        `${check} ${pc.cyan(`${summary.scope}/database`)} ${pc.dim('(Prisma)')}`,
        `${check} shadcn/ui configured`,
        `${check} Clerk auth configured`,
    ];

    if (summary.envFiles) {
        completed.push(`${check} ${pc.cyan('packages/database/.env')} ${pc.dim('(Prisma)')}`);
        completed.push(`${check} ${pc.cyan('apps/backend/.env')} ${pc.dim('(NestJS)')}`);
        completed.push(`${check} ${pc.cyan('apps/website/.env.local')} ${pc.dim('(Next.js)')}`);
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
        'Add your Clerk keys to apps/backend/.env and apps/website/.env.local',
        `${run} dev`,
    ];

    p.note(nextSteps.join('\n'), 'Next steps');

    p.outro(
        `${pc.green('Success!')} Created ${pc.cyan(summary.title)} at ${pc.cyan(path.resolve(summary.projectPath))}`,
    );
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));

    try {
        const answers = await promptForMissing(options);
        const names = buildProjectNames(answers.projectName, answers.scope);
        const absoluteTarget = path.resolve(answers.targetDir);

        console.log('Initializing project with template: next-nest-template');
        console.log('');

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
            console.log('Installing dependencies:');
            console.log('');
            await runInstall(answers.targetDir, answers.packageManager);
            summary.installed = true;
        }

        if (options.git) {
            await runGitInit(answers.targetDir);
            summary.gitInit = true;
        }

        console.log('');
        console.log(`${pc.green('✓')} Project files generated successfully`);
        console.log('');

        printSummary(summary, answers.packageManager);
    } catch (error) {
        p.cancel(error instanceof Error ? error.message : 'Failed to create project');
        process.exit(1);
    }
}

main();
