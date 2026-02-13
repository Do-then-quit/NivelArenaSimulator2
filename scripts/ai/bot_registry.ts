import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import {
    resolveStrongBotV3BudgetPresetKey,
    resolveV3OptionsFromPreset,
    StrongBotV3,
    StrongBotV3BudgetPreset,
} from '../../src/logic/ai/StrongBotV3';
import { StrongBot } from '../../src/logic/ai/StrongBot';
import { StrongBotV2 } from '../../src/logic/ai/StrongBotV2';
import { BotFactory } from './match_harness';

const V3_PRESET_ENV = 'AI_STRONG_V3_PRESET';

function createStrongV31Factory(preset: StrongBotV3BudgetPreset): BotFactory {
    return (name: string) => new StrongBotV3(name, resolveV3OptionsFromPreset(preset));
}

function resolvePresetFromBotId(botId: string): StrongBotV3BudgetPreset | null {
    const normalized = botId.trim().toLowerCase();
    if (normalized.endsWith('-tuning')) return 'tuning';
    if (normalized.endsWith('-dev')) return 'dev';
    if (normalized.endsWith('-holdout')) return 'holdout';
    return null;
}

function resolveDynamicStrongV3Factory(botId: string): BotFactory {
    const presetFromId = resolvePresetFromBotId(botId);
    const preset = presetFromId ?? resolveStrongBotV3BudgetPresetKey(process.env[V3_PRESET_ENV]);
    return (name: string) => new StrongBotV3(name, resolveV3OptionsFromPreset(preset));
}

const BOT_REGISTRY: Record<string, BotFactory> = {
    baseline: (name: string) => new BaselineBot(name),
    'baseline-a': (name: string) => new BaselineBot(name),
    'baseline-b': (name: string) => new BaselineBot(name),
    strong: (name: string) => new StrongBot(name),
    'strong-v1': (name: string) => new StrongBot(name),
    'strong-v2': (name: string) => new StrongBotV2(name),
    'strong-v3': (name: string) => new StrongBotV3(name),
    'strong-v3.1-tuning': createStrongV31Factory('tuning'),
    'strong-v3.1-dev': createStrongV31Factory('dev'),
    'strong-v3.1-holdout': createStrongV31Factory('holdout'),
};

export function resolveBotFactory(botId: string): BotFactory {
    const normalized = botId.trim().toLowerCase();
    const direct = BOT_REGISTRY[normalized];
    if (direct) return direct;
    if (normalized.startsWith('baseline')) return BOT_REGISTRY.baseline;
    if (normalized.startsWith('strong-v3.1')) return resolveDynamicStrongV3Factory(normalized);
    if (normalized.startsWith('strong-v3')) return BOT_REGISTRY['strong-v3'];
    if (normalized.startsWith('strong-v2')) return BOT_REGISTRY['strong-v2'];
    if (normalized.startsWith('strong')) return BOT_REGISTRY['strong-v1'];
    throw new Error(`Unknown bot id: ${botId}. Available: ${Object.keys(BOT_REGISTRY).join(', ')}`);
}

export function getAvailableBotIds(): string[] {
    return Object.keys(BOT_REGISTRY).sort();
}
