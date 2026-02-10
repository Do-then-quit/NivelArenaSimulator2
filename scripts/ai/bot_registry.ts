import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import { StrongBot } from '../../src/logic/ai/StrongBot';
import { StrongBotV2 } from '../../src/logic/ai/StrongBotV2';
import { BotFactory } from './match_harness';

const BOT_REGISTRY: Record<string, BotFactory> = {
    baseline: (name: string) => new BaselineBot(name),
    'baseline-a': (name: string) => new BaselineBot(name),
    'baseline-b': (name: string) => new BaselineBot(name),
    strong: (name: string) => new StrongBot(name),
    'strong-v1': (name: string) => new StrongBot(name),
    'strong-v2': (name: string) => new StrongBotV2(name),
};

export function resolveBotFactory(botId: string): BotFactory {
    const direct = BOT_REGISTRY[botId];
    if (direct) return direct;
    if (botId.startsWith('baseline')) return BOT_REGISTRY.baseline;
    if (botId.startsWith('strong-v2')) return BOT_REGISTRY['strong-v2'];
    if (botId.startsWith('strong')) return BOT_REGISTRY['strong-v1'];
    throw new Error(`Unknown bot id: ${botId}. Available: ${Object.keys(BOT_REGISTRY).join(', ')}`);
}

export function getAvailableBotIds(): string[] {
    return Object.keys(BOT_REGISTRY).sort();
}
