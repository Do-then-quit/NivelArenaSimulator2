import { GameEngine } from './GameEngine';
import { ActionRegistry } from './effectActions';
import { TargetSelector } from './TargetSelector';

import { CardType, Attribute, Zone, Phase, ActivationCondition } from './types';
import { createDeck, DUMMY_CARDS } from './CardDatabase';

// Mock console.log to reduce noise, or keep it for debugging
const originalLog = console.log;
// console.log = () => {}; 

function runTest(name: string, testFn: () => void) {
    try {
        console.log(`\n=== Running Test: ${name} ===`);
        testFn();
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.error(`[FAIL] ${name}`, e);
    }
}

// Helper to setup engine with ST04 cards
function setupEngine() {
    const deck = createDeck();
    const leader = { ...deck[0], type: CardType.LEADER, name: 'Dummy Leader' };
    const engine = new GameEngine('P1', 'P2', deck, deck, leader, leader);
    // Force set ST04 cards in hands/field for testing
    // We need to fetch specific ST04 cards from database (by ID)
    // Since createDeck uses random/dummy logic, we'll manually inject.
    // However, DUMMY_CARDS are standard.
    return engine;
}

function getCard(engine: GameEngine, id: string) {
    // Hacky access to DUMMY_CARDS via a generated deck or import
    // Let's just find it in a fresh deck created from DB
    // const deck = createDeck();
    // Wait, createDeck returns a mix. 
    // We can rely on engine's players having full decks initially?
    // Let's manually constructing cards is safer if we import DUMMY_CARDS,
    // but DUMMY_CARDS is not invalid export in this context easily without ts-node resolving JSON.
    // We will assume the engine loads everything into internal players or we can mock.

    // Better: use engine.state.players[0].deck to find cards if seeded properly,
    // OR create mock cards with correct IDs and Effects if we want isolation.
    // For integration test, we want REAL effects.

    // We can import DUMMY_CARDS from CardDatabase.ts if we export it.
    // (We do export it).

    const card = DUMMY_CARDS.find((c: any) => c.id === id);
    if (!card) throw new Error(`Card ${id} not found in DB`);
    return { ...card, id: `${id}_test` }; // Clone
}

