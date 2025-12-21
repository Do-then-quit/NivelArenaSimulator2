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

export enum ActivationCondition {
    ENTRY = 'ENTRY',         // Enters play
    PASSIVE = 'PASSIVE',     // Always active while in zone
    ACTIVE = 'ACTIVE',       // Ignition/Activated effect
    ATTACKER = 'ATTACKER',   // When attacking
    DEFENDER = 'DEFENDER',   // When defending
    EXIT = 'EXIT',           // When leaving play/destroyed
    DAMAGE_TRIGGER = 'DAMAGE_TRIGGER', // Game keyword "TRIGGER" (when dealt as damage)
    TURN_START = 'TURN_START',
    TURN_END = 'TURN_END',
}

export interface EffectCondition {
    type: string; // e.g., 'ALWAYS', 'HAS_ITEM', 'LEADER_LEVEL', 'COST_COMPARISON'
    value?: any;
}

export interface EffectCost {
    type: string; // e.g., 'TRASH_HAND', 'RETIRE_UNIT', 'NONE'
    value?: any;
}

export interface EffectAction {
    type: string; // e.g. 'DRAW', 'POWER_BUFF', 'DESTROY', 'DAMAGE', 'GAIN_LEVEL'
    value?: any;
    target?: string; // e.g. 'SELF', 'OPPONENT', 'CHOICE_UNIT', 'ALL_MY_UNITS'
}

export interface Effect {
    activation: ActivationCondition;
    condition?: EffectCondition;
    cost?: EffectCost;
    action: EffectAction;
    description: string;
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
    buffs: Buff[];
    isExhausted: boolean; // For attack limit (1 attack per turn usually, but rules say "can attack if not attacked yet")
    hasAttacked: boolean;
    hasPlacedUnitThisTurn: boolean; // 6.4.1.1.3
}

export interface Buff {
    id: string; // unique id for removal if needed
    sourceCard?: Card; // card that created it (optional for now to be safe, but preferred)
    type: 'POWER' | 'HIT';
    value: number;
    duration: 'TURN_END' | 'PERMANENT';
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
    interactionMode: 'NORMAL' | 'SELECT_TARGET';
    pendingEffect: PendingEffect | null;
}

export interface PendingEffect {
    sourceCard: Card;
    sourcePlayerId: string;
    actionType: string;
    actionValue: any;
    validTargets: 'ALL_UNITS' | 'MY_UNITS' | 'OPP_UNITS' | 'SHARED_LANE'; // Simplified target constraint
}
