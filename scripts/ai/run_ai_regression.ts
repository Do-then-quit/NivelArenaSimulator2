import { spawnSync } from 'node:child_process';
import { loadPhase0Manifest, resolvePhase0ManifestPath } from './phase0_manifest';

function parseBoolEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function runCommand(command: string, args: string[]): void {
    const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
    if (result.error) {
        throw new Error(`Command execution error: ${command} ${args.join(' ')} :: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`Command failed (exit=${result.status}): ${command} ${args.join(' ')}`);
    }
}

function runAiRegression(): void {
    const manifest = loadPhase0Manifest(resolvePhase0ManifestPath());
    const vitestFiles = manifest.regression.vitestFiles;
    if (vitestFiles.length === 0) {
        throw new Error('No vitest files configured in phase0 regression manifest.');
    }

    const vitestTimeoutMs = parseIntEnv('AI_REGRESSION_TEST_TIMEOUT_MS', 60000);
    runCommand('npx', ['vitest', 'run', `--testTimeout=${vitestTimeoutMs}`, ...vitestFiles]);

    const skipSoak = parseBoolEnv('AI_REGRESSION_SKIP_SOAK', false);
    if (manifest.regression.includeBotSoak && !skipSoak) {
        runCommand('npm', ['run', 'test:bot-soak']);
    }
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_ai_regression.ts') || maybeMain.endsWith('run_ai_regression.js')) {
    runAiRegression();
}
