import { ST01Tests } from './ST01';
import { ST02Tests } from './ST02';
import { ST03Tests } from './ST03';
import { CardTestModule } from './types';

export const CARD_TEST_REGISTRY: Record<string, CardTestModule> = {
    'ST01': ST01Tests,
    'ST02': ST02Tests,
    'ST03': ST03Tests
};

export function findTestModule(cardId: string): CardTestModule | undefined {
    const packId = cardId.split('-')[0];
    return CARD_TEST_REGISTRY[packId];
}