runTest('ST04-007 Alice Penetration Condition', () => {
    const engine = setupEngine();
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];

    // Setup Alice (ST04-007) for P1
    const alice = getCard(engine, 'ST04-007');
    p1.unitZones[0].unit = alice;

    // Setup Opponent Weak Unit (Cost 3) - Blockable
    const weakUnit = { ...getCard(engine, 'ST01-002'), cost: 3, name: 'Weak', power: 3000 };
    p2.unitZones[0].unit = weakUnit;

    // Setup Opponent Strong Unit (Cost 4) - Unblockable (Penetration)
    // Wait, card text: "4코스트 이상인 상대 유닛은 이 유닛의 공격을 방어할 수 없다"
    // So Cost 4+ CANNOT block.
    // Cost 3 CAN block.

    const strongUnit = { ...getCard(engine, 'ST01-002'), cost: 4, name: 'Strong', power: 3000 };
    p2.unitZones[1].unit = strongUnit;

    // Case 1: Attack Strong Unit (Cost 4) -> Should NOT allow block?
    // Actually, "Breakthrough" (New keyword) or "Penetration"?
    // Card says: "돌파[4코스트 이상]" -> Breakthrough.
    // Breakthrough checks if defender is valid blocker.
    // Check isValidBlocker in GameEngine (we assume it's implemented or we check logic).

    // Let's manually trigger attack on Strong Unit's lane
    // Since direct attack isn't unit-to-unit targeting in this game (it's Lane vs Lane),
    // "Attack" means P1 Unit 0 attacks.
    // P2 Unit 1 (Strong) is in a different lane?
    // If P1 attacks Lane 0, P2 Unit 0 (Weak) is the encounter.
    // Blockers are "Adjacent".

    // Let's put Alice in Lane 1 (Center).
    p1.unitZones[1].unit = alice; // Lane 1

    // Opponent:
    // Lane 0: Weak (Cost 3)
    // Lane 1: Empty
    // Lane 2: Strong (Cost 4)

    p2.unitZones[0].unit = weakUnit;
    p2.unitZones[2].unit = strongUnit;

    // Alice (Lane 1) attacks Direct (Empty Lane 1).
    // Can Weak (Lane 0) Block? Yes (Cost 3 < 4).
    // Can Strong (Lane 2) Block? No (Cost 4 >= 4).

    // Verification:
    // GameEngine.getBreakthroughLimit(attacker) -> 4 (if impl correct in st04.ts)
    // GameEngine.canBlock(blocker, attacker) -> 
    //   if blocker.cost >= limit -> return false.

    // We need to inject 'breakthrough' params or check effect manually logic?
    // ST04-007 effect: action: { type: 'BREAKTHROUGH', params: { costMin: 4 } }
    // Note: card text says "costMin: 4" (4 or more).

    // Simulate resolving 'ATTACKER' effects
    engine.processEffects(alice, ActivationCondition.ATTACKER, { player: p1, opponent: p2, sourceCard: alice, machine: engine });

    // Check if breakthrough limit is set
    // This usually sets a temporary state or we check "getBreakthroughLimit" helper if it reads active/passive effects.
    // For ATTACKER activation, effect action 'BREAKTHROUGH' executes.
    // In `effectActions.ts`, `breakthrough` is empty? 
    // Ah, `breakthrough` action implementation was empty. 
    // This means it relies on GameEngine checking the effect definition directly?
    // OR we need to set a state.
    // Let's check `GameEngine.ts` implementation of `canBlock`.

    /*
    public canBlock(blockerZone: UnitZoneState, attackerZone: UnitZoneState): boolean {
        // ...
        // Check Breakthrough
        const limit = this.getBreakthroughLimit(attackerZone);
        if (limit !== null && blockerZone.unit!.cost >= limit) return false;
        // ...
    }
    */

    // So we need to ensure `getBreakthroughLimit` works.
    // It iterates active effects. 
    // If our ATTCKER effect is processed and added to `temporaryEffects`?
    // Wait, ATTACKER effects are instant. They don't usually add "passive" unless duration is set.
    // ST04-007 doesn't have duration.
    // Is 'BREAKTHROUGH' continuous or triggered?
    // "어태커 : 돌파..." -> Triggered when attacking.
    // So it should Apply a buff/effect "Grant Breakthrough" for the battle?
    // Currently `st04.ts`: action: { type: 'BREAKTHROUGH', params: { costMin: 4 } }
    // `effectActions.ts`: `breakthrough` is EMPTY.
    // THIS IS A BUG/MISSING FEATURE.
    // `ATTACKER` effect should grant a temporary `BREAKTHROUGH` property to the unit for the battle.
    // Or `getBreakthroughLimit` scans for `ATTACKER` definition? (Unlikely).

    // Verify Breakthrough Logic directly
    // Alice implies "Breakthrough [Cost >= 4]"

    // Simulate applying the effect first (as if ATTACKER triggered)
    // We can use processEffects for this
    engine.processEffects(alice, ActivationCondition.ATTACKER, { player: p1, opponent: p2, unitZone: p1.unitZones[1], machine: engine, sourceCard: alice });

    // Check if temporary effect is applied
    const tempEffects = p1.unitZones[1].temporaryEffects;
    console.log("Temp Effects:", tempEffects.length);
    if (tempEffects.length === 0) throw new Error("Breakthrough effect not applied!");

    // Check logic in GameEngine (using 'any' to access private/protected if needed, or if I exposed them)
    // kept getBreakthroughLimits private? Yes.
    // Let's rely on internal state or behavior?
    // The previous logs showed "Checking implementation...".

    // Since I modified GameEngine to use 'getBreakthroughLimits', let's test that method if possible.
    // Hack: Cast engine to any to access private method for verification
    const limits = (engine as any).getBreakthroughLimits(p1.unitZones[1]);
    console.log("Breakthrough Limits:", limits);

    if (limits.min !== 4) throw new Error(`Expected Min Limit 4, got ${limits.min}`);

    // Logic Check
    // Strong Unit (Cost 4) -> Should NOT be able to block
    const strongCost = 4;
    let canBlockStrong = true;
    if ((limits.max !== undefined && strongCost <= limits.max) || (limits.min !== undefined && strongCost >= limits.min)) {
        canBlockStrong = false;
    }
    if (canBlockStrong) throw new Error("Strong Unit (Cost 4) should NOT be able to block (Breakthrough 4+)");

    // Weak Unit (Cost 3) -> Should be able to block
    const weakCost = 3;
    let canBlockWeak = true;
    if ((limits.max !== undefined && weakCost <= limits.max) || (limits.min !== undefined && weakCost >= limits.min)) {
        canBlockWeak = false;
    }
    if (!canBlockWeak) throw new Error("Weak Unit (Cost 3) SHOULD be able to block");

});

