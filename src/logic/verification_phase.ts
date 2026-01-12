import { GameEngine } from './GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from './types';

// Mock Effect for Escape
const escapeEffect = {
    activation: ActivationCondition.ESCAPE,
    action: { type: 'NONE', params: {} },
    targets: { selectMode: 'MANUAL', scope: 'SELF', count: 1 },
    description: 'Escape Triggered'
} as any;

const turnEndEffect = {
    activation: ActivationCondition.TURN_END,
    action: { type: 'NONE', params: {} },
    targets: { selectMode: 'MANUAL', scope: 'SELF', count: 1 },
    description: 'Turn End Triggered'
} as any;

// Mock Card
const mockUnit: Card = {
    id: 'unit1', name: 'Escape Unit', type: CardType.UNIT, attribute: Attribute.NONE, cost: 0, text: '', effects: [escapeEffect]
};
const mockEndUnit: Card = {
    id: 'unit2', name: 'End Unit', type: CardType.UNIT, attribute: Attribute.NONE, cost: 0, text: '', effects: [turnEndEffect]
};
const mockLeader: Card = { ...mockUnit, type: CardType.LEADER, effects: [] };

// Init Engine
const dummyDeck = Array(20).fill(mockUnit);
const engine = new GameEngine('Player1', 'Player2', [...dummyDeck], [...dummyDeck], mockLeader, mockLeader);
engine.state.globalStep = 0; // Reset

// Setup Board
const p1 = engine.state.players[0];
p1.unitZones[0].unit = mockUnit; // Has Escape effect
p1.unitZones[1].unit = mockEndUnit; // Has Turn End effect

console.log('--- Test 1: Enter Main Phase (Escape Logic) ---');
// Transition from Draw to Main
engine.state.phase = Phase.DRAW;
engine.nextPhase(); // Should go to MAIN and trigger Escape

// Check Queue
if (engine.state.effectQueue.length > 0 && engine.state.effectQueue[0].effect.description === 'Escape Triggered') {
    console.log('[PASS] Escape Effect Triggered upon entering Main Phase');
} else {
    console.error('[FAIL] Escape Effect NOT Triggered');
    console.log('Queue:', engine.state.effectQueue);
}

// Clear Queue
engine.state.effectQueue = [];

console.log('\n--- Test 2: End Phase Sequence ---');
// Transition to End Phase
engine.state.phase = Phase.ATTACK;
engine.nextPhase(); // Go to END
console.log('Phase is now:', engine.state.phase);
engine.nextPhase(); // Resolve END -> LEVEL_UP

// Check Queue for Turn End Effect
const turnEndTriggered = engine.state.effectQueue.some(e => e.effect.description === 'Turn End Triggered');

if (turnEndTriggered) {
    console.log('[PASS] Turn End Effect Triggered during End Phase');
} else {
    console.error('[FAIL] Turn End Effect NOT Triggered');
}

// Verify Phase Switch
if (engine.state.phase === Phase.LEVEL_UP) { // Should have switched to Level Up of next turn
    console.log('[PASS] Phase correctly switched to LEVEL_UP of next turn');
} else {
    console.error(`[FAIL] Phase is ${engine.state.phase}, expected LEVEL_UP`);
}
