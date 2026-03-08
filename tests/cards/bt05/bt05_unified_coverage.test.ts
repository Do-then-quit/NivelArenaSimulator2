import { describe, expect, it } from 'vitest';
import { BT05_EFFECTS } from '../../../src/logic/cardEffects/bt05';
import { BT05Module } from '../../../src/logic/cardTests/shared/BT05';
import { findCoverageGaps } from '../../helpers/unifiedCoverage';

describe('BT05 Unified Coverage', () => {
    it('covers every BT05 effect entry with at least one unified scenario', () => {
        const { missing, overflow } = findCoverageGaps(BT05_EFFECTS, BT05Module);
        expect(overflow).toEqual([]);
        expect(missing).toEqual([]);
    });
});
