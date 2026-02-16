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
    ON_KILL = 'ON_KILL',     // When trashing opponent unit in combat
    ACTIVE_MAIN = 'ACTIVE_MAIN', // Added
    DAMAGE_TRIGGER = 'DAMAGE_TRIGGER', // Game keyword "TRIGGER" (when dealt as damage)
    TURN_START = 'TURN_START',
    TURN_END = 'TURN_END',
    AWAKEN = 'AWAKEN',
    UNIT_TRASHED = 'UNIT_TRASHED', // New: Triggered when any unit is moved to trash
    ESCAPE = 'ESCAPE', // New: When unit is returned to deck bottom from field (Entry of Main Phase)
}

export type ActionType =
    | 'DRAW'
    | 'GAIN_LEVEL'
    | 'DAMAGE'
    | 'BUFF_POWER'
    | 'BUFF_HIT'
    | 'DESTROY_UNIT'
    | 'DESTROY_SELF'
    | 'TRASH_SELF' // New: Move source card to trash (e.g. from damage zone)
    | 'RETURN_TO_HAND'
    | 'MODIFY_PLAYER_SIZE'
    | 'DESTROY_LANE_LOWEST' // Special for Acceleration
    | 'PENETRATION' // Damage to player on kill
    | 'PLUNDER'     // Draw on kill
    | 'DUALIST'      // Forced block by encounter unit
    | 'BREAKTHROUGH' // Cannot be blocked by certain units
    | 'INFILTRATION' // Draw if not blocked
    | 'MOVE_FROM_TRASH_TO_HAND'
    | 'MUTUAL_DESTRUCTION'
    | 'TERMINATE_ATTACK'
    | 'DISCARD'
    | 'DISCARD_ALL'
    | 'DESTROY_ENCOUNTER'
    | 'GRANT_EFFECT'
    | 'SET_POWER'
    | 'BUFF_POWER_AND_DRAW_IF_TRASHED'
    | 'REVEAL_TOP_AND_CHOOSE_TO_HAND'
    | 'REVEAL_TOP_AND_TAKE_ALL_BY_FILTER'
    | 'DRAW_DYNAMIC'
    | 'TERMINATE_ATTACK'
    | 'NONE'
    | 'RETURN_FROM_TRASH_AT_TURN_END'
    | 'DESTROY_UNIT_AND_DRAW_BY_HIT' // Added
    | 'DESTROY_UNIT_WITH_HIT_COST' // Added
    | 'COMPLEX_ACTION' // Added
    | 'SACRIFICE_TO_BUFF' // Added
    | 'DRAW_THEN_DISCARD' // Added for BT01-068
    | 'DESTROY_UNIT_AND_DRAW' // Added for BT01-071
    | 'RETURN_UNIT_AND_ITEMS_TO_HAND';

export interface TargetFilter {
    type: 'EXCLUDE_SELF' | 'UNIT_TYPE' | 'HAS_TRAIT' | 'HAS_KEYWORD' | 'HAS_NAME' | 'COST_LIMIT' | 'POWER_LIMIT' | 'COST_LOWER_THAN_COST_PAYMENT' | 'COST_EQUAL' | 'COST_HIGHER_THAN_ENCOUNTER' | 'LOWEST_COST_ONLY' | 'ITEM_COUNT_MIN';
    value?: any;
}

export interface TargetSchema {
    scope: 'SELF' | 'MY_FIELD' | 'OPP_FIELD' | 'BOTH_FIELDS' | 'FIELD' | 'MY_LEADER' | 'OPP_LEADER' | 'SHARED_LANE' | 'ADJACENT_LANES' | 'ENCOUNTER' | 'ENCOUNTER_UNIT' | 'MY_TRASH' | 'MY_HAND' | 'OPP_HAND' | 'REVEALED' | 'LAST_DRAWN';
    type: 'UNIT' | 'LEADER' | 'ALL' | 'CARD';
    count?: number; // 0 = all (e.g., "All units"), 1 = single target, >1 = multi-select
    filters?: TargetFilter[];
    conditions?: { // Legacy, keeping for compatibility
        costMin?: number;
        costMax?: number;
        powerMin?: number;
        powerMax?: number;
        isLeader?: boolean;
        hasTrait?: string; // e.g., "Base", "Elysion"
        state?: 'EXHAUSTED' | 'READY';
    };
    selectMode: 'MANUAL' | 'RANDOM' | 'LOWEST_POWER' | 'HIGHEST_POWER' | 'ALL';
    totalCostLimit?: number; // New: total cost of all selected targets must not exceed this
}

