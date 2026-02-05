import { ST01Tests } from './ST01';
import { ST02Tests } from './ST02';
import { ST03Tests } from './ST03';
import { BT01FireTests } from './BT01Fire';
import { BT01EarthTests } from './BT01Earth';
import { BT01StormTests } from './BT01Storm';
import { CardTestModule } from './types';

export const CARD_TEST_REGISTRY: Record<string, CardTestModule> = {
    'ST01': ST01Tests,
    'ST02': ST02Tests,
    'ST03': ST03Tests,
    'BT01화염': BT01FireTests,
    'BT01대지': BT01EarthTests,
    'BT01폭풍': BT01StormTests
};

export function findTestModule(cardId: string): CardTestModule | undefined {
    const packId = cardId.split('-')[0];
    // BT01 cards need special handling to find by attribute
    if (packId === 'BT01') {
        const num = parseInt(cardId.split('-')[1]);
        if (num <= 27) return CARD_TEST_REGISTRY['BT01화염'];
        if (num <= 54) return CARD_TEST_REGISTRY['BT01대지'];
        return CARD_TEST_REGISTRY['BT01폭풍'];
    }
    return CARD_TEST_REGISTRY[packId];
}