runTest('ST04-015 Paradise Lost Target Logic', () => {
    // Need to verify isLowestCost
    const engine = setupEngine();
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];

    // P2 has 3 units: Cost 5, Cost 2, Cost 3
    p2.unitZones[0].unit = { ...getCard(engine, 'ST01-002'), cost: 5, name: 'High' };
    p2.unitZones[1].unit = { ...getCard(engine, 'ST01-002'), cost: 2, name: 'Low' };
    p2.unitZones[2].unit = { ...getCard(engine, 'ST01-002'), cost: 3, name: 'Mid' };

    // P1 plays Paradise Lost Trigger
    // Effect: targets: { scope: 'OPP_FIELD', conditions: { isLowestCost: true } }

    const card = getCard(engine, 'ST04-015');

    // Resolve Target Schema
    const schema = card.effects.find((e: any) => e.activation === ActivationCondition.DAMAGE_TRIGGER).targets;

    const context = { player: p1, opponent: p2, sourceCard: card, machine: engine };
    const candidates = TargetSelector.resolve(engine, schema, context);

    console.log("Candidates for Lowest Cost:", candidates.map((c: any) => c.unit?.name));

    if (candidates.length !== 1) throw new Error("Should have exactly 1 lowest cost candidate");
    if (candidates[0].unit.name !== 'Low') throw new Error("Should select Low (Cost 2)");
});

runTest('ST04-001 Dorothy Awaken & Passive', () => {
    const engine = setupEngine();
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];

    // Setup Dorothy Leader
    const dorothy = getCard(engine, 'ST04-001');
    p1.levelZone = { ...dorothy, isAwakened: false };
    p1.leaderLevel = 3;

    // Check Awaken Condition (Level >= 4)
    // Manually trigger check
    // In game, checkAwakening is called on level up.

    engine.addLeaderLevel(0, 1); // Level 4
    if (!p1.levelZone.isAwakened) throw new Error("Leader should have awakened at Level 4");

    // Check Passive: +1000 Power during Opponent Turn
    // Setup a unit for P1
    const unit = { ...getCard(engine, 'ST01-002'), power: 3000, name: 'Friend' };
    p1.unitZones[0].unit = unit;

    // Case 1: My Turn -> No Buff
    engine.state.turnPlayerIndex = 0; // P1 Turn
    let power = engine.getUnitPower(p1.unitZones[0], p1);
    if (power !== 3000) throw new Error(`Should have base power 3000 on my turn, got ${power}`);

    // Case 2: Opponent Turn -> +1000 Buff
    // We need to ensure the passive effect is "active" or "registered".
    // Leader effects are always active if awake?
    // GameEngine.getUnitPower calls 'getConstantBuffs'. Does it check Leader Effects?
    // YES, commonly games check leader.
    // Let's verify GameEngine.getUnitPower implementation.

    /* 
    getUnitPower checks: 
    - Base Power
    - Items (stat.power)
    - Buffs (stat.power)
    - Continuous Effects (Leader/Field) -> This is the key.
    */

    engine.state.turnPlayerIndex = 1; // P2 Turn (Opponent)
    power = engine.getUnitPower(p1.unitZones[0], p1);

    // Note: getUnitPower might need to be refreshed or effect re-calculated?
    // Leader passives are usually calculated specifically in `getUnitPower` or `calculateStats`.
    // If GameEngine doesn't explicitly check Leader Passives, this will fail.
    // Let's assume it works or I'll catch it.

    if (power !== 4000) {
        console.log("Checking Leader Effects...");
        // Debug
        // Check if Dorothy effect is parsed correctly
        const eff = p1.levelZone.effects?.find(e => e.activation === ActivationCondition.PASSIVE);
        console.log("Dorothy Passive:", eff);
        // Condition: OPPONENT_TURN
    }

    if (power !== 4000) throw new Error(`Should have +1000 power (4000) on opponent turn, got ${power}`);
});