export interface EffectCondition {
    type: 'ALWAYS' | 'LEADER_LEVEL' | 'HAS_ITEM' | 'HAS_KEYWORD' | 'COST_COMPARISON' | 'YOUR_TURN' | 'OPPONENT_TURN' | 'OPPONENT_HAND_COUNT' | 'DISCARDED_COUNT' | 'FRONTLINE' | 'LEVEL_LINK' | 'ONCE_PER_TURN';
    value?: any;
    trashedUnitCostMin?: number; // New: for triggers like Cinderella's UNIT_TRASHED
    friendlyOnly?: boolean; // New: check if trashed unit belongs to player
}

export interface EffectCost {
    type: 'NONE' | 'TRASH_HAND' | 'RETIRE_UNIT' | 'SHUFFLE_HAND_TO_DECK';
    amount?: number;
    value?: any; // Legacy support
    cardTypeFilter?: CardType; // Restricts cost payment to a specific card type (e.g., UNIT only)
}

export interface EffectAction {
    type: ActionType;
    params: Record<string, any>; // Flexible param object
    target?: string; // Legacy field, keeping for now but prefer TargetSchema
}

export interface GameContext {
    player: PlayerState;
    opponent: PlayerState;
    sourceCard: Card;
    unitZone?: UnitZoneState;
    machine: any; // Ideally GameEngine but avoids circular dependency
    selectedLaneIndex?: number;
    destroyedBy?: Card;
    trashedUnit?: Card; // New: relevant for UNIT_TRASHED triggers
    trashedUnitOwner?: PlayerState; // New: identifying whose unit was trashed
    costPaymentCard?: Card;
    costPaid?: boolean;
    _optionalConfirmed?: boolean;
    lastDrawnCards?: Card[];
    discardedCount?: number;
}

export interface EffectQueueItem {
    effect: Effect;
    context: GameContext;
    id: string; // Unique ID for tracking
    creationTime: number; // Global Step timestamp
    sourcePlayerId: string; // Owner ID for priority sorting
}

export type EngineAction =
    | { type: 'NEXT_PHASE'; actorPlayerId: string }
    | { type: 'RESOLVE_MULLIGAN'; actorPlayerId: string; shouldMulligan: boolean }
    | { type: 'PLAY_UNIT'; actorPlayerId: string; handIndex: number; zoneIndex: number }
    | { type: 'PLAY_SKILL'; actorPlayerId: string; handIndex: number }
    | { type: 'PLAY_ITEM'; actorPlayerId: string; handIndex: number; zoneIndex: number }
    | { type: 'ACTIVATE_EFFECT'; actorPlayerId: string; zoneIndex: number; effectIndex: number; sourceType?: 'UNIT' | 'ITEM'; itemIndex?: number }
    | { type: 'ATTACK'; actorPlayerId: string; attackerZoneIndex: number }
    | { type: 'RESOLVE_BLOCK'; actorPlayerId: string; shouldBlock: boolean; blockerZoneIndex?: number }
    | { type: 'SELECT_COST_HAND'; actorPlayerId: string; handIndex: number }
    | { type: 'RESOLVE_OPTIONAL'; actorPlayerId: string; confirm: boolean }
    | { type: 'SELECT_ZONE_TARGET'; actorPlayerId: string; targetPlayerId: string; zoneIndex: number }
    | { type: 'SELECT_HAND_TARGET'; actorPlayerId: string; targetPlayerId: string; handIndex: number }
    | { type: 'SELECT_TRASH_TARGET'; actorPlayerId: string; targetPlayerId: string; trashIndex: number }
    | { type: 'SELECT_REVEALED_TARGET'; actorPlayerId: string; revealedIndex: number }
    | { type: 'CONFIRM_TARGETS'; actorPlayerId: string };

