import { describe, expect, it } from 'vitest';
import { CardTester } from '../../../src/logic/CardTester';
import { BT04Module } from '../../../src/logic/cardTests/shared/BT04';

describe('CardTester unified scenario exposure', () => {
    it('exposes BT04 unified scenarios as separate verification entries', () => {
        const tester = new CardTester();
        const ids = tester.getTestsForPack('BT04');
        const displayNames = ids.map(id => tester.getTestDisplayName(id));

        expect(ids).toHaveLength(BT04Module.tests.length);
        expect(displayNames).toHaveLength(BT04Module.tests.length);
        expect(new Set(displayNames).size).toBe(displayNames.length);
        expect(displayNames).toContain('BT04-001 · 레테 각성');
        expect(displayNames).toContain('BT04-074 · 숲의 현자 비비안 엔트리 다른 아군 희생 후 비용 이하 상대 파괴');
    });
});