runTest('ST04-011 Guardian: Barrier[3]', () => {
    const engine = setupEngine();
    const p1 = engine.state.players[0]; // Defender (Me)
    const p2 = engine.state.players[1]; // Attacker (Opponent)

    // Setup:
    // P2 Attacker: Center Lane (Index 1)
    p2.unitZones[1].unit = { ...getCard(engine, 'ST01-002'), power: 2000, name: 'Attacker' };

    // P1 Defender: No unit in Center (Index 1).
    // P1 Guardian: Left Lane (Index 0). ST04-011.
    const guardian = getCard(engine, 'ST04-011');
    p1.unitZones[0].unit = { ...guardian, name: 'Guardian Unit' };
    p1.hand = [getCard(engine, 'ST01-013'), getCard(engine, 'ST01-013'), getCard(engine, 'ST01-013'), getCard(engine, 'ST01-013')]; // 4 cards

    // P2 Attacks P1's Center Lane (Index 1)
    engine.state.turnPlayerIndex = 1; // P2 turn
    engine.state.phase = Phase.ATTACK; // Ensure Attack Phase
    engine.state.combatStep = 'NONE';

    // Ensure P2 unit is ready to attack (not exhausted)
    p2.unitZones[1].hasAttacked = false;

    engine.attack(1);

    // Flow: 
    // 1. Attack Declared. (Queue empty, proceeds).
    // 2. Defense Declaration.
    // 3. Guardian Trigger -> P1 prompt.

    // Check pending effect (Guardian)
    const pending = engine.state.pendingEffect as any;
    if (!pending) throw new Error("Expected Pending Effect (Guardian Cost)");
    if (pending.costToPay?.type !== 'TRASH_HAND' || pending.costToPay?.amount !== 3) {
        throw new Error("Expected Barrier[3] Cost (Trash 3)");
    }

    // Verify Cost Payment Source (Should be Defender P1)
    const p1TrashCount = p1.trash.length;

    // Pay Cost (Trash 3 cards)
    engine.selectCost(0);
    engine.selectCost(0);
    engine.selectCost(0);

    // Check if P1 trash increased by 3
    if (p1.trash.length !== p1TrashCount + 3) throw new Error(`P1 Trash should increase by 3 (Got ${p1.trash.length})`);

    // Logic should proceed. 
    // Action 'BLOCK' executes -> Redirects Blocker.
    // Queue completes.
    // engine.advanceCombatStep() -> BATTLE.

    // Combat executes synchronously because no further interaction was needed
    // So we might be at 'NONE' or 'BATTLE_END'
    console.log("Combat State after cost payment:", engine.state.combatStep);

    // Check if Guardian blocked (by checking logs or result)
    // We verified "Redirecting attack" in logs.
    // Check if Attacker is trashed.
    if (p2.unitZones[1].unit) throw new Error("Attacker should be destroyed");

    // Check if redirectBlockerZone WAS involved.
    // Since combat finished, redirectBlockerZone might be reset.
    // We can rely on unit destruction result.

    console.log("Guardian Successfully Intercepted!");

    // Verify Redirected Logic in Battle Resolution??
    // Actually we are IN Battle Step now (or effectively entered it).
    // The test runner doesn't loop engine ticks, so 'stepBattleResolution' was called at end of selectCost -> processEffect -> complete -> advance.

    // Check result: 
    // Attacker 2000 vs Guardian (5000?). Guardian wins. Attacker dies.
    // Wait, ST04-011 Power? ST04.json says 3000.
    // ST01-002 Power? 3000.
    // 2000 vs 3000. Attacker dies. 

    // Check if Attacker is trashed
    // (Note: resolution happened inside stepBattleResolution called by advanceCombatStep)
    // Wait, stepBattleResolution queues destruction.
    // We didn't flush queue again.

    engine.effectManager.processQueue();

    // Attacker (P2 Zone 1) should be null (trashed)
    if (p2.unitZones[1].unit) throw new Error("Attacker should be destroyed");
});

runTest('ST04-011 Guardian: Optional Cancel', () => {
    const engine = setupEngine();
    const p1 = engine.state.players[0]; // Defender
    const p2 = engine.state.players[1]; // Attacker

    // Setup:
    p2.unitZones[1].unit = { ...getCard(engine, 'ST01-002'), power: 2000, name: 'Attacker' };
    const guardian = getCard(engine, 'ST04-011');
    p1.unitZones[0].unit = { ...guardian, name: 'Guardian Unit' };
    p1.hand = [getCard(engine, 'ST01-013'), getCard(engine, 'ST01-013'), getCard(engine, 'ST01-013'), getCard(engine, 'ST01-013')];

    // P2 Attacks P1's Center Lane (Index 1)
    engine.state.turnPlayerIndex = 1;
    engine.state.phase = Phase.ATTACK;
    engine.state.combatStep = 'NONE';
    p2.unitZones[1].hasAttacked = false;
    engine.attack(1);

    // Guardian Trigger -> P1 prompt
    const pending = engine.state.pendingEffect as any;
    if (!pending) throw new Error("Expected Pending Effect");

    // CANCEL the effect (User chooses not to pay)
    engine.cancelPendingEffect();

    console.log("Cancelled Guardian Effect.");

    // Logic should proceed to fallback (No Block -> Direct Attack)
    // Combat resolves. One tick of queue might be needed?
    // cancelPendingEffect calls resumeQueue.
    // Queue empty -> onQueueCompleted -> advanceCombatStep -> BATTLE.
    // BATTLE (no blocker) -> Direct Damage.

    // Check if P1 took damage?
    // Or check logs?
    // We can check if "redirectBlockerZone" is null.
    if (engine.state.redirectBlockerZone) throw new Error("Redirect Blocker Zone should be null");

    // Check if Attacker is STILL ALIVE (Direct Attack doesn't kill attacker)
    if (!p2.unitZones[1].unit) throw new Error("Attacker should survive (Direct Attack)");

    console.log("Guardian Cancelled Successfully (Direct Attack occurred)");
});
