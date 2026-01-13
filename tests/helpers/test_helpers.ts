/**
 * Shared test helpers for NivelArena card effect testing.
 * These helpers provide consistent game setup and assertion utilities.
 */

import { GameEngine } from '../../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../../src/logic/types';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';

/**
 * Get a fresh copy of a card from the database.
 * @param id Card ID (e.g., 'ST01-001', 'BT01-005')
 * @returns Deep cloned card object
 */
export function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found in database`);
    return JSON.parse(JSON.stringify(card));
}

/**
 * Check if a card exists in the database.
 */
export function cardExists(id: string): boolean {
    return DUMMY_CARDS.some(c => c.id === id);
}

/**
 * Create a game engine with specified leaders and optional decks.
 * @param leader1Id Card ID for player 1's leader
 * @param leader2Id Card ID for player 2's leader (defaults to same as leader1)
 * @param deckConfig Optional custom deck configuration
 */
export function createGame(
    leader1Id: string,
    leader2Id?: string,
    deckConfig?: {
        deck1?: Card[];
        deck2?: Card[];
        fillCard1?: string;
        fillCard2?: string;
        deckSize?: number;
    }
): GameEngine {
    const leader1 = getCard(leader1Id);
    const leader2 = getCard(leader2Id ?? leader1Id);

    const config = deckConfig ?? {};
    const deckSize = config.deckSize ?? 10;

    // Create decks - use custom or fill with vanilla units
    const deck1 = config.deck1 ?? Array(deckSize).fill(null).map(() =>
        getCard(config.fillCard1 ?? getVanillaCardForAttribute(leader1.attribute))
    );
    const deck2 = config.deck2 ?? Array(deckSize).fill(null).map(() =>
        getCard(config.fillCard2 ?? getVanillaCardForAttribute(leader2.attribute))
    );

    return new GameEngine('P1', 'P2', deck1, deck2, leader1, leader2);
}

/**
 * Get a vanilla (no effect) unit card for the given attribute.
 */
function getVanillaCardForAttribute(attribute: Attribute): string {
    switch (attribute) {
        case Attribute.FIRE: return 'ST01-002'; // Neon
        case Attribute.EARTH: return 'ST02-002'; // N102
        case Attribute.STORM: return 'ST03-002'; // Tove
        default: return 'ST01-002';
    }
}

/**
 * Quick game setup helpers for specific starter decks
 */
export const GameSetup = {
    fire: () => createGame('ST01-001'),
    earth: () => createGame('ST02-001'),
    storm: () => createGame('ST03-001'),
    bt01Fire: () => createGame('BT01-001'),
    bt01Earth: () => createGame('BT01-028'),
    bt01Storm: () => createGame('BT01-055'),
};

/**
 * Place a unit on the field directly (bypassing rules and entry effects).
 */
export function placeUnit(engine: GameEngine, cardId: string, laneIndex: number, isOpponent = false): Card {
    const unit = getCard(cardId);
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    player.unitZones[laneIndex].unit = unit;
    return unit;
}

/**
 * Play a unit from hand (triggering entry effects and checking rules).
 * Sets leader level to 10 to ensure size limit is not hit.
 */
export function playUnit(engine: GameEngine, cardId: string, laneIndex: number): Card {
    const card = getCard(cardId);
    engine.currentPlayer.hand.push(card);
    const cardIndex = engine.currentPlayer.hand.length - 1;

    // Ensure size limit
    const prevLevel = engine.currentPlayer.leaderLevel;
    engine.currentPlayer.leaderLevel = 10;

    // Ensure MAIN phase for playing unit
    const prevPhase = engine.state.phase;
    engine.state.phase = Phase.MAIN;

    engine.playUnit(cardIndex, laneIndex);

    // Restore phase if needed, but usually tests stay in MAIN for a while
    // engine.state.phase = prevPhase;

    // Restore level if needed or just keep it 10? Tests usually want high level.
    // For now, let's just keep it 10 as it's common for tests.

    return engine.currentPlayer.unitZones[laneIndex].unit!;
}

/**
 * Place an item on a unit.
 */
export function equipItem(engine: GameEngine, itemId: string, laneIndex: number, isOpponent = false): Card {
    const item = getCard(itemId);
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    player.unitZones[laneIndex].items.push(item);
    return item;
}

/**
 * Add cards to a player's hand.
 */
export function addToHand(engine: GameEngine, cardIds: string[], isOpponent = false): Card[] {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    const cards = cardIds.map(id => getCard(id));
    player.hand.push(...cards);
    return cards;
}

/**
 * Set the game to a specific phase.
 */
export function setPhase(engine: GameEngine, phase: Phase): void {
    engine.state.phase = phase;
}

/**
 * Force leader to awakened state.
 */
export function awakenLeader(engine: GameEngine, isOpponent = false): void {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    if (player.levelZone) {
        player.levelZone.isAwakened = true;
    }
}

/**
 * Set leader level directly.
 */
export function setLeaderLevel(engine: GameEngine, level: number, isOpponent = false): void {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    player.leaderLevel = level;
}

/**
 * Get unit power in a lane.
 */
export function getUnitPower(engine: GameEngine, laneIndex: number, isOpponent = false): number {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    return engine.getUnitPower(player.unitZones[laneIndex], player);
}

/**
 * Get unit hit value in a lane.
 */
export function getUnitHit(engine: GameEngine, laneIndex: number, isOpponent = false): number {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    return engine.getUnitHit(player.unitZones[laneIndex], player);
}

/**
 * Check if a unit exists in a lane.
 */
export function hasUnit(engine: GameEngine, laneIndex: number, isOpponent = false): boolean {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    return player.unitZones[laneIndex].unit !== null;
}

/**
 * Check if a unit was trashed (exists in trash zone).
 */
export function isInTrash(engine: GameEngine, cardId: string, isOpponent = false): boolean {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    return player.trash.some(c => c.id === cardId);
}

/**
 * Get the number of cards in a player's hand.
 */
export function handSize(engine: GameEngine, isOpponent = false): number {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    return player.hand.length;
}

/**
 * Get the number of damage cards.
 */
export function damageCount(engine: GameEngine, isOpponent = false): number {
    const player = isOpponent ? engine.opponentPlayer : engine.currentPlayer;
    return player.damage.length;
}
