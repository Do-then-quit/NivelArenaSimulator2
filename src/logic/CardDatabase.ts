import { Card, CardType, Attribute, Effect } from './types';
import rawST01 from '../../packs/ST01.json';
import rawST02 from '../../packs/ST02.json';
import rawST03 from '../../packs/ST03.json';
import rawST04 from '../../packs/ST04.json';
import rawST05 from '../../packs/ST05.json';
import rawST06 from '../../packs/ST06.json';
import rawST07 from '../../packs/ST07.json';
import rawST08 from '../../packs/ST08.json';
import rawST09 from '../../packs/ST09.json';
import rawBT01 from '../../packs/BT01.json';
import rawBT02 from '../../packs/BT02.json';
import rawBT03 from '../../packs/BT03.json';
import rawBT04 from '../../packs/BT04.json';
import rawBT05 from '../../packs/BT05.json';
import rawSB01 from '../../packs/SB01.json';

import { ST01_EFFECTS } from './cardEffects/st01';
import { ST02_EFFECTS } from './cardEffects/st02';
import { ST03_EFFECTS } from './cardEffects/st03';
import { BT01_EFFECTS } from './cardEffects/bt01';
import { CardParser } from './CardParser';

const MANUAL_EFFECTS: Record<string, Effect[]> = {
    ...ST01_EFFECTS,
    ...ST02_EFFECTS,
    ...ST03_EFFECTS,
    ...BT01_EFFECTS
};

export class CardDatabase {
    private static instance: CardDatabase;
    private cards: Map<string, Card> = new Map();

    private constructor() {
        this.loadCards();
    }

    public static getInstance(): CardDatabase {
        if (!CardDatabase.instance) {
            CardDatabase.instance = new CardDatabase();
        }
        return CardDatabase.instance;
    }

    private loadCards() {
        const rawData = [
            ...rawST01, ...rawST02, ...rawST03, ...rawST04, ...rawST05,
            ...rawST06, ...rawST07, ...rawST08, ...rawST09,
            ...rawBT01, ...rawBT02, ...rawBT03, ...rawBT04, ...rawBT05,
            ...rawSB01
        ];

        rawData.forEach((raw: any) => {
            const card = this.parseCard(raw);
            this.cards.set(card.id, card);
        });
    }

    public getCard(id: string): Card | undefined {
        return this.cards.get(id);
    }

    public getAllCards(): Card[] {
        return Array.from(this.cards.values());
    }

    private parseCard(raw: any): Card {
        return {
            id: raw.id,
            name: raw.name,
            type: this.mapType(raw.type),
            attribute: this.mapAttribute(raw.attribute),
            cost: raw.cost === '레어도' ? 0 : parseInt(raw.cost),
            power: raw.power === '-' ? undefined : parseInt(raw.power),
            hit: raw.hit === '-' ? undefined : parseInt(raw.hit),
            text: raw.text,
            traits: raw.traits,
            keywords: this.parseKeywords(raw),
            imageUrl: `/assets/cards/${raw.id}.jpg`,
            effects: MANUAL_EFFECTS[raw.id] || []
        };
    }

    private parseKeywords(raw: any): string[] {
        // Use the new CardParser to extract keywords from text
        const parsed = CardParser.parseKeywords(raw.text);

        // Merge with existing raw.keywords if any
        let k = raw.keywords || "";
        const combined: string[] = [];

        if (k && k !== "-") {
            combined.push(...k.split(',').map((s: string) => s.trim()));
        }

        parsed.forEach(pk => {
            if (!combined.includes(pk)) {
                combined.push(pk);
            }
        });

        return combined;
    }

    private mapType(rawType: string): CardType {
        switch (rawType) {
            case '리더': return CardType.LEADER;
            case '유닛': return CardType.UNIT;
            case '스킬': return CardType.SKILL;
            case '아이템': return CardType.ITEM;
            default: return CardType.UNIT;
        }
    }

    private mapAttribute(rawAttr: string): Attribute {
        switch (rawAttr) {
            case '화염': return Attribute.FIRE;
            case '대지': return Attribute.EARTH;
            case '폭풍': return Attribute.STORM;
            case '파도': return Attribute.WATER;
            case '번개': return Attribute.LIGHTNING;
            case '없음': return Attribute.NONE;
            default: return Attribute.NONE;
        }
    }
}


// Maintain compatibility for existing tests if needed, or deprecate
export const DUMMY_CARDS: Card[] = []; // Deprecated, but keeping to avoid breakage if referenced elsewhere temporarily
export function createDeck(): Card[] { // Deprecated wrapper
    const db = CardDatabase.getInstance();
    const pool = db.getAllCards().filter(c => c.type !== CardType.LEADER);
    const deck: Card[] = [];
    for (let i = 0; i < 40; i++) {
        const template = pool[i % pool.length];
        deck.push({ ...template, id: `${template.id}_${i}` });
    }
    return deck;
}