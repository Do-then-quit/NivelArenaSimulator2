export enum CardType {
    LEADER = 'LEADER',
    UNIT = 'UNIT',
    SKILL = 'SKILL',
    ITEM = 'ITEM',
}

export enum Attribute {
    FIRE = 'FIRE',
    EARTH = 'EARTH',
    STORM = 'STORM',
    WATER = 'WATER',
    LIGHTNING = 'LIGHTNING',
    NONE = 'NONE',
}

export enum Zone {
    DECK = 'DECK',
    HAND = 'HAND',
    UNIT = 'UNIT',
    SKILL = 'SKILL',
    LEVEL = 'LEVEL',
    DAMAGE = 'DAMAGE',
    TRASH = 'TRASH',
}

export enum Phase {
    LEVEL_UP = 'LEVEL_UP',
    DRAW = 'DRAW',
    MAIN = 'MAIN',
    ATTACK = 'ATTACK',
    BLOCK = 'BLOCK',
    END = 'END',
}

export interface Card {
    id: string;
    name: string;
    type: CardType;
    attribute: Attribute;
    cost: number;
    power?: number; // Only for Units
    hit?: number;   // Only for Units
    text: string;
    imageUrl?: string;
}

export interface UnitZoneState {
    unit: Card | null;
    items: Card[];
    isExhausted: boolean; // For attack limit (1 attack per turn usually, but rules say "can attack if not attacked yet")
    hasAttacked: boolean;
    hasPlacedUnitThisTurn: boolean; // 6.4.1.1.3
}

export interface PlayerState {
    id: string;
    name: string;
    deck: Card[];
    hand: Card[];
    trash: Card[];
    damage: Card[];
    levelZone: Card | null;
    leaderLevel: number;
    unitZones: [UnitZoneState, UnitZoneState, UnitZoneState]; // 3 zones
    skillZone: Card[];
}

export interface GameState {
    players: [PlayerState, PlayerState];
    turnPlayerIndex: number; // 0 or 1
    phase: Phase;
    turnCount: number;
    winner: string | null;
    pendingAttackerIndex: number | null; // Track who is attacking during BLOCK phase
}
