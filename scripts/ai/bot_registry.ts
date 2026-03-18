import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import { StrongBot } from '../../src/logic/ai/StrongBot';
import { StrongBotV2 } from '../../src/logic/ai/StrongBotV2';
import { StrongBotV3 } from '../../src/logic/ai/StrongBotV3';
import { PracticeBot } from '../../src/logic/ai/practice/PracticeBot';
import { PracticeStrongBot } from '../../src/logic/ai/practice/PracticeStrongBot';
import { bt05UnluckyBunnyNikkiCandidateProfile } from '../../src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikkiCandidate';
import { bt05UnluckyBunnyNikkiOpeningProfile } from '../../src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki';
import { BotFactory } from './match_harness';

const BOT_REGISTRY: Record<string, BotFactory> = {
    baseline: (name: string) => new BaselineBot(name),
    'baseline-a': (name: string) => new BaselineBot(name),
    'baseline-b': (name: string) => new BaselineBot(name),
    'practice-bt05-nikki-open-v1': (name: string) => new PracticeBot(name, bt05UnluckyBunnyNikkiOpeningProfile),
    'practice-bt05-nikki-strong-v1': (name: string) => new PracticeStrongBot(name, bt05UnluckyBunnyNikkiOpeningProfile),
    'practice-bt05-nikki-strong-v2': (name: string) => new PracticeStrongBot(name, bt05UnluckyBunnyNikkiOpeningProfile, {
        beamWidth: 4,
        interactionRolloutDepth: 4,
        opponentReplyTopK: 1,
        opponentReplyAggregation: 'weighted',
        opponentReplyBlend: 0.62,
        rolloutDisagreementPenaltyWeight: 0.03,
        closeBoardOvercommitPenaltyWeight: 0.018,
    }),
    'practice-bt05-nikki-candidate-v2': (name: string) => new PracticeStrongBot(name, bt05UnluckyBunnyNikkiCandidateProfile, {
        beamWidth: 4,
        interactionRolloutDepth: 4,
        opponentReplyTopK: 1,
        opponentReplyAggregation: 'weighted',
        opponentReplyBlend: 0.62,
        rolloutDisagreementPenaltyWeight: 0.03,
        closeBoardOvercommitPenaltyWeight: 0.018,
    }),
    strong: (name: string) => new StrongBot(name),
    'strong-v1': (name: string) => new StrongBot(name),
    'strong-v2': (name: string) => new StrongBotV2(name),
    'strong-v3': (name: string) => new StrongBotV3(name),
    'strong-v3.1-topk3': (name: string) => new StrongBotV3(name, {
        opponentReplyTopK: 3,
        opponentReplyAggregation: 'weighted',
    }),
    'strong-v3.1-topk3-mean': (name: string) => new StrongBotV3(name, {
        opponentReplyTopK: 3,
        opponentReplyAggregation: 'mean',
    }),
};

export function resolveBotFactory(botId: string): BotFactory {
    const direct = BOT_REGISTRY[botId];
    if (direct) return direct;
    if (botId.startsWith('baseline')) return BOT_REGISTRY.baseline;
    if (botId.startsWith('practice-bt05-nikki-candidate')) return BOT_REGISTRY['practice-bt05-nikki-strong-v2'];
    if (botId.startsWith('practice-bt05-nikki-strong-v2')) return BOT_REGISTRY['practice-bt05-nikki-strong-v2'];
    if (botId.startsWith('practice-bt05-nikki-strong')) return BOT_REGISTRY['practice-bt05-nikki-strong-v1'];
    if (botId.startsWith('practice-bt05-nikki')) return BOT_REGISTRY['practice-bt05-nikki-open-v1'];
    if (botId.startsWith('strong-v3.1')) return BOT_REGISTRY['strong-v3.1-topk3'];
    if (botId.startsWith('strong-v3')) return BOT_REGISTRY['strong-v3'];
    if (botId.startsWith('strong-v2')) return BOT_REGISTRY['strong-v2'];
    if (botId.startsWith('strong')) return BOT_REGISTRY['strong-v1'];
    throw new Error(`Unknown bot id: ${botId}. Available: ${Object.keys(BOT_REGISTRY).join(', ')}`);
}

export function getAvailableBotIds(): string[] {
    return Object.keys(BOT_REGISTRY).sort();
}
