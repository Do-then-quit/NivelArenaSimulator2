import { GameEngine } from './GameEngine';
import { PlayerState, Phase, Card, CardType, ActivationCondition } from './types';
import { DUMMY_CARDS } from './CardDatabase';
import { RuleValidator } from './RuleValidator';

export class DebugManager {
    game: GameEngine;
    renderCallback: () => void;

    constructor(game: GameEngine, renderCallback: () => void) {
        this.game = game;
        this.renderCallback = renderCallback;
        console.log("DebugManager Initialized. Access via `window.debug`.");
    }

    private getPlayer(playerIndex: number): PlayerState {
        return this.game.state.players[playerIndex];
    }

    private getCard(id: string): Card | null {
        const card = DUMMY_CARDS.find(c => c.id === id);
        if (!card) return null;
        return { ...card, id: `${card.id}_debug_${Date.now()}` };
    }

    setLeader(playerIndex: number, cardId: string) {
        const player = this.getPlayer(playerIndex);
        const card = this.getCard(cardId);
        if (player && card) {
            player.levelZone = card;
            console.log(`Player ${playerIndex} Leader set to ${card.name}`);
            this.renderCallback();
        }
    }

    setLeaderLevel(playerIndex: number, level: number) {
        const player = this.getPlayer(playerIndex);
        if (player) {
            player.leaderLevel = level;
            console.log(`Player ${playerIndex} Level set to ${level}`);
            this.game.checkAwakening(playerIndex); // Ensure immediate awakening if condition met
            this.renderCallback();
        }
    }

    setHand(playerIndex: number, cardIds: string[]) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;

