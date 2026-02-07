import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function setupBasicGame() {
    const leader1 = getCard('ST01-001');
    const leader2 = getCard('ST01-001');
    const deck1 = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P1_C${i}`}));
    const deck2 = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P2_C${i}`}));
    return new GameEngine('P1', 'P2', deck1, deck2, leader1, leader2);
}

async function runST01Audit() {
    console.log("Starting ST01 Comprehensive Audit...");
    const engine = setupBasicGame();
    engine.currentPlayer.leaderLevel = 10;
    engine.opponentPlayer.leaderLevel = 10;
    engine.currentPlayer.levelZone!.isAwakened = true; // Force awakened

    // ST01-002 Neon (Vanilla)
    console.log("Checking ST01-002 Stats...");
    const neon = getCard('ST01-002');
    if (neon.power !== 3000 || neon.hit !== 1) throw new Error("ST01-002 stats wrong");

    // ST01-003 Besti (Attacker) - Already tested
    console.log("Checking ST01-003 Attacker...");
    engine.currentPlayer.unitZones[0].unit = getCard('ST01-003');
    engine.state.phase = Phase.ATTACK;
    engine.attack(0);
    const bestiPower = engine.getUnitPower(engine.currentPlayer.unitZones[0], engine.currentPlayer);
    // 2500 (Base) + 1000 (Attacker) + 1000 (Leader Awakened) = 4500
    if (bestiPower !== 4500) throw new Error(`ST01-003 Power expected 4500, got ${bestiPower}`);

    // ST01-005 Noise (Attacker)
    console.log("Checking ST01-005 Attacker...");
    engine.currentPlayer.unitZones[1].unit = getCard('ST01-005');
    engine.attack(1);
    const noisePower = engine.getUnitPower(engine.currentPlayer.unitZones[1], engine.currentPlayer);
    // 3000 (Base) + 2000 (Attacker) + 1000 (Leader Awakened) = 6000
    if (noisePower !== 6000) throw new Error(`ST01-005 Power expected 6000, got ${noisePower}`);

    // ST01-006 Noir (Entry Encounter)
    console.log("Checking ST01-006 Entry...");
    const targetNeon = { ...getCard('ST01-002'), id: 'TARGET' };
    engine.opponentPlayer.unitZones[0].unit = targetNeon;
    const noir = getCard('ST01-006');
    engine.currentPlayer.hand = [noir];
    engine.state.phase = Phase.MAIN;
    engine.playUnit(0, 0); // Plays Noir in lane 0
    if (engine.opponentPlayer.unitZones[0].unit !== null) throw new Error("ST01-006 failed to trash encounter unit");

    // ST01-008 Blanc (Passive)
    console.log("Checking ST01-008 Passive...");
    const blanc = getCard('ST01-008');
    engine.currentPlayer.unitZones[2].unit = blanc;
    // Neon has no Attacker keyword, should not be buffed by Blanc, but still has +1000 from Rapi
    const neon2 = getCard('ST01-002');
    engine.currentPlayer.unitZones[1].unit = null; // Clear Noise
    engine.currentPlayer.unitZones[1].buffs = []; // Clear Noise buffs
    engine.currentPlayer.hand = [neon2];
    engine.playUnit(0, 1);
    // 3000 (Base) + 1000 (Leader) = 4000
    const pwr = engine.getUnitPower(engine.currentPlayer.unitZones[1], engine.currentPlayer);
    console.log(`Neon2 Power in Lane 1: ${pwr}`);
    if (pwr !== 4000) throw new Error(`Blanc buffed non-attacker or Leader buff missing. Power: ${pwr}`);
    // Besti has Attacker keyword, should be buffed by both Blanc and Leader
    engine.currentPlayer.unitZones[0].unit = getCard('ST01-003');
    // 2500 (Base) + 1000 (Blanc) + 1000 (Leader) = 4500 (Wait, Besti is NOT attacking now, so no Attacker effect yet)
    if (engine.getUnitPower(engine.currentPlayer.unitZones[0], engine.currentPlayer) !== 4500) throw new Error(`Besti should be 4500 (2500+1000 from Blanc+1000 from Leader), got ${engine.getUnitPower(engine.currentPlayer.unitZones[0], engine.currentPlayer)}`);

    // ST01-010 Anis (Active + Cost)
    console.log("Checking ST01-010 Active...");
    const anis = getCard('ST01-010');
    engine.currentPlayer.unitZones[0].unit = anis;
    engine.opponentPlayer.unitZones[0].unit = getCard('ST01-002'); // Neon 3000
    engine.currentPlayer.hand = [getCard('ST01-002')]; // Hand for cost
    engine.activateEffect(0, 0);
    if (engine.state.interactionMode !== 'SELECT_COST') throw new Error("Anis failed to initiate cost selection");
    engine.selectCost(0);
    if (engine.opponentPlayer.unitZones[0].unit !== null) throw new Error("Anis failed to trash encounter unit after cost");

    // ST01-011 Rapi (Penetration) - Already tested
    
    // ST01-013 Strategic Reinforcement
    console.log("Checking ST01-013 Skill...");
    const trashUnit = getCard('ST01-002');
    engine.currentPlayer.trash = [trashUnit];
    const skill = getCard('ST01-013');
    const effect = skill.effects![0];
    const context = {
        player: engine.currentPlayer,
        opponent: engine.opponentPlayer,
        sourceCard: skill,
        machine: engine
    };
    engine.effectManager.executeEffect(effect, context, [trashUnit]);
    if (!engine.currentPlayer.hand.find(c => c.name === trashUnit.name)) throw new Error("ST01-013 failed to move card from trash to hand");

    // ST01-016 Rare Metal Boots
    console.log("Checking ST01-016 Item...");
    const boots = getCard('ST01-016');
    engine.currentPlayer.unitZones[1].items = [boots];
    engine.currentPlayer.unitZones[1].hasAttacked = false; // Reset for test
    engine.state.phase = Phase.ATTACK;
    engine.attack(1);
    // Neon2 (3000) + Item (Attacker +2000) + Leader (1000) = 6000
    const neon2Power = engine.getUnitPower(engine.currentPlayer.unitZones[1], engine.currentPlayer);
    if (neon2Power !== 6000) throw new Error(`ST01-016 Power expected 6000, got ${neon2Power}`);

    // ST01-017 Kevlar Glove
    console.log("Checking ST01-017 Item...");
    const glove = getCard('ST01-017');
    engine.currentPlayer.unitZones[0].unit = getCard('ST01-002'); // Reset lane 0 to Neon
    engine.currentPlayer.unitZones[0].items = [glove];
    engine.currentPlayer.unitZones[0].hasAttacked = false; // Reset for test
    engine.attack(0);
    const plunderValue = (engine as any).getPlunderValue(engine.currentPlayer.unitZones[0]);
    if (plunderValue !== 1) throw new Error(`ST01-017 Plunder expected 1, got ${plunderValue}`);

    console.log("ST01 Comprehensive Audit Passed!");
}

runST01Audit().catch(err => {
    console.error(err);
    process.exit(1);
});
