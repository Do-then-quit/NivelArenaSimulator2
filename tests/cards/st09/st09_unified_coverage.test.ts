import { describe, expect, it } from 'vitest';
import { ST09_EFFECTS } from '../../../src/logic/cardEffects/st09';
import { ST09Module } from '../../../src/logic/cardTests/shared/ST09';
import { findCoverageGaps } from '../../helpers/unifiedCoverage';

describe('ST09 Unified Coverage', () => {
    it('covers every ST09 effect entry with at least one unified scenario', () => {
        const { missing, overflow } = findCoverageGaps(ST09_EFFECTS, ST09Module);
        expect(overflow).toEqual([]);
        expect(missing).toEqual([]);
    });
});
