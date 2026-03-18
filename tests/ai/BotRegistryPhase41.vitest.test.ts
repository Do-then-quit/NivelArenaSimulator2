import { describe, expect, it } from 'vitest';
import { getAvailableBotIds, resolveBotFactory } from '../../scripts/ai/bot_registry';

describe('Bot registry phase4.1 profiles', () => {
    it('exposes explicit phase4.1 candidate profiles', () => {
        const ids = getAvailableBotIds();
        expect(ids).toContain('strong-v3.1-topk3');
        expect(ids).toContain('strong-v3.1-topk3-mean');
        expect(ids).toContain('practice-bt05-nikki-learned-hold-v1');
    });

    it('resolves strong-v3.1 prefix ids to the phase4.1 topk3 profile factory', () => {
        const directFactory = resolveBotFactory('strong-v3.1-topk3');
        const prefixFactory = resolveBotFactory('strong-v3.1-experimental');

        const directBot = directFactory('direct');
        const prefixBot = prefixFactory('prefix');
        expect(typeof directBot.chooseAction).toBe('function');
        expect(typeof prefixBot.chooseAction).toBe('function');
    });
});
