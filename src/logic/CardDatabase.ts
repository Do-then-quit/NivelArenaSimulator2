import { Card, CardType, Attribute } from './types';

export const DUMMY_CARDS: Card[] = [
    {
        id: 'L001',
        name: 'Flame Leader',
        type: CardType.LEADER,
        attribute: Attribute.FIRE,
        cost: 0,
        text: 'Your basic leader.',
    },
    {
        id: 'U001',
        name: 'Fire Soldier',
        type: CardType.UNIT,
        attribute: Attribute.FIRE,
        cost: 1,
        power: 2000,
        hit: 1,
        text: 'Basic unit.',
    },
    {
        id: 'U002',
        name: 'Water Guard',
        type: CardType.UNIT,
        attribute: Attribute.WATER,
        cost: 2,
        power: 3000,
        hit: 1,
        text: 'A sturdy guard.',
    },
    {
        id: 'U003',
        name: 'Storm Striker',
        type: CardType.UNIT,
        attribute: Attribute.STORM,
        cost: 3,
        power: 4000,
        hit: 2,
        text: 'Strikes hard.',
    },
    {
        id: 'S001',
        name: 'Fireball',
        type: CardType.SKILL,
        attribute: Attribute.FIRE,
        cost: 1,
        text: 'Deal 2000 damage to a unit.',
    },
];

export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (let i = 0; i < 40; i++) {
        const template = DUMMY_CARDS[1 + (i % 4)]; // Cycle through units/skills
        deck.push({ ...template, id: `${template.id}_${i}` });
    }
    return deck;
}
