import { Card } from './types';

export const DECK_BUILDER_ALLOWED_PACKS = ['ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST10', 'ST11', 'BT01', 'BT02', 'BT03', 'BT06', 'SB01'] as const;

function isAllowedPackCard(cardId: string): boolean {
    return DECK_BUILDER_ALLOWED_PACKS.some(pack => cardId.startsWith(`${pack}-`));
}

export function getDeckBuilderCards(cards: Card[]): Card[] {
    return cards.filter(card => isAllowedPackCard(card.id));
}