        const newHand: Card[] = [];
        for (const id of cardIds) {
            const card = this.getCard(id);
            if (card) {
                newHand.push(card);
            } else {
                console.warn(`Card ${id} not found.`);
            }
        }
        player.hand = newHand;
        console.log(`Player ${playerIndex} Hand updated.`);
        this.renderCallback();
    }

    setField(playerIndex: number, unitIds: (string | null)[]) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;

        for (let i = 0; i < 3; i++) {
            const id = unitIds[i];
            const zone = player.unitZones[i];

            if (zone.unit) {
                zone.unit = null;
                zone.items = [];
                zone.buffs = [];
            }

            if (id) {
                const card = this.getCard(id);
                if (card && card.type === CardType.UNIT) {
                    zone.unit = card;
                } else {
                    console.warn(`Unit ${id} not found or not a unit.`);
                }
            }
        }
        console.log(`Player ${playerIndex} Field updated.`);
        this.renderCallback();
    }

    forcePhase(phase: Phase) {
        this.game.state.phase = phase;
        console.log(`Phase forced to ${phase}`);
        this.renderCallback();
    }

    dealDamage(playerIndex: number, amount: number) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;
        this.game.dealDamage(player, amount);
        this.renderCallback();
        console.log(`Dealt ${amount} damage to player ${playerIndex}.`);
    }

    setupGuiltyScenario() {
        console.log("Setting up Guilty (ST02-009) Trigger Scenario...");

        // 1. Reset both players
        this.game.state.players[0].unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        this.game.state.players[1].unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        this.game.state.players[0].damage = [];
        this.game.state.players[1].damage = [];
        this.game.state.players[0].trash = [];
        this.game.state.players[1].trash = [];

        // 2. ST02-004 (Yulia) on P0 Field (Target)
        // const yulia = this.getCard("ST02-004");
        const marchana = this.getCard("ST02-008");
        // if (yulia) this.game.state.players[0].unitZones[0].unit = yulia;
        if (marchana) this.game.state.players[0].unitZones[1].unit = marchana;

        // 3. ST02-009 (Guilty) on top of P1 Deck (Trigger)
        const guilty = this.getCard("ST02-009");
        if (guilty) this.game.state.players[1].deck.push(guilty);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 0 has a 2-cost unit (Yulia) on field.");
        console.log("2. Player 1 has Guilty (ST02-009) on top of deck.");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c to trigger.", 'color: #e17055; font-weight: bold', 'color: inherit');
    }

    setupST01_013_Scenario() {
        console.log("Setting up ST01-013 (Reinforcement) Scenario...");

        // 1. Reset current player (P0)
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.trash = [];
        p0.hand = [];
        p0.leaderLevel = 10;
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;

        // 2. Add ST01-013 to hand
        const reinforcement = this.getCard("ST01-013");
        if (reinforcement) p0.hand.push(reinforcement);

        // 3. Add valid unit to trash (Neon ST01-002, Cost 1)
        const neon = this.getCard("ST01-002");
        if (neon) p0.trash.push(neon);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 has 'Reinforcement' (ST01-013) in hand.");
        console.log("2. Player 0 has 'Neon' (ST01-002) in trash.");
        console.log("3. Drag 'Reinforcement' to the SKILL zone to activate.");
    }

    setupST01_001_Scenario() {
        console.log("Setting up ST01-001 (Rapi Leader) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        [p0, p1].forEach(p => {
            p.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
            p.trash = []; p.hand = []; p.damage = [];
        });
        p0.leaderLevel = 4;
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;
        const neon = this.getCard("ST01-002");
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 is Level 4 with Neon on field.");
        console.log("2. Click 'Next Phase' until Level Up to reach Level 5.");
        console.log("3. Confirm Leader AWAKENS and Neon power increases by 1000.");
    }

    setupST01_002_Scenario() {
        console.log("Setting up ST01-002 (Neon) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        const neon = this.getCard("ST01-002");
        if (neon) p0.hand.push(neon);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon (Vanilla Unit) in hand.");
        console.log("2. Drag Neon to a Unit Zone.");
    }

    setupST01_003_Scenario() {
        console.log("Setting up ST01-003 (Besti) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        const besti = this.getCard("ST01-003");
        if (besti) p0.hand.push(besti);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Besti (Attacker) in hand.");
        console.log("2. Play Besti, go to ATTACK phase, and Attack.");
        console.log("3. Confirm power increases by 1000 during attack.");
    }

    setupST01_004_Scenario() {
        console.log("Setting up ST01-004 (Silver) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const silver = this.getCard("ST01-004");
        if (silver) p0.hand.push(silver);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Silver (Vanilla Unit) in hand.");
        console.log("2. Drag Silver to a Unit Zone.");
    }

    setupST01_005_Scenario() {
        console.log("Setting up ST01-005 (Noise) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const noise = this.getCard("ST01-005");
        if (noise) p0.hand.push(noise);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Noise (Attacker) in hand.");
        console.log("2. Play Noise, go to ATTACK phase, and Attack.");
        console.log("3. Confirm power increases by 2000 during attack.");
    }

    setupST01_006_Scenario() {
        console.log("Setting up ST01-006 (Noir) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const noir = this.getCard("ST01-006");
        const target = this.getCard("ST01-002");
        if (noir) p0.hand.push(noir);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Noir in hand, opponent has Neon in Lane 0.");
        console.log("2. Play Noir in Lane 0.");
        console.log("3. Confirm opponent's Neon is trashed by Entry effect.");
    }

    setupST01_007_Scenario() {
        console.log("Setting up ST01-007 (Viper) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        const viper = this.getCard("ST01-007");
        if (viper) p0.hand.push(viper);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Viper (Attacker) in hand.");
        console.log("2. Play Viper, go to ATTACK phase, and Attack.");
        console.log("3. Confirm power increases by 1000 during attack.");
    }

    setupST01_008_Scenario() {
        console.log("Setting up ST01-008 (Blanc) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        const blanc = this.getCard("ST01-008");
        const besti = this.getCard("ST01-003");
        if (blanc) p0.hand.push(blanc);
        if (besti) p0.unitZones[0].unit = besti;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Besti on field, Blanc in hand.");
        console.log("2. Play Blanc.");
        console.log("3. Confirm Besti power increases by 1000 due to Blanc's Passive.");
    }

    setupST01_009_Scenario() {
        console.log("Setting up ST01-009 (Emma) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        const emma = this.getCard("ST01-009");
        if (emma) p0.hand.push(emma);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Emma (Vanilla Unit) in hand.");
        console.log("2. Drag Emma to a Unit Zone.");
    }

    setupST01_010_Scenario() {
        console.log("Setting up ST01-010 (Anis) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 6;
        const anis = this.getCard("ST01-010");
        const fodder = this.getCard("ST01-002");
        const target = this.getCard("ST01-002");
        if (anis) p0.unitZones[0].unit = anis;
        if (fodder) p0.hand.push(fodder);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Anis on field, fodder in hand, opponent unit in Lane 0.");
        console.log("2. Click Anis 'Active', select fodder to shuffle.");
        console.log("3. Confirm opponent unit is trashed.");
    }

    setupST01_011_Scenario() {
        console.log("Setting up ST01-011 (Rapi Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 7;
        const rapi = this.getCard("ST01-011");
        const target = this.getCard("ST01-002");
        if (rapi) p0.unitZones[0].unit = rapi;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Rapi on field, opponent unit in Lane 0.");
        console.log("2. Go to ATTACK phase and attack opponent unit.");
        console.log("3. Confirm opponent unit trashed AND opponent takes 1 penetration damage.");
    }

    setupST01_012_Scenario() {
        console.log("Setting up ST01-012 (Weakness Insight) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        const insight = this.getCard("ST01-012");
        const target = this.getCard("ST01-002");
        if (insight) p0.hand.push(insight);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Weakness Insight in hand, opponent has unit in Lane 0.");
        console.log("2. Play Weakness Insight, select opponent unit.");
        console.log("3. Confirm opponent unit power decreases by 2000.");
    }

    setupST01_014_Scenario() {
        console.log("Setting up ST01-014 (Firepower Only!) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        const firepower = this.getCard("ST01-014");
        const neon = this.getCard("ST01-002");
        if (firepower) p0.hand.push(firepower);
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon on field, 'Firepower Only!' in hand.");
        console.log("2. Play 'Firepower Only!'.");
        console.log("3. Confirm all friendly unit power increases by 2000.");
    }

    setupST01_015_Scenario() {
        console.log("Setting up ST01-015 (Missile) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        const missile = this.getCard("ST01-015");
        const target = this.getCard("ST01-009"); // Emma, 7000 Power
        if (missile) p0.hand.push(missile);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Missile in hand, opponent has Emma in Lane 0.");
        console.log("2. Play Missile, select opponent Emma.");
        console.log("3. Confirm opponent Emma power decreases by 5000.");
    }

    setupST01_016_Scenario() {
        console.log("Setting up ST01-016 (Rare Metal Boots) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const boots = this.getCard("ST01-016");
        const unit = this.getCard("ST01-002");
        if (boots) p0.hand.push(boots);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon on field, Boots in hand.");
        console.log("2. Equip Boots to Neon.");
        console.log("3. Attack with Neon, confirm power increases by 2000.");
    }

    setupST01_017_Scenario() {
        console.log("Setting up ST01-017 (Kevlar Glove) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        const glove = this.getCard("ST01-017");
        const unit = this.getCard("ST01-002");
        const target = this.getCard("ST01-006"); // Noir, 2000 Power
        if (glove) p0.hand.push(glove);
        if (unit) p0.unitZones[0].unit = unit;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon on field, Glove in hand, opponent has Noir in Lane 0.");
        console.log("2. Equip Glove to Neon, advance to ATTACK, and attack Noir.");
        console.log("3. Neon (3000) vs Noir (2000). Confirm Noir trashed and you DRAW a card (Plunder).");
    }

    setupST02_001_Scenario() {
        console.log("Setting up ST02-001 (Guilty Leader) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "ST02-001");
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 is Level 5.");
        console.log("2. Current Size: " + this.game.getPlayerSize(p0));
        console.log("3. Click 'Next Phase' to Level Up to 6.");
        console.log("4. Confirm Leader AWAKENS and Size increases by 1 (Level 6 + Awakened 1 = 7).");
    }

    setupST02_002_Scenario() {
        console.log("Setting up ST02-002 (N102) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-002");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. N102 (Vanilla Unit) in hand.");
        console.log("2. Drag N102 to a Unit Zone.");
    }

    setupST02_003_Scenario() {
        console.log("Setting up ST02-003 (Mica) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const mica = this.getCard("ST02-003");
        if (mica) p0.unitZones[0].unit = mica;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Mica on field.");
        console.log("2. Overwrite Mica with another unit or reach 0 power to trash her.");
        console.log("3. Confirm Leader Level increases by 1 due to Exit effect.");
    }

    setupST02_004_Scenario() {
        console.log("Setting up ST02-004 (Yulia) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-004");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Yulia (Vanilla Unit) in hand.");
        console.log("2. Drag Yulia to a Unit Zone.");
    }

    setupST02_005_Scenario() {
        console.log("Setting up ST02-005 (Yan) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST02-001");
        const yan = this.getCard("ST02-005");
        if (yan) p0.hand.push(yan);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Yan in hand.");
        console.log("2. Play Yan.");
        console.log("3. Confirm Leader Level increases by 1 due to Entry effect.");
    }

    setupST02_006_Scenario() {
        console.log("Setting up ST02-006 (Dora) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-006");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Dora (Vanilla Unit) in hand.");
        console.log("2. Drag Dora to a Unit Zone.");
    }

    setupST02_007_Scenario() {
        console.log("Setting up ST02-007 (Breed) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const breed = this.getCard("ST02-007");
        const fodder = this.getCard("ST02-002");
        const baseUnit = this.getCard("ST02-002");
        if (breed) p0.unitZones[0].unit = breed;
        if (baseUnit) p0.unitZones[1].unit = baseUnit;
        if (fodder) p0.hand.push(fodder);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Breed and N102 (Base) on field, fodder in hand.");
        console.log("2. Click Breed 'Active', select fodder to trash.");
        console.log("3. Confirm N102 hit increases by 1.");
    }

    setupST02_008_Scenario() {
        console.log("Setting up ST02-008 (Marciana) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-008");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Marciana (Vanilla Unit) in hand.");
        console.log("2. Drag Marciana to a Unit Zone.");
    }

    setupST02_009_Scenario() {
        console.log("Setting up ST02-009 (Guilty Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = []; p1.damage = [];
        this.setLeader(0, "ST02-001");
        // Ensure P1 also has appropriate leader if needed, or leave as default.
        // But the trigger is P1's.
        this.setLeader(1, "ST02-001"); // Set P1 leader too for consistency
        const guilty = this.getCard("ST02-009");
        const target = this.getCard("ST02-005"); // Yan, Cost 3
        if (guilty) p1.deck.push(guilty);
        if (target) p0.unitZones[0].unit = target;
        this.renderCallback();
        console.group("SCENARIO READY");
        console.log("1. Opponent (P0) has Yan (Cost 3) in Lane 0.");
        console.log("2. Guilty unit is on top of your (P1) deck.");
        console.log("3. Click Next Phase until it's P1's turn, then use console: window.debug.dealDamage(1, 1).");
        console.log("4. Confirm Trigger activates, select Yan to trash.");
        console.groupEnd();
    }

    setupST02_010_Scenario() {
        console.log("Setting up ST02-010 (Snow White) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 6;
        this.setLeader(0, "ST02-001");
        const snow = this.getCard("ST02-010");
        const blocker = this.getCard("ST02-004"); // Yulia, Cost 2
        if (snow) p0.unitZones[0].unit = snow;
        if (blocker) p1.unitZones[0].unit = blocker;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Snow White vs Yulia (Cost 2) in Lane 0.");
        console.log("2. Advance to ATTACK and attack with Snow White.");
        console.log("3. Confirm Breakthrough logic prevents Yulia from blocking.");
    }

    setupST02_011_Scenario() {
        console.log("Setting up ST02-011 (Diesel) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "ST02-001");
        const diesel = this.getCard("ST02-011");
        if (diesel) p0.unitZones[0].unit = diesel;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Diesel on field, Leader Level 5.");
        console.log("2. Confirm Diesel power is 3000 + (5*1000) = 8000.");
        console.log("3. Increase Leader Level via console: window.debug.setLeaderLevel(0, 6).");
        console.log("4. Confirm Diesel power increases to 9000.");
    }

    setupST02_012_Scenario() {
        console.log("Setting up ST02-012 (Crescendo) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const crescendo = this.getCard("ST02-012");
        const unit = this.getCard("ST02-002");
        if (crescendo) p0.hand.push(crescendo);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. N102 on field, Crescendo in hand.");
        console.log("2. Play Crescendo on N102.");
        console.log("3. Confirm N102 power increases by 3000.");
    }

    setupST02_013_Scenario() {
        console.log("Setting up ST02-013 (Master's Grace) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const grace = this.getCard("ST02-013");
        if (grace) p0.hand.push(grace);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Master's Grace' in hand, Leader Level 1.");
        console.log("2. Play 'Master's Grace'.");
        console.log("3. Confirm Leader Level increases to 2.");
    }

    setupST02_014_Scenario() {
        console.log("Setting up ST02-014 (Prize) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST02-001");
        const prize = this.getCard("ST02-014");
        if (prize) p0.hand.push(prize);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Prize' in hand.");
        console.log("2. Play 'Prize'.");
        console.log("3. Confirm you pick 1 card from top 3 and hand size increases (or stays same after play/draw).");
    }

    setupST02_015_Scenario() {
        console.log("Setting up ST02-015 (Acceleration) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const acceleration = this.getCard("ST02-015");
        const myUnit = this.getCard("ST02-006"); // Dora, 5500
        const oppUnit = this.getCard("ST02-004"); // Yulia, 4500
        if (acceleration) p0.hand.push(acceleration);
        if (myUnit) p0.unitZones[0].unit = myUnit;
        if (oppUnit) p1.unitZones[0].unit = oppUnit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Dora vs Yulia in Lane 0.");
        console.log("2. Play 'Acceleration' and select Lane 0.");
        console.log("3. Confirm Yulia (lowest power) is trashed.");
    }

    setupST02_016_Scenario() {
        console.log("Setting up ST02-016 (Kevlar Protector) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-016");
        const unit = this.getCard("ST02-002");
        if (card) p0.hand.push(card);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. N102 on field, Kevlar Protector in hand.");
        console.log("2. Equip Kevlar Protector to N102.");
        console.log("3. Confirm N102 power increases by 2000.");
    }

    setupST02_017_Scenario() {
        console.log("Setting up ST02-017 (Rare Metal Helmet) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-017");
        const unit = this.getCard("ST02-008"); // Marciana, Cost 4
        if (card) p0.hand.push(card);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Marciana (Cost 4) on field, Helmet in hand.");
        console.log("2. Equip Helmet to Marciana.");
        console.log("3. Confirm Marciana hit increases by 1.");
    }

    private async runTest(name: string, testFn: () => Promise<void> | void) {
        console.group(`RUNNING TEST: ${name}`);
        try {
            await testFn();
            console.log(`%c PASS `, 'background: #00b894; color: white');
        } catch (e) {
            console.error(`%c FAIL `, 'background: #d63031; color: white', e);
        }
        console.groupEnd();
    }

    assert(condition: boolean, message: string) {
        if (!condition) {
            throw new Error(`Assertion Failed: ${message}`);
        }
    }

    async runRefactoringTests() {
        console.log("Starting Refactoring Verification Tests...");

        await this.runTest("RuleValidator: canPlayUnit checks", () => {
            this.game.state.phase = Phase.MAIN;
            this.setLeaderLevel(0, 1);
            this.setHand(0, ["ST02-005"]); // Yan (ST02-005)
            const val1 = RuleValidator.canPlayUnit(this.game, this.getPlayer(0), 0, 0);
            this.assert(val1.valid === false, "Yan should be too expensive (cost 3) for level 1 (size 1)");
            this.assert(val1.reason === "Cost exceeds Size limit", "Reason should be Size limit");

            this.game.state.players[0].leaderLevel = 3;
            const val2 = RuleValidator.canPlayUnit(this.game, this.getPlayer(0), 0, 0);
            this.assert(val2.valid === true, "Yan should be playable at level 3 (size 3)");
        });

        await this.runTest("Action Registry: ENTRY DRAW effect", () => {
            this.game.state.players[0].leaderLevel = 5;
            this.setHand(0, ["ST02-014"]); // Prize (ST02-014)
            const initialHandSize = this.getPlayer(0).hand.length;
            const initialDeckSize = this.getPlayer(0).deck.length;

            this.game.playSkill(0);

            this.assert(this.getPlayer(0).hand.length === initialHandSize, "Hand size should remain same after play + draw");
            this.assert(this.getPlayer(0).deck.length === initialDeckSize - 1, "Deck should have decreased by 1");
        });

        await this.runTest("Target Selector: BUFF_POWER random", () => {
            this.setField(0, ["ST02-003", "ST02-004", null]); // Mika, Yulia
            const buffSkill: Card = {
                id: "test_skill",
                name: "Test Skill",
                type: CardType.SKILL,
                attribute: 'NONE' as any,
                cost: 0,
                text: "Buff random unit",
                effects: [{
                    activation: ActivationCondition.ENTRY,
                    description: "Buff random friendly unit",
                    action: {
                        type: 'BUFF_POWER',
                        params: { value: 100 }
                    },
                    targets: {
                        scope: 'MY_FIELD',
                        type: 'UNIT',
                        selectMode: 'RANDOM',
                        count: 1
                    }
                }]
            };

            const zone0 = this.getPlayer(0).unitZones[0];
            const zone1 = this.getPlayer(0).unitZones[1];
            const p0Initial = this.game.getUnitPower(zone0, this.getPlayer(0));
            const p1Initial = this.game.getUnitPower(zone1, this.getPlayer(0));

            this.game.effectManager.processEffects(ActivationCondition.ENTRY, {
                sourceCard: buffSkill,
                player: this.getPlayer(0),
                opponent: this.getPlayer(1),
                machine: this.game
            });

            const p0Final = this.game.getUnitPower(zone0, this.getPlayer(0));
            const p1Final = this.game.getUnitPower(zone1, this.getPlayer(0));

            const buffed = (p0Final > p0Initial) || (p1Final > p1Initial);
            this.assert(buffed, "One of the units should have been buffed");
            this.assert(!(p0Final > p0Initial && p1Final > p1Initial), "Only one unit should have been buffed");
        });

        console.log("Refactoring Verification Completed.");
    }

    async runImmediateAwakeningTest() {
        console.log("Starting Immediate Awakening Test...");
        await this.runTest("Immediate Awakening via GAIN_LEVEL", () => {
            const player = this.getPlayer(0);
            this.setLeaderLevel(0, 5);
            player.levelZone!.isAwakened = false;

            // Trigger Gain Level (Yan ST02-005 has Entry: Level+1)
            const yan = this.getCard("ST02-005")!;
            this.game.effectManager.processEffects(ActivationCondition.ENTRY, {
                sourceCard: yan,
                player: player,
                opponent: this.getPlayer(1),
                machine: this.game
            });

            this.assert(player.leaderLevel === 6, "Leader level should be 6");
            this.assert(!!player.levelZone!.isAwakened, "Leader should have awakened immediately");
        });
    }

    async runTriggerTests() {
        console.log("Starting Trigger Verification Tests...");

        await this.runTest("Trigger: Damage Cancellation", () => {
            const player = this.getPlayer(1);
            player.damage = [];
            player.trash = [];
            const breed = this.getCard("ST02-007"); // Breed (ST02-007)
            if (breed) player.deck.push(breed);

            const initialDamage = player.damage.length;
            const initialLevel = player.leaderLevel;

            // Deal 3 damage. 1st card is Breed -> Trigger -> Damage stops.
            this.game.dealDamage(player, 3);

            // Breed is in Trash because of TRASH_SELF in its trigger effect
            this.assert(player.trash.some(c => c.id.startsWith("ST02-007")), "Breed should be in trash due to TRASH_SELF");
            this.assert(player.damage.length === initialDamage, "Damage zone count should be same as initial because Breed moved to trash");
            this.assert(player.leaderLevel === initialLevel + 1, "Breed trigger should have increased level");
        });

        await this.runTest("Trigger: Snow White Return to Hand", () => {
            const player = this.getPlayer(1);
            player.damage = [];
            player.hand = [];
            const snow = this.getCard("ST02-010"); // Snow White (ST02-010)
            if (snow) player.deck.push(snow);

            // Deal 1 damage
            this.game.dealDamage(player, 1);

            this.assert(player.hand.some(c => c.id.startsWith("ST02-010")), "Snow White should have moved to Hand");
            this.assert(player.damage.length === 0, "Damage zone should be empty as card moved to Hand");
        });

        await this.runTest("Trigger: Guilty Destroy Unit", () => {
            const p0 = this.getPlayer(0);
            const p1 = this.getPlayer(1);
            // Put a 2-cost unit on P0's field (the opponent of the trigger owner)
            this.setField(0, ["ST02-004", null, null]); // Yulia (ST02-004) is 2-cost
            p1.damage = [];
            p1.trash = [];
            const guilty = this.getCard("ST02-009"); // Guilty Unit (ST02-009)
            if (guilty) p1.deck.push(guilty);

            // Deal 1 damage to P1 -> Revealing Guilty -> Trigger starts selection mode
            this.game.dealDamage(p1, 1);

            // Verify we are in SELECT_TARGET mode
            this.assert(this.game.state.interactionMode === 'SELECT_TARGET', "Game should be in SELECT_TARGET mode");

            // Manually select P0's unit at index 0 (isOpponentZone = false for player 0 in our engine setup)
            this.game.selectTarget(0, false);

            this.assert(p0.unitZones[0].unit === null, "P0's unit should have been destroyed by Guilty trigger");
            this.assert(p1.trash.some(c => c.id.startsWith("ST02-009")), "Guilty should be in trash");
            this.assert(this.game.state.interactionMode === 'NORMAL', "Game should be back to NORMAL mode");
        });

        console.log("Trigger Verification Completed.");
    }

    async runAllTests() {
        console.log("Starting Automated Tests...");

        await this.runTest("Modify Leader Level", () => {
            this.setLeaderLevel(0, 5);
            this.assert(this.game.state.players[0].leaderLevel === 5, "Leader level should be 5");
        });

        await this.runTest("Add Card to Hand", () => {
            this.setHand(0, ["ST02-002"]);
            this.assert(this.game.state.players[0].hand.length === 1, "Hand size should be 1");
            this.assert(this.game.state.players[0].hand[0].id.startsWith("ST02-002"), "Card should be ST02-002");
        });

        await this.runTest("Place Unit on Field", () => {
            this.setField(0, ["ST02-003", null, null]);
            const zone0 = this.game.state.players[0].unitZones[0];
            this.assert(zone0.unit !== null && zone0.unit.id.startsWith("ST02-003"), "Zone 0 should have ST02-003");
        });

        console.log("All Tests Completed.");
    }
}
