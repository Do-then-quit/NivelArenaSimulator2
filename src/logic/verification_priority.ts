import { GameEngine } from './GameEngine';
import { Card, CardType, Attribute } from './types';

// Mock Card
const mockCard: Card = {
    id: 'mock', name: 'mock', type: CardType.UNIT, attribute: Attribute.NONE, cost: 0, text: '', effects: []
};
const mockLeader: Card = { ...mockCard, type: CardType.LEADER };

// Init Engine
const engine = new GameEngine('Player1', 'Player2', [], [], mockLeader, mockLeader);
const p1Id = engine.state.players[0].id;
const p2Id = engine.state.players[1].id;

console.log(`P1 (Turn): ${p1Id}`);
console.log(`P2: ${p2Id}`);

// FORCE Turn Player to be P1 (Index 0)
engine.state.turnPlayerIndex = 0;

// Scenario 1: Same Time, Turn Player Priority
// P2 effect added first, P1 added second. Should sort to P1, P2.
engine.state.effectQueue = [
    { id: 'bp2', creationTime: 1, sourcePlayerId: p2Id, effect: { description: 'P2 Effect' } } as any,
    { id: 'ap1', creationTime: 1, sourcePlayerId: p1Id, effect: { description: 'P1 Effect' } } as any,
];

console.log('--- Test 1: Turn Player Priority ---');
console.log('Before Sort:', engine.state.effectQueue.map(e => `${e.effect.description} (${e.sourcePlayerId})`));
engine.sortEffectQueue();
console.log('After Sort (Expected P1 -> P2):', engine.state.effectQueue.map(e => `${e.effect.description} (${e.sourcePlayerId})`));

if (engine.state.effectQueue[0].sourcePlayerId === p1Id) {
    console.log('[PASS] Turn Player Priority');
} else {
    console.error('[FAIL] Turn Player Priority');
}

// Scenario 2: Timestamp Priority
// New effect (Time 2) added, Old effect (Time 0) added. Should sort to Old, New.
engine.state.effectQueue = [
    { id: 'new', creationTime: 2, sourcePlayerId: p1Id, effect: { description: 'New Effect (Time 2)' } } as any,
    { id: 'old', creationTime: 0, sourcePlayerId: p2Id, effect: { description: 'Old Effect (Time 0)' } } as any,
];

console.log('\n--- Test 2: Timestamp Priority ---');
engine.sortEffectQueue();
console.log('After Sort (Expected Old -> New):', engine.state.effectQueue.map(e => `${e.effect.description} (Time: ${e.creationTime})`));

if (engine.state.effectQueue[0].creationTime === 0) {
    console.log('[PASS] Timestamp Priority');
} else {
    console.error('[FAIL] Timestamp Priority');
}
