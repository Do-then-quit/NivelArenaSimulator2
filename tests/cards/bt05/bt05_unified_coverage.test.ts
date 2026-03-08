import { describe, expect, it } from 'vitest';
import { BT05_EFFECTS } from '../../../src/logic/cardEffects/bt05';
import { BT05Module } from '../../../src/logic/cardTests/shared/BT05';

describe('BT05 Unified Coverage', () => {
    it('covers every BT05 effect entry with at least one unified scenario', () => {
        const covered = new Map<string, Set<number>>();

        for (const test of BT05Module.tests) {
            const current = covered.get(test.testId) ?? new Set<number>();
            for (const effectIndex of test.coversEffectIndices || []) {
                current.add(effectIndex);
            }
            covered.set(test.testId, current);
        }

        const missing: string[] = [];
        const overflow: string[] = [];

        for (const [cardId, effects] of Object.entries(BT05_EFFECTS)) {
            const effectCount = effects.length;
            const indexes = covered.get(cardId) ?? new Set<number>();
            for (const index of indexes) {
                if (index < 0 || index >= effectCount) {
                    overflow.push(`${cardId}:${index}`);
                }
            }
            for (let index = 0; index < effectCount; index += 1) {
                if (!indexes.has(index)) {
                    missing.push(`${cardId}:${index}`);
                }
            }
        }

        expect(overflow).toEqual([]);
        expect(missing).toEqual([]);
    });
});
