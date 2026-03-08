import { UnifiedTestModule } from '../../src/logic/cardTests/shared/types';

export function getBaseCardId(testId: string): string {
    const match = testId.match(/^[A-Z]{2}\d{2}-\d{3}/);
    return match ? match[0] : testId;
}

export function collectCoveredEffectIndices(module: UnifiedTestModule): Map<string, Set<number>> {
    const covered = new Map<string, Set<number>>();

    for (const test of module.tests) {
        const cardId = getBaseCardId(test.testId);
        const current = covered.get(cardId) ?? new Set<number>();
        for (const effectIndex of test.coversEffectIndices || []) {
            current.add(effectIndex);
        }
        covered.set(cardId, current);
    }

    return covered;
}

export function findCoverageGaps(
    effectMap: Record<string, Array<unknown>>,
    module: UnifiedTestModule,
): { missing: string[]; overflow: string[] } {
    const covered = collectCoveredEffectIndices(module);
    const missing: string[] = [];
    const overflow: string[] = [];

    for (const [cardId, effects] of Object.entries(effectMap)) {
        const indexes = covered.get(cardId) ?? new Set<number>();
        for (const index of indexes) {
            if (index < 0 || index >= effects.length) {
                overflow.push(`${cardId}:${index}`);
            }
        }
        for (let index = 0; index < effects.length; index += 1) {
            if (!indexes.has(index)) {
                missing.push(`${cardId}:${index}`);
            }
        }
    }

    return { missing, overflow };
}
