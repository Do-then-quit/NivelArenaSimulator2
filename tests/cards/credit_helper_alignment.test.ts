import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const CREDIT_KEYWORD = '\uD06C\uB808\uB527';
const CREDIT_HELPER_CARD_PATTERN = /'([A-Z]{2}\d{2}-\d{3})':\s*(?:\[\s*\.\.\.creditEffects\(|creditEffects\()/g;

function loadPackCards(packId: string) {
    const packPath = path.join(process.cwd(), 'packs', `${packId}.json`);
    return JSON.parse(fs.readFileSync(packPath, 'utf8'));
}

function cardsUsingCreditHelper(packFileName: string): string[] {
    const effectPath = path.join(process.cwd(), 'src', 'logic', 'cardEffects', `${packFileName}.ts`);
    const src = fs.readFileSync(effectPath, 'utf8');
    return [...src.matchAll(CREDIT_HELPER_CARD_PATTERN)].map((match) => match[1]);
}

describe('Credit helper alignment', () => {
    it('uses creditEffects only for cards whose pack text has the credit keyword', () => {
        const packs = [
            { packId: 'BT05', file: 'bt05' },
            { packId: 'ST08', file: 'st08' },
            { packId: 'ST09', file: 'st09' },
        ];

        const wrong: string[] = [];

        for (const pack of packs) {
            const cards = loadPackCards(pack.packId);
            const byId = new Map(cards.filter((card: any) => card?.id).map((card: any) => [card.id, card]));

            for (const cardId of cardsUsingCreditHelper(pack.file)) {
                const card = byId.get(cardId);
                const hasCreditKeyword = Array.isArray(card?.keywordList) && card.keywordList.includes(CREDIT_KEYWORD);
                if (!hasCreditKeyword) {
                    wrong.push(cardId);
                }
            }
        }

        expect(wrong).toEqual([]);
    });
});
