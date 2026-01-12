import { GameEngine } from './GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from './types';

// Mock Card with penetration
const penUnit: Card = {
    id: 'unit_pen', name: 'Penetration Unit', type: CardType.UNIT, attribute: Attribute.NONE, cost: 3, hit: 1, power: 5000,
    text: '', effects: [], keywords: ['관통']
};

// Mock Card with Mutual Destruction
const mdUnit: Card = {
    id: 'unit_md', name: 'MD Unit', type: CardType.UNIT, attribute: Attribute.NONE, cost: 2, hit: 1, power: 2000,
    text: '', effects: [
        {
            activation: ActivationCondition.EXIT,
            description: "Exit: Mutual Destruction",
            action: { type: 'MUTUAL_DESTRUCTION', params: {} }
        }
    ],
    keywords: ['공멸']
};

const dummyLeader: Card = { id: 'l', name: 'L', type: CardType.LEADER, effects: [], cost: 0, attribute: Attribute.NONE, text: '' };
const dummyDeck = Array(20).fill(dummyLeader);

const engine = new GameEngine('P1', 'P2', [...dummyDeck], [...dummyDeck], dummyLeader, dummyLeader);

// Scenario: P1 attacks with Penetration Unit. P2 defends with MD Unit.
// P1 Power 5000 > P2 Power 2000.
// Expected Outcome:
// 1. P2 Unit Destroyed (Immediate in logic, but events queued).
// 2. Result Effects Queued:
//    - P1 Penetration (from GameEngine) -> Queued as New Stamp
//    - P2 MD Exit Effect (from destroyUnit) -> Queued as New Stamp
// Priority Check:
// Both generated "after combat result".
// P2 Unit destroyed first? Or P1 Penetration calculated parallel?
// Logic:
// destroyUnit called -> P2 Exit Effect queued.
// THEN Penetration value calculated -> Penetration Effect queued.
// Both are "Result Steps".
// Order depends on implementation line order.
// Implementation: destroyUnit called FIRST. So P2 Exit Effect is queued FIRST (Timestamp T).
// Then Penetration Effect queued SECOND (Timestamp T+1 because queueEphemeral triggers increment).
// So P2 Exit Effect (MD) should resolve BEFORE Penetration?
// Wait, `queueEphemeralEffect` increments global step. `processEffects` (called by destroyUnit) also increments global step.
// So they will have different timestamps.
// destroyUnit -> processEffects -> Timestamp T.
// Penetration -> queueEphemeral -> Timestamp T+1.
// So MD resolves FIRST.

const p1 = engine.state.players[0];
const p2 = engine.state.players[1];
p1.unitZones[0].unit = penUnit;
p2.unitZones[0].unit = mdUnit;

engine.state.phase = Phase.ATTACK;
engine.state.turnPlayerIndex = 0;

console.log('--- Test: Combat Logic (MD vs Penetration) ---');

// Mock Combat Step to Resolution
// We can call stepBattleResolution directly if we setup state.
engine.state.combatStep = 'BATTLE';
// Force "Combat Blocked" state
engine.state.combatBlocked = true;
// pendingAttackerIndex
engine.state.pendingAttackerIndex = 0; // P1 Zone 0

// We need to trick the engine to think P2 Zone 0 is the blocker.
// stepBattleResolution derives blocker index from attacker index.
// "blockerZoneIndex = attackerZoneIndex" logic is in stepDefenseDeclaration... 
// stepBattleResolution RE-DERIVES it: 
// const blockerZoneIndex = this.state.players[this.state.turnPlayerIndex].unitZones.indexOf(attackerZone);
// So it assumes head-to-head.

// Call internal method (we can cast to any to access private, or just call advanceCombatStep if capable? No, stepBattleResolution is private)
// Let's modify verification to use `resolveCombat` (Wait, I removed it?)
// I refactored `stepBattleResolution`.
// I will use `(engine as any).stepBattleResolution(p1.unitZones[0])`.

// Mock processQueue to prevent execution and just inspect the queue
const originalProcessQueue = engine.effectManager.processQueue.bind(engine.effectManager);
engine.effectManager.processQueue = () => {
    // Do nothing, just let items stay in queue for inspection
    console.log('[Mock] processQueue called. Items in queue:', engine.state.effectQueue.length);
    return "PAUSED";
};

(engine as any).stepBattleResolution(p1.unitZones[0]);

console.log('Queue:', engine.state.effectQueue.map(e => `${e.effect.description} (T:${e.creationTime})`));

// Expected: MD (Exit) first, then Penetration.
const mdIndex = engine.state.effectQueue.findIndex(e => e.effect.description.includes("Mutual"));
const penIndex = engine.state.effectQueue.findIndex(e => e.effect.description.includes("Penetration"));

if (mdIndex !== -1 && penIndex !== -1) {
    if (mdIndex < penIndex) {
        console.log('[PASS] Mutual Destruction effects queued BEFORE Penetration (Correct Order: Exit -> Result)');
    } else {
        console.error('[FAIL] Penetration queued before MD. (Check timestamp logic)');
    }
} else {
    // If we missed MD because it was added via processEffects which calls processQueue...
    // MD is added via `processEffects`. `processEffects` calls `processQueue`.
    // My mock prevents `processQueue` from draining.
    // So MD should be in queue.
    console.error('[FAIL] Effects not found in queue.');
}

// Restore
engine.effectManager.processQueue = originalProcessQueue;
