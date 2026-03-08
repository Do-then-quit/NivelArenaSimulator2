import { describe, expect, it } from 'vitest';
import { ST08_EFFECTS } from '../../../src/logic/cardEffects/st08';
import { ST08Module } from '../../../src/logic/cardTests/shared/ST08';
import { findCoverageGaps } from '../../helpers/unifiedCoverage';

describe('ST08 Unified Coverage', () => {
    it('covers every ST08 effect entry with at least one unified scenario', () => {
        const { missing, overflow } = findCoverageGaps(ST08_EFFECTS, ST08Module);
        expect(overflow).toEqual([]);
        expect(missing).toEqual([]);
    });
});
