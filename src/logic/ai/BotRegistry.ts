import { GameEngine } from '../GameEngine';
import { EngineAction } from '../types';
import { BaselineBot } from './BaselineBot';
import { bt05UnluckyBunnyNikkiOpeningProfile } from './practice/deckProfiles/bt05UnluckyBunnyNikki';
import { PracticeBot } from './practice/PracticeBot';
import { StrongBot } from './StrongBot';
import { StrongBotV2 } from './StrongBotV2';
import { StrongBotV3 } from './StrongBotV3';

export type BotModelId = 'baseline' | 'practice-bt05-nikki-open-v1' | 'strong-v1' | 'strong-v2' | 'strong-v3';

export interface BotLike {
    name: string;
    chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null;
}

const BOT_LABEL_BY_ID: Record<BotModelId, string> = {
    baseline: 'Baseline',
    'practice-bt05-nikki-open-v1': 'Practice BT05 Nikki Open v1',
    'strong-v1': 'Strong v1',
    'strong-v2': 'Strong v2',
    'strong-v3': 'Strong v3',
};

export function normalizeBotModelId(input: string): BotModelId {
    const raw = input.trim().toLowerCase();
    if (raw === 'baseline' || raw === 'baseline-a' || raw === 'baseline-b') return 'baseline';
    if (raw === 'practice-bt05-nikki-open-v1' || raw === 'practice-bt05-nikki' || raw === 'bt05-nikki-practice') return 'practice-bt05-nikki-open-v1';
    if (raw === 'strong-v3' || raw === 'strong3' || raw === 'strong-3') return 'strong-v3';
    if (raw === 'strong-v2' || raw === 'strong2' || raw === 'strong-2') return 'strong-v2';
    if (raw === 'strong-v1' || raw === 'strong' || raw === 'strong1' || raw === 'strong-1') return 'strong-v1';
    throw new Error(`Unsupported bot model: ${input}`);
}

export function getAvailableBotModels(): Array<{ id: BotModelId; label: string }> {
    return (['baseline', 'practice-bt05-nikki-open-v1', 'strong-v1', 'strong-v2', 'strong-v3'] as BotModelId[]).map(id => ({
        id,
        label: BOT_LABEL_BY_ID[id],
    }));
}

export function getBotModelLabel(botId: BotModelId): string {
    return BOT_LABEL_BY_ID[botId];
}

export function createBotForModel(botId: BotModelId, name: string): BotLike {
    switch (botId) {
        case 'baseline':
            return new BaselineBot(name);
        case 'practice-bt05-nikki-open-v1':
            return new PracticeBot(name, bt05UnluckyBunnyNikkiOpeningProfile);
        case 'strong-v1':
            return new StrongBot(name);
        case 'strong-v2':
            return new StrongBotV2(name);
        case 'strong-v3':
            return new StrongBotV3(name);
        default: {
            const _never: never = botId;
            throw new Error(`Unhandled bot model: ${_never}`);
        }
    }
}
