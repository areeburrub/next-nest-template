#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import { downloadTemplate } from 'giget';
import { execa } from 'execa';
import pc from 'picocolors';
import {
    buildDatabaseUrl,
    buildProjectNames,
    copyDirectory,
    detectContainerRuntime,
    getRunCommand,
    isValidProjectName,
    pathExists,
    finalizeScaffoldedProject,
    removeTemplateOnlyPaths,
    runMigrations,
    setupEnvFiles,
    startDatabase,
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
        p.log.step(`Copying template from ${templateRoot}`);
        await copyDirectory(templateRoot, absoluteTarget);
        return;
    }

    p.log.step(`Downloading template from ${options.template}`);
    const { dir } = await downloadTemplate(options.template, {
        dir: absoluteTarget,
        force: true,
    });
    p.log.success(`Template ready at ${dir}`);
}

async function runInstall(
    targetDir: string,
    packageManager: PackageManager,
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
    spinner.stop(`Dependencies installed with ${packageManager}`);
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
    packageManager: PackageManager,
    databaseReady: boolean,
): void {
    const run = getRunCommand(packageManager);
    const steps = [
        `cd ${targetDir}`,
        'Add your Clerk keys to .env, apps/backend/.env, and apps/website/.env.local',
    ];

    if (!databaseReady) {
        steps.push(`Set DATABASE_URL in packages/database/.env`);
        steps.push(`${run} db:migrate:deploy`);
    }

    steps.push(`${run} dev`);

    p.note(steps.join('\n'), 'Next steps');

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

        p.log.step(`Creating ${names.title} in ./${answers.targetDir}`);
        p.log.info(`Package scope: ${names.scope}`);

        await downloadOrCopyTemplate(answers.targetDir, options);

        p.log.step('Removing template-only files...');
        await removeTemplateOnlyPaths(absoluteTarget);

        p.log.step('Renaming packages and configuration...');
        await transformProject(absoluteTarget, names);
        await finalizeScaffoldedProject(absoluteTarget, names);

        p.log.step('Creating environment files...');
        await setupEnvFiles(absoluteTarget, names);
        p.log.success('Created .env, packages/database/.env, apps/backend/.env, apps/website/.env.local');

        if (options.install) {
            await runInstall(answers.targetDir, answers.packageManager);
        } else {
            p.log.info('Skipped dependency installation (--no-install)');
        }

        if (options.git) {
            await runGitInit(answers.targetDir);
        } else {
            p.log.info('Skipped git init (--no-git)');
        }

        let databaseReady = false;
        const runtime = await detectContainerRuntime();

        const showDatabaseSetupHelp = (): void => {
            p.log.info(`Set DATABASE_URL in packages/database/.env`);
            p.log.info(`Default: ${buildDatabaseUrl(names)}`);
            p.log.info(`Then run: ${getRunCommand(answers.packageManager)} db:migrate:deploy`);
        };

        if (runtime) {
            const dockerSpinner = p.spinner();
            dockerSpinner.start(`Starting PostgreSQL with ${runtime} compose...`);
            try {
                await startDatabase(absoluteTarget, runtime);
                dockerSpinner.stop(`PostgreSQL is running (${runtime})`);

                if (options.install) {
                    const migrateSpinner = p.spinner();
                    migrateSpinner.start('Running database migrations...');
                    try {
                        await runMigrations(absoluteTarget, answers.packageManager);
                        migrateSpinner.stop('Database migrations applied');
                        databaseReady = true;
                    } catch (error) {
                        migrateSpinner.stop('Database migrations failed');
                        p.log.warn(
                            error instanceof Error
                                ? error.message
                                : 'Could not apply database migrations',
                        );
                        showDatabaseSetupHelp();
                    }
                } else {
                    p.log.info(
                        `Skipped database migrations (--no-install). Run ${getRunCommand(answers.packageManager)} db:migrate:deploy after installing dependencies.`,
                    );
                }
            } catch (error) {
                dockerSpinner.stop(`${runtime} compose failed`);
                p.log.warn(
                    error instanceof Error
                        ? error.message
                        : 'Could not start database containers',
                );
                showDatabaseSetupHelp();
            }
        } else {
            p.log.warn('No Docker or Podman detected.');
            showDatabaseSetupHelp();
        }

        printNextSteps(answers.targetDir, names, answers.packageManager, databaseReady);
    } catch (error) {
        p.cancel(error instanceof Error ? error.message : 'Failed to create project');
        process.exit(1);
    }
}

main();
