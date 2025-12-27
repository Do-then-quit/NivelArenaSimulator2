import { Card, CardType, Attribute, Effect } from './types';
import rawST01 from '../../packs/ST01.json';
import rawST02 from '../../packs/ST02.json';
import { ST01_EFFECTS } from './cardEffects/st01';
import { ST02_EFFECTS } from './cardEffects/st02';

const MANUAL_EFFECTS: Record<string, Effect[]> = {
    ...ST01_EFFECTS,
    ...ST02_EFFECTS
};

function mapType(rawType: string): CardType {
    switch (rawType) {
        case '리더': return CardType.LEADER;
        case '유닛': return CardType.UNIT;
        case '스킬': return CardType.SKILL;
        case '아이템': return CardType.ITEM;
        default: return CardType.UNIT;
    }
}

function mapAttribute(rawAttr: string): Attribute {
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

export const DUMMY_CARDS: Card[] = [...rawST01, ...rawST02].map((raw: any) => ({
    id: raw.id,
    name: raw.name,
    type: mapType(raw.type),
    attribute: mapAttribute(raw.attribute),
    cost: raw.cost === '레어도' ? 0 : parseInt(raw.cost),
    power: raw.power === '-' ? undefined : parseInt(raw.power),
    hit: raw.hit === '-' ? undefined : parseInt(raw.hit),
    text: raw.text,
    traits: raw.traits,
    keywords: raw.keywords,
    imageUrl: `/assets/cards/${raw.id}.jpg`,
    effects: MANUAL_EFFECTS[raw.id] || []
}));

export function createDeck(): Card[] {
    const deck: Card[] = [];
    // Only use Units for the deck as requested
    const deckPool = DUMMY_CARDS.filter(c => c.type !== CardType.LEADER);
    for (let i = 0; i < 40; i++) {
        const template = deckPool[i % deckPool.length];
        deck.push({ ...template, id: `${template.id}_${i}` });
    }
    return deck;
}