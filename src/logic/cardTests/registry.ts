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
import { BT02FireModule } from './shared/BT02Fire';
import { BT02EarthModule } from './shared/BT02Earth';
import { BT02StormModule } from './shared/BT02Storm';
import { BT02WaterModule } from './shared/BT02Water';
import { BT02LightningModule } from './shared/BT02Lightning';
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
const UnifiedBT02Fire = adaptUnifiedModule(BT02FireModule);
const UnifiedBT02Earth = adaptUnifiedModule(BT02EarthModule);
const UnifiedBT02Storm = adaptUnifiedModule(BT02StormModule);
const UnifiedBT02Water = adaptUnifiedModule(BT02WaterModule);
const UnifiedBT02Lightning = adaptUnifiedModule(BT02LightningModule);

export const CARD_TEST_REGISTRY: Record<string, CardTestModule> = {
    'ST01': UnifiedST01,
    'ST02': UnifiedST02,
    'ST03': UnifiedST03,
    'ST04': UnifiedST04,
    'ST05': UnifiedST05,
    'BT01화염': UnifiedBT01Fire,
    'BT01대지': UnifiedBT01Earth,
    'BT01폭풍': UnifiedBT01Storm,
    'BT02화염': UnifiedBT02Fire,
    'BT02대지': UnifiedBT02Earth,
    'BT02폭풍': UnifiedBT02Storm,
    'BT02파도': UnifiedBT02Water,
    'BT02번개': UnifiedBT02Lightning,
};

export function findTestModule(cardId: string): CardTestModule | undefined {
    const packId = cardId.split('-')[0];
    // BT01/BT02 cards need special handling to find by attribute group.
    if (packId === 'BT01') {
        const num = parseInt(cardId.split('-')[1]);
        if (num <= 27) return CARD_TEST_REGISTRY['BT01화염'];
        if (num <= 54) return CARD_TEST_REGISTRY['BT01대지'];
        return CARD_TEST_REGISTRY['BT01폭풍'];
    }
    if (packId === 'BT02') {
        const num = parseInt(cardId.split('-')[1]);
        if (num <= 9) return CARD_TEST_REGISTRY['BT02화염'];
        if (num <= 18) return CARD_TEST_REGISTRY['BT02대지'];
        if (num <= 27) return CARD_TEST_REGISTRY['BT02폭풍'];
        if (num <= 54) return CARD_TEST_REGISTRY['BT02파도'];
        return CARD_TEST_REGISTRY['BT02번개'];
    }
    return CARD_TEST_REGISTRY[packId];
}
