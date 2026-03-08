import { describe, expect, it } from 'vitest';
import { ST06_EFFECTS } from '../../../src/logic/cardEffects/st06';
import { ST06Module } from '../../../src/logic/cardTests/shared/ST06';
import { findCoverageGaps } from '../../helpers/unifiedCoverage';

describe('ST06 Unified Coverage', () => {
    it('covers every ST06 effect entry with at least one unified scenario', () => {
        const { missing, overflow } = findCoverageGaps(ST06_EFFECTS, ST06Module);
        expect(overflow).toEqual([]);
        expect(missing).toEqual([]);
    });
});
