import { describe, expect, it } from 'vitest';
import { ST07_EFFECTS } from '../../../src/logic/cardEffects/st07';
import { ST07Module } from '../../../src/logic/cardTests/shared/ST07';
import { findCoverageGaps } from '../../helpers/unifiedCoverage';

describe('ST07 Unified Coverage', () => {
    it('covers every ST07 effect entry with at least one unified scenario', () => {
        const { missing, overflow } = findCoverageGaps(ST07_EFFECTS, ST07Module);
        expect(overflow).toEqual([]);
        expect(missing).toEqual([]);
    });
});
