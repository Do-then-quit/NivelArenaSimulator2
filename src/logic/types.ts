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

export enum EffectType {
    ENTRY = 'ENTRY',         // Enters play
    PASSIVE = 'PASSIVE',     // Always active while in zone
    ACTIVE = 'ACTIVE',       // Ignition/Activated effect
    ATTACKER = 'ATTACKER',   // When attacking
    DEFENDER = 'DEFENDER',   // When defending
    EXIT = 'EXIT',           // When leaving play/destroyed
    TRIGGER = 'TRIGGER',     // Damage trigger
    TURN_START = 'TURN_START',
    TURN_END = 'TURN_END',
    ESACPE = 'ESCAPE',       // Specific keyword
}

export interface EffectCondition {
    type: string; // e.g., 'ALWAYS', 'HAS_ITEM', 'LEADER_LEVEL', 'COST_COMPARISON'
    value?: any;
}

export interface Effect {
    type: EffectType;
    condition?: EffectCondition;
    description: string;
    // We will use a flexible action handler system.
    // In a real robust system, this might be a structured object (e.g. { action: 'DRAW', value: 1 })
    // For this simulator, we might use a function callback or a structured identifier handled by the engine.
    // Let's go with a structured identifier for serializability and defined logic.
    action: {
        type: string; // e.g. 'DRAW', 'POWER_BUFF', 'DESTROY', 'DAMAGE'
        value?: any;
        target?: string; // 'SELF', 'OPPONENT', 'ALL_UNITS'
    };
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
    traits?: string;
    keywords?: string;
    imageUrl?: string;
    effects?: Effect[];
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