export interface EngineObservation {
    actorPlayerId: string;
    canAct: boolean;
    interactionOwnerPlayerId: string | null;
    legalActions: EngineAction[];
    state: GameState;
}

export type ActionImplementation = (context: GameContext, params: any, targets: any[]) => void;

export interface Effect {
    id?: string;
    activation: ActivationCondition;
    condition?: EffectCondition;
    cost?: EffectCost;
    targets?: TargetSchema;
    action: EffectAction;
    duration?: 'PERMANENT' | 'TURN_END' | 'OPP_TURN_END' | 'BATTLE_END';
    description: string;
    optional?: boolean;
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
    keywords?: string[];
    imageUrl?: string;
    isAwakened?: boolean;
    effects?: Effect[];
}

export interface UnitZoneState {
    unit: Card | null;
    items: Card[];
    buffs: Buff[];
    isExhausted: boolean; // For attack limit (1 attack per turn usually, but rules say "can attack if not attacked yet")
    hasAttacked: boolean;
    hasPlacedUnitThisTurn: boolean; // 6.4.1.1.3
    hasActivatedEffectThisTurn: boolean;
    activatedEffectKeys: Record<string, boolean>;
    temporaryEffects: Effect[];
}

export interface Buff {
    id: string; // unique id for removal if needed
    sourceCard?: Card; // card that created it (optional for now to be safe, but preferred)
    type: 'POWER' | 'HIT' | 'PENETRATION' | 'PLUNDER';
    value: number;
    duration: 'TURN_END' | 'PERMANENT' | 'OPP_TURN_END' | 'BATTLE_END';
    mode?: 'ADD' | 'SET';
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
    pendingBlockerZoneIndex: number | null; // Selected defender zone index for current combat
    interactionMode: 'NORMAL' | 'SELECT_MULLIGAN' | 'SELECT_TARGET' | 'SELECT_COST' | 'SELECT_OPTIONAL';
    interactionOwnerPlayerId: string | null; // Player who has input priority in the current interaction window
    pendingEffect: PendingEffect | null;
    mulliganState: MulliganState | null;
    mulliganResultByPlayerId: Record<string, boolean>;
    attackTerminated?: boolean;
    revealedCards: Card[];
    effectQueue: EffectQueueItem[]; // New: Centralized Effect Queue
    deferredEffectQueue: EffectQueueItem[]; // Deferred while resolving damage processing
    damageProcessingDepth: number; // Nested damage processing guard
    globalStep: number; // Global Timer for effects
    combatStep: 'NONE' | 'ATTACK_DECLARATION' | 'DEFENSE_DECLARATION' | 'BATTLE' | 'BATTLE_END';
    combatBlocked: boolean; // Tracks if a block was declared
}

export interface PendingEffect {
    sourceCard: Card;
    sourcePlayerId: string;
    controllerPlayerId?: string; // Player who must provide input for this interaction
    actionType: string;
    actionValue: any;
    effectDescription?: string;
    validTargets?: 'ALL_UNITS' | 'MY_UNITS' | 'OPP_UNITS' | 'SHARED_LANE' | 'MY_TRASH' | 'MY_HAND' | 'OPP_HAND' | 'REVEALED' | 'LAST_DRAWN'; // Simplified target constraint
    targetSchema?: TargetSchema;
    costToPay?: EffectCost;
    costCardTypeFilter?: CardType;
    selectedTargets?: any[];
    revealedCards?: Card[];
    costPaidCount?: number; // Track how many items have been paid for the cost
}

export interface MulliganState {
    pendingPlayerIds: string[];
    completedPlayerIds: string[];
}
