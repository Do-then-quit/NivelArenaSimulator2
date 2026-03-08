import { describe, expect, it } from 'vitest';
import { BT04_EFFECTS } from '../../../src/logic/cardEffects/bt04';
import { BT04Module } from '../../../src/logic/cardTests/shared/BT04';
import { findCoverageGaps } from '../../helpers/unifiedCoverage';

describe('BT04 Unified Coverage', () => {
    it('covers every BT04 effect entry with at least one unified scenario', () => {
        const { missing, overflow } = findCoverageGaps(BT04_EFFECTS, BT04Module);
        expect(overflow).toEqual([]);
        expect(missing).toEqual([]);
    });
});
