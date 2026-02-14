import { CardTestModule } from './types';

// Unified test modules
import { ST01Module } from './shared/ST01';
import { ST02Module } from './shared/ST02';
import { ST03Module } from './shared/ST03';
import { ST04Module } from './shared/ST04';
import { ST05Module } from './shared/ST05';
import { BT01FireModule } from './shared/BT01Fire';
import { BT01EarthModule } from './shared/BT01Earth';
import { BT01StormModule } from './shared/BT01Storm';
import { adaptUnifiedModule } from './cardtester-adapter';

// Convert all unified modules to CardTestModule format
const UnifiedST01 = adaptUnifiedModule(ST01Module);
const UnifiedST02 = adaptUnifiedModule(ST02Module);
const UnifiedST03 = adaptUnifiedModule(ST03Module);
const UnifiedST04 = adaptUnifiedModule(ST04Module);
const UnifiedST05 = adaptUnifiedModule(ST05Module);
const UnifiedBT01Fire = adaptUnifiedModule(BT01FireModule);
const UnifiedBT01Earth = adaptUnifiedModule(BT01EarthModule);
const UnifiedBT01Storm = adaptUnifiedModule(BT01StormModule);

export const CARD_TEST_REGISTRY: Record<string, CardTestModule> = {
    'ST01': UnifiedST01,
    'ST02': UnifiedST02,
    'ST03': UnifiedST03,
    'ST04': UnifiedST04,
    'ST05': UnifiedST05,
    'BT01?붿뿼': UnifiedBT01Fire,
    'BT01?吏': UnifiedBT01Earth,
    'BT01??뭾': UnifiedBT01Storm
};

export function findTestModule(cardId: string): CardTestModule | undefined {
    const packId = cardId.split('-')[0];
    // BT01 cards need special handling to find by attribute
    if (packId === 'BT01') {
        const num = parseInt(cardId.split('-')[1]);
        if (num <= 27) return CARD_TEST_REGISTRY['BT01?붿뿼'];
        if (num <= 54) return CARD_TEST_REGISTRY['BT01?吏'];
        return CARD_TEST_REGISTRY['BT01??뭾'];
    }
    return CARD_TEST_REGISTRY[packId];
}
