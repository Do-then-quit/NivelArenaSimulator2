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

    setupBT01_001_Scenario() {
        console.log("Setting up BT01-001 (Red Hood Leader) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "BT01-001");
        const unit = this.getCard("BT01-002"); // Attacker
        if (unit) p0.unitZones[0].unit = unit;
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 Leader Level 5, Red Hood assigned.");
        console.log("2. Neon (Attacker) on field.");
        console.log("3. Increase Level to 6 (window.debug.setLeaderLevel(0, 6)).");
        console.log("4. Confirm Leader AWAKENS and Neon power increases by 2000 (Passive).");
    }

    setupBT01_002_Scenario() {
        console.log("Setting up BT01-002 (Neon) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-002");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Neon (Attacker) in hand.");
        console.log("2. Play Neon and attack. Confirm power increases by 2000.");
    }

    setupBT01_003_Scenario() {
        console.log("Setting up BT01-003 (Crow) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-003");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Crow (Vanilla) in hand.");
    }

    setupBT01_004_Scenario() {
        console.log("Setting up BT01-004 (Noise) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const noise = this.getCard("BT01-004");
        const target = this.getCard("BT01-004");
        if (noise) p0.unitZones[0].unit = noise;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Noise (Penetration) vs Crow.");
        console.log("2. Attack Crow. Confirm Penetration damage [1] deals to opponent.");
    }

    setupBT01_005_Scenario() {
        console.log("Setting up BT01-005 (Rapi) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const rapi = this.getCard("BT01-005");
        if (rapi) p0.unitZones[0].unit = rapi;
        this.renderCallback();
        console.log("1. Rapi (Berserker) on field.");
        console.log("2. Verify if 'Skip Phase' is restricted or mandatory attack logic works.");
    }

    setupBT01_006_Scenario() {
        console.log("Setting up BT01-006 (Anis) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const anis = this.getCard("BT01-006");
        const target = this.getCard("BT01-003");
        if (anis) p0.unitZones[0].unit = anis;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Anis on field vs Crow.");
        console.log("2. Attack with Anis. Confirm power buff (+2000) and draw card on trash (Plunder).");
    }

    setupBT01_006_Trigger_Scenario() {
        console.log("Setting up BT01-006 (Anis) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = [];
        const anis = this.getCard("BT01-006");
        const target = this.getCard("BT01-010"); // High power unit to see reduction
        if (anis) p1.deck.push(anis);
        if (target) p0.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Anis on top of P1 deck. Enemy unit on field.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Anis trashed and enemy power reduced by 5000.");
    }

    setupBT01_007_Scenario() {
        console.log("Setting up BT01-007 (Clay) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-007");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Clay (Vanilla) in hand.");
    }

    setupBT01_008_Scenario() {
        console.log("Setting up BT01-008 (Volume) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const volume = this.getCard("BT01-008");
        const noise = this.getCard("BT01-004"); // Penetration
        if (volume) p0.unitZones[0].unit = volume;
        if (noise) p0.unitZones[1].unit = noise;
        this.renderCallback();
        console.log("1. Volume and Noise (Penetration) on field.");
        console.log("2. Confirm Noise power increases by 1500.");
    }

    setupBT01_009_Scenario() {
        console.log("Setting up BT01-009 (Bay) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-009");
        if (card) p0.unitZones[0].unit = card;
        this.renderCallback();
        console.log("1. Bay (Attacker) on field.");
        console.log("2. Attack and confirm power increases by 1000.");
    }

    setupBT01_010_Scenario() {
        console.log("Setting up BT01-010 (Aria) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-010");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Aria (Vanilla) in hand.");
    }

    setupBT01_011_Scenario() {
        console.log("Setting up BT01-011 (Neon Blue) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const neon = this.getCard("BT01-011");
        const target = this.getCard("BT01-010");
        if (neon) p0.unitZones[0].unit = neon;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Neon Blue Ocean on field. Enemy unit on field.");
        console.log("2. Click 'Active' on Neon, select enemy.");
        console.log("3. Confirm enemy power reduced by 1500.");
    }

    setupBT01_012_Scenario() {
        console.log("Setting up BT01-012 (Emma) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const emma = this.getCard("BT01-012");
        const crow = this.getCard("BT01-003");
        if (emma) p0.hand = [emma];
        if (crow) p0.unitZones[0].unit = crow;
        this.renderCallback();
        console.log("1. Emma in hand, Crow on field.");
        console.log("2. Play Emma.");
        console.log("3. Confirm Crow (and Emma) gain 'Attacker: +1000 power'.");
    }

    setupBT01_013_Scenario() {
        console.log("Setting up BT01-013 (Jackal) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-013");
        if (card) p0.unitZones[0].unit = card;
        this.renderCallback();
        console.log("1. Jackal on field.");
        console.log("2. Attack and confirm power increases by 1000.");
    }

    setupBT01_014_Scenario() {
        console.log("Setting up BT01-014 (Scarlet) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const scarlet = this.getCard("BT01-014");
        if (scarlet) p0.unitZones[0].unit = scarlet;
        this.renderCallback();
        console.log("1. Scarlet (Berserker) on field.");
    }

    setupBT01_014_Trigger_Scenario() {
        console.log("Setting up BT01-014 (Scarlet) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        p1.trash = [];
        const scarlet = this.getCard("BT01-014");
        const fodder = this.getCard("BT01-003"); // Cost 1
        if (scarlet) p1.deck.push(scarlet);
        if (fodder) p1.trash.push(fodder);
        this.renderCallback();
        console.log("1. Scarlet on top of P1 deck. 1-cost unit in P1 trash.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Scarlet trashed and fodder returns to hand.");
    }

    setupBT01_015_Scenario() {
        console.log("Setting up BT01-015 (Noir) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const noir = this.getCard("BT01-015");
        const enemy = this.getCard("BT01-010");
        if (noir) p0.hand = [noir];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Noir in hand. Enemy unit in Lane 0.");
        console.log("2. Play Noir in Lane 0 (Encounter).");
        console.log("3. Confirm enemy power reduced by 4000.");
    }

    setupBT01_016_Scenario() {
        console.log("Setting up BT01-016 (Snow White) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-016");
        if (card) p0.unitZones[0].unit = card;
        this.renderCallback();
        console.log("1. Snow White on field.");
        console.log("2. Attack and confirm power increases by 2000.");
    }

    setupBT01_017_Scenario() {
        console.log("Setting up BT01-017 (Viper) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const viper = this.getCard("BT01-017");
        const enemy = this.getCard("BT01-010");
        if (viper) p0.hand = [viper];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Viper in hand. Enemy unit in Lane 0.");
        console.log("2. Play Viper in Lane 0 (Encounter).");
        console.log("3. Confirm enemy power becomes 1000.");
    }

    setupBT01_018_Scenario() {
        console.log("Setting up BT01-018 (Blanc) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const blanc = this.getCard("BT01-018");
        const neon = this.getCard("BT01-002"); // Attacker
        if (blanc) p0.unitZones[0].unit = blanc;
        if (neon) p0.unitZones[1].unit = neon;
        this.renderCallback();
        console.log("1. Blanc and Neon (Attacker) on field.");
        console.log("2. Confirm Neon power increases by 2000, but Blanc does NOT (Blanc is Passive, not Attacker).");
    }

    setupBT01_019_Scenario() {
        console.log("Setting up BT01-019 (Red Hood Unit) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = [];
        this.setLeader(0, "BT01-001");
        p0.levelZone!.isAwakened = true; // Force Awakened for passive check
        const redhood = this.getCard("BT01-019");
        const neon = this.getCard("BT01-003");
        if (redhood) p0.hand.push(redhood);
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("1. Awakened Red Hood Leader (BT01-001) on field.");
        console.log("2. Neon (Attacker) on field (Power 3000 + 2000 from Leader = 5000).");
        console.log("3. Play Red Hood Unit.");
        console.log("4. Confirm Neon and Red Hood gain Attacker/Penetration.");
        console.log("5. Confirm Red Hood (which just gained Attacker) also receives +2000 Power from Leader.");
    }

    setupBT01_019_Trigger_Scenario() {
        console.log("Setting up BT01-019 (Red Hood Unit) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        p1.hand = [];
        const redhood = this.getCard("BT01-019");
        if (redhood) p1.deck.push(redhood);
        this.renderCallback();
        console.log("1. Red Hood unit on top of P1 deck.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Red Hood added to hand.");
    }

    setupBT01_020_Scenario() {
        console.log("Setting up BT01-020 (Wild Tooth) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-020");
        const neon = this.getCard("BT01-003"); // Attacker
        if (skill) p0.hand = [skill];
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("1. Wild Tooth in hand, Neon (Attacker) on field.");
        console.log("2. Play Wild Tooth on Neon.");
        console.log("3. Confirm Neon gains 'Attacker: Penetration[1]'.");
    }

    setupBT01_021_Scenario() {
        console.log("Setting up BT01-021 (Formation F.F) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-021");
        const enemy = this.getCard("BT01-010");
        if (skill) p0.hand = [skill];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Formation F.F in hand, enemy unit on field.");
        console.log("2. Play Formation F.F.");
        console.log("3. Confirm all enemy unit power reduced by 1000.");
    }

    setupBT01_022_Scenario() {
        console.log("Setting up BT01-022 (Overwhelm) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-022");
        const e1 = this.getCard("BT01-010");
        const e2 = this.getCard("BT01-010");
        if (skill) p0.hand = [skill];
        if (e1) p1.unitZones[0].unit = e1;
        if (e2) p1.unitZones[1].unit = e2;
        this.renderCallback();
        console.log("1. Overwhelm in hand, 2 enemy units on field.");
        console.log("2. Play Overwhelm, select 2 enemies.");
        console.log("3. Confirm enemies power reduced by 2000.");
    }

    setupBT01_023_Scenario() {
        console.log("Setting up BT01-023 (Cheer Up Together) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-023");
        const n1 = this.getCard("BT01-002"); // Attacker
        const n2 = this.getCard("BT01-002"); // Attacker
        if (skill) p0.hand = [skill];
        if (n1) p0.unitZones[0].unit = n1;
        if (n2) p0.unitZones[1].unit = n2;
        this.renderCallback();
        console.log("1. Skill in hand, 2 Attackers on field.");
        console.log("2. Play skill.");
        console.log("3. Confirm all Attackers power increased by 2500.");
    }

    setupBT01_024_Scenario() {
        console.log("Setting up BT01-024 (Finale) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-024");
        const enemy = this.getCard("BT01-003"); // 3000 power
        if (skill) p0.hand = [skill];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Finale in hand, enemy (3000 power) on field.");
        console.log("2. Play Finale on enemy.");
        console.log("3. Confirm enemy trashed (due to 0 power) and CARD DRAWN.");
    }

    setupBT01_025_Scenario() {
        console.log("Setting up BT01-025 (Reinforcement) Scenario...");
        const p0 = this.game.state.players[0];
        p0.trash = [];
        p0.hand = [];
        const skill = this.getCard("BT01-025");
        const attacker = this.getCard("BT01-002");
        if (skill) p0.hand.push(skill);
        if (attacker) p0.trash.push(attacker);
        this.renderCallback();
        console.log("1. Skill in hand, Attacker in trash.");
        console.log("2. Play skill, select Attacker.");
        console.log("3. Confirm Attacker returns to hand.");
    }

    setupBT01_026_Trigger_Scenario() {
        console.log("Setting up BT01-026 (Glove) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        const item = this.getCard("BT01-026");
        if (item) p1.deck.push(item);
        this.renderCallback();
        console.log("1. Glove on top of P1 deck.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Glove added to hand.");
    }

    setupBT01_026_Scenario() {
        console.log("Setting up BT01-026 (Goddessium Glove) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const unit = this.getCard("ST02-002"); // N102
        const item = this.getCard("BT01-026");
        const enemy = this.getCard("BT01-002"); // 2000 Power

        if (unit) p0.unitZones[0].unit = unit;
        if (item) p0.hand = [item];
        if (enemy) p1.unitZones[0].unit = enemy;

        this.renderCallback();
        console.log("1. N102 on field, Goddessium Glove in hand, enemy on field.");
        console.log("2. Equip Glove to N102.");
        console.log("3. Attack enemy with N102.");
        console.log("4. Confirm opponent takes 1 Penetration damage when enemy is trashed.");
    }

    setupBT01_027_Scenario() {
        console.log("Setting up BT01-027 (Norn Goggle) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        const item = this.getCard("BT01-027");
        const unit = this.getCard("BT01-003");
        if (item) p0.hand = [item];
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("1. Goggle in hand, Crow on field.");
        console.log("2. Equip Goggle to Crow.");
        console.log("3. Attack and confirm 'Attacker: +2000 power & Plunder[1]'.");
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

    setupST03_001_Scenario() {
        console.log("Setting up ST03-001 (Modernia Leader) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST03-001");

        // Setup a unit with Exit keyword to test passive
        const exitUnit = this.getCard("ST03-003"); // Privaty (Exit)
        if (exitUnit) p0.unitZones[0].unit = exitUnit;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 Leader Level 3.");
        console.log("2. Privaty (Exit unit) on field. Power should be base (500).");
        console.log("3. Increase Leader Level to 4 (window.debug.setLeaderLevel(0, 4)).");
        console.log("4. Confirm Leader Awaken and Privaty Power becomes 1500.");
    }

    setupST03_002_Scenario() {
        console.log("Setting up ST03-002 (Delta) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST03-001");
        const card = this.getCard("ST03-002");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Delta (Vanilla Unit) in hand.");
        console.log("2. Drag Delta to a Unit Zone.");
    }

    setupST03_003_Scenario() {
        console.log("Setting up ST03-003 (Privaty) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.hand = []; // Reset Opp hand
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST03-001");

        const privaty = this.getCard("ST03-003");
        if (privaty) p0.unitZones[0].unit = privaty;

        // Give opponent some cards to discard
        const oppCard = this.getCard("ST03-002");
        if (oppCard) p1.hand.push(oppCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Privaty on field. Opponent has 1 card in hand.");
        console.log("2. Trash Privaty (overwrite or battle).");
        console.log("3. Confirm Opponent is prompted to discard a card.");
    }

    setupST03_003_Trigger_Scenario() {
        console.log("Setting up ST03-003 (Privaty) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = [];
        p0.hand = [];

        // P0 (Opponent from Trigger perspective) needs 3 cards in hand
        const c1 = this.getCard("ST03-002");
        const c2 = this.getCard("ST03-002");
        const c3 = this.getCard("ST03-002");
        if (c1) p0.hand.push(c1);
        if (c2) p0.hand.push(c2);
        if (c3) p0.hand.push(c3);

        const triggerCard = this.getCard("ST03-003");
        if (triggerCard) p1.deck.push(triggerCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 0 (Opponent) has 3 cards in hand.");
        console.log("2. Player 1 has Privaty on top of deck.");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("4. Confirm Trigger activates (Privaty trashed) AND Player 0 must discard 1.");
    }

    setupST03_004_Scenario() {
        console.log("Setting up ST03-004 (Uni) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");
        const card = this.getCard("ST03-004");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Uni (Vanilla Unit) in hand.");
        console.log("2. Drag Uni to a Unit Zone.");
    }

    setupST03_005_Scenario() {
        console.log("Setting up ST03-005 (Novel) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const novel = this.getCard("ST03-005");
        if (novel) p0.hand.push(novel);

        const target = this.getCard("ST03-002"); // Delta (Cost 1)
        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Novel in hand. Opponent has Delta (Cost 1) in Lane 0.");
        console.log("2. Play Novel to Lane 0.");
        console.log("3. Confirm Delta is Destroyed.");
    }

    setupST03_006_Scenario() {
        console.log("Setting up ST03-006 (Sakura) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const sakura = this.getCard("ST03-006");
        if (sakura) p0.unitZones[0].unit = sakura;

        // Ensure deck has cards
        if (p0.deck.length === 0) p0.deck.push(this.getCard("ST03-002")!);

        const initialHandInfo = p0.hand.length;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log(`1. Sakura on field. Hand size ${initialHandInfo}.`);
        console.log("2. Trash Sakura (overwrite or battle).");
        console.log("3. Confirm you Draw 1 card.");
    }

    setupST03_007_Scenario() {
        console.log("Setting up ST03-007 (D) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST03-001");
        this.setLeader(1, "ST03-001"); // Opponent leader

        const d = this.getCard("ST03-007"); // Cost 3, Power 4000
        if (d) p0.unitZones[0].unit = d;

        // Opponent unit that can kill D but has <= Cost 3
        const killer = this.getCard("ST03-007"); // D itself is Cost 3, Power 4000. Mutual kill.
        if (killer) p1.unitZones[0].unit = killer;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. D (Cost 3, 4000) on field Lane 0.");
        console.log("2. Opponent has D (Cost 3, 4000) in Lane 0.");
        console.log("3. Advance to Attack phase and Attack Opponent with D.");
        console.log("4. Both die. Confirm Opponent's unit is ALSO trashed by D's Exit effect (Cost 3 <= 3).");
    }

    setupST03_008_Scenario() {
        console.log("Setting up ST03-008 (Exia) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST03-001");

        const exia = this.getCard("ST03-008");
        const exitUnit = this.getCard("ST03-003"); // Privaty (Exit)

        if (exia) p0.hand.push(exia);
        if (exitUnit) p0.unitZones[0].unit = exitUnit;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Exia in hand. Privaty (Exit unit) on field (Power 500).");
        console.log("2. Play Exia.");
        console.log("3. Confirm Privaty Power increases to 1500.");
    }

    setupST03_009_Scenario() {
        console.log("Setting up ST03-009 (Maiden) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "ST03-001");
        const card = this.getCard("ST03-009");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Maiden (Vanilla Unit) in hand.");
        console.log("2. Drag Maiden to a Unit Zone.");
    }

    setupST03_010_Scenario() {
        console.log("Setting up ST03-010 (Rosanna) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.trash = []; p0.leaderLevel = 6; p1.leaderLevel = 10;
        this.setLeader(0, "ST03-001");

        const rosanna = this.getCard("ST03-010");
        if (rosanna) p0.unitZones[0].unit = rosanna;

        // Trash setup
        const validTarget = this.getCard("ST03-003"); // Privaty (Exit, Cost 1) -> Valid
        const invalidNoExit = this.getCard("ST03-002"); // Delta (No Exit, Cost 1) -> Invalid
        const invalidCost = this.getCard("ST03-007"); // D (Exit, Cost 3) -> Invalid (Cost > 2)

        const enemyUnit = this.getCard("ST02-009"); // 길티 (Big Unit)
        if (enemyUnit) p1.unitZones[0].unit = enemyUnit;

        if (validTarget) p0.trash.push(validTarget);
        if (invalidNoExit) p0.trash.push(invalidNoExit);
        if (invalidCost) p0.trash.push(invalidCost);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Rosanna on field.");
        console.log("2. Trash contains: Privaty (Valid), Delta (No Exit), D (Cost 3).");
        console.log("3. Trash Rosanna.");
        console.log("4. Confirm you can ONLY select Privaty to return to hand.");
    }

    setupST03_010_Trigger_Scenario() {
        console.log("Setting up ST03-010 (Rosanna) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = [];
        p0.hand = [];

        // P0 (Opponent from Trigger perspective) needs 3 cards in hand
        const c1 = this.getCard("ST03-002");
        const c2 = this.getCard("ST03-002");
        const c3 = this.getCard("ST03-002");
        if (c1) p0.hand.push(c1);
        if (c2) p0.hand.push(c2);
        if (c3) p0.hand.push(c3);

        const triggerCard = this.getCard("ST03-010");
        if (triggerCard) p1.deck.push(triggerCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 0 (Opponent) has 3 cards in hand.");
        console.log("2. Player 1 has Rosanna on top of deck.");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("4. Confirm Trigger activates (Rosanna trashed) AND Player 0 must discard 1.");
    }

    setupST03_011_Scenario() {
        console.log("Setting up ST03-011 (Modernia Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 7;
        this.setLeader(0, "ST03-001");

        const modernia = this.getCard("ST03-011");
        if (modernia) p0.hand.push(modernia);

        // Add 2 dummy cards to hand for activation cost
        p0.hand.push(this.getCard("ST03-002")!);
        p0.hand.push(this.getCard("ST03-002")!);

        // Opponent unit
        const target = this.getCard("ST03-011"); // Modernia (Cost 7)
        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Modernia in hand + 2 dummy cards.");
        console.log("2. Opponent has Modernia in Lane 0.");
        console.log("3. Play Modernia to Lane 0.");
        console.log("4. Confirm you discard remaining hand (2 cards) AND Opponent unit is Trashed.");
    }

    setupST03_011_Trigger_Scenario() {
        console.log("Setting up ST03-011 (Modernia Unit) Trigger Scenario...");
        const p1 = this.game.state.players[1]; // We setup for P1 to be triggered
        p1.deck = [];
        p1.hand = [];

        const triggerCard = this.getCard("ST03-011");
        if (triggerCard) p1.deck.push(triggerCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 1 has Modernia on top of deck.");
        console.log("2. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("3. Confirm Trigger activates: Modernia is added to Hand (not Trashed).");
    }

    setupST03_012_Scenario() {
        console.log("Setting up ST03-012 (Surprise Attack) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.hand = []; p1.hand = [];
        p0.leaderLevel = 1;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-012");
        if (skill) p0.hand.push(skill);
        p0.hand.push(this.getCard("ST03-002")!); // Fodder to discard

        p1.hand.push(this.getCard("ST03-002")!); // Opponent fodder

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Surprise Attack' in hand + 1 fodder.");
        console.log("2. Opponent has 1 card in hand.");
        console.log("3. Play 'Surprise Attack'.");
        console.log("4. Confirm YOU discard 1, then OPPONENT discards 1.");
    }

    setupST03_013_Scenario() {
        console.log("Setting up ST03-013 (Darkening) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-013");
        if (skill) p0.hand.push(skill);
        if (skill) p0.hand.push(skill);

        const handCostUnit = this.getCard("ST03-008"); // Exia (Cost 4) in hand

        if (handCostUnit) p0.hand.push(handCostUnit);

        const targetLow = this.getCard("ST03-007"); // D (Cost 3) < 4 -> Valid
        const targetHigh = this.getCard("ST03-009"); // Maiden (Cost 5) > 4 -> Invalid
        if (targetLow) p1.unitZones[0].unit = targetLow;
        if (targetHigh) p1.unitZones[1].unit = targetHigh;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Darkening' in hand. Exia (Cost 4) in hand.");
        console.log("2. Opponent has D (Cost 3) and Maiden (Cost 5).");
        console.log("3. Play 'Darkening'. Verify you MUST discard Exia (only unit).");
        console.log("4. Confirm you can ONLY destroy D (Cost 3 < 4). Maiden should be unselectable.");
    }

    setupST03_014_Scenario() {
        console.log("Setting up ST03-014 (Sense Sharing) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 8;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-014");
        if (skill) p0.hand.push(skill);

        const fodder = this.getCard("ST03-006");
        if (fodder) p0.unitZones[0].unit = fodder;

        // Ensure deck has cards
        p0.deck.push(this.getCard("ST03-002")!);
        p0.deck.push(this.getCard("ST03-002")!);
        p0.deck.push(this.getCard("ST03-002")!);
        p0.deck.push(this.getCard("ST03-002")!);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Sense Sharing' in hand. Unit on field.");
        console.log("2. Play 'Sense Sharing', select unit to trash.");
        console.log("3. Confirm unit is Trashed and you Draw 2 cards.");
    }

    setupST03_015_Scenario() {
        console.log("Setting up ST03-015 (Bring it on!) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-015");
        if (skill) p0.hand.push(skill);

        const myUnit = this.getCard("ST03-002");
        const oppUnit = this.getCard("ST03-011"); // Modernia (Big Unit)
        if (myUnit) p0.unitZones[0].unit = myUnit;
        if (oppUnit) p1.unitZones[0].unit = oppUnit;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Bring it on!' in hand. My Unit vs Opponent Modernia.");
        console.log("2. Play Skill, select My Unit in Lane 0.");
        console.log("3. Confirm BOTH My Unit and Opponent Modernia are Trashed.");
    }

    setupST03_015_Trigger_Scenario() {
        console.log("Setting up ST03-015 (Bring it on!) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        p1.trash = [];

        const triggerCard = this.getCard("ST03-015");
        if (triggerCard) p1.deck.push(triggerCard);

        const exitUnit = this.getCard("ST03-003"); // Privaty (Exit) - Valid
        const noExitUnit = this.getCard("ST03-002"); // Delta - Invalid
        if (exitUnit) p1.trash.push(exitUnit);
        if (noExitUnit) p1.trash.push(noExitUnit);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 1 has 'Bring it on!' on top of deck.");
        console.log("2. Player 1 Trash has Privaty (Exit) and Delta (No Exit).");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("4. Confirm Trigger activates (Skill trashed) AND you can ONLY select Privaty to return to hand.");
    }

    setupST03_016_Scenario() {
        console.log("Setting up ST03-016 (Kevlar Vest) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const vest = this.getCard("ST03-016");
        const unit = this.getCard("ST03-002"); // Delta 2500
        if (vest) p0.hand.push(vest);
        if (unit) p0.unitZones[0].unit = unit;

        // Opponent attacker
        const attacker = this.getCard("ST02-010"); // rafi 
        if (attacker) p1.unitZones[0].unit = attacker;


        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. My Delta (2500) vs Opponent Modernia (6500).");
        console.log("2. Kevlar Vest in My Hand. It is Opponent's Turn (P1 Main Phase).");
        console.log("3. Use Console to Equip Vest to Delta: Set P0 Hand empty and Vest in Item zone manually or just note this test is tricky.");
        console.log("   Actually, safer to setup: P0 Turn, Equip Vest, Pass Turn, Opp Attack.");
        console.log("   --> ACTION: Equip Vest to Delta. End Turn. Opponent Attack with Modernia.");
        console.log("4. Block with Delta. Confirm Attack Terminates immediately and Delta is Trashed.");
    }

    setupST03_017_Scenario() {
        console.log("Setting up ST03-017 (Rare Metal Armguard) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const guard = this.getCard("ST03-017");
        const unit = this.getCard("ST03-002"); // Delta (Cost 1)
        if (guard) p0.hand.push(guard);
        if (unit) p0.unitZones[0].unit = unit;

        const killer = this.getCard("ST03-003"); // Privaty (Cost 1) -> Valid target for Mutual Destruction
        if (killer) p1.unitZones[0].unit = killer;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Delta (Cost 1) on field. Armguard in hand.");
        console.log("2. Opponent has Privaty (Cost 1).");
        console.log("3. Equip Armguard to Delta. Go to Attack Phase. Attack Privaty.");
        console.log("4. Both Die (2500 vs 500?? Wait Privaty is 500, Delta is 2500. Delta wins).");
        console.log("   Ah, need Delta to lose to trigger Exit.");
        console.log("   Let's swap: My unit Cost 1 (Privaty 500) vs Opp Cost 1 (Delta 2500).");

        // Correct setup for mutual destruction (My unit must die)
        const weakUnit = this.getCard("ST03-003"); // Privaty (500)
        const strongUnit = this.getCard("ST03-002"); // Delta (2500)
        if (weakUnit) p0.unitZones[0].unit = weakUnit;
        if (strongUnit) p1.unitZones[0].unit = strongUnit;

        console.log("   CORRECTION: My Privaty (500) vs Opp Delta (2500).");
        console.log("   Equip Armguard to Privaty. Attack Delta.");
        console.log("   Privaty dies. Check if Delta is ALSO trashed (Cost 1 <= 1).");
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

    setupST03_Battle_Scenario() {
        console.log("Setting up ST03-003 (Privaty) Battle Exit Scenario...");

        // 1. Reset Game
        const p1 = this.game.currentPlayer; // Player 1
        // const p2 = this.game.opponentPlayer; // Player 2 (Opponent)

        // 2. Setup Hands
        // P1 has nothing relevant
        p1.hand = [];
        // P2 has cards to discard (at least 2 to have a choice)
        this.setHand(1, ['ST01-013', 'ST01-014']);

        // 3. Setup Field
        // P1: Privaty (Power 3000) in Center (Index 1)
        this.setField(0, [null, 'ST03-003', null]);
        // P2: Something strong in Center (Index 1). ST02-001 is a Leader, so use ST02-003 (Unit)
        this.setField(1, [null, 'ST02-003', null]);

        // 4. Force Phase to Attack Phase
        // Player 1 turn, Attack Phase
        this.game.state.turnCount = 1;
        this.game.state.turnPlayerIndex = 0;
        this.forcePhase(Phase.ATTACK);

        console.log("Scenario Ready:");
        console.log("1. Privaty (P1 Center) has 3000 Power.");
        console.log("2. Eunhwa (P2 Center) has 5000 Power.");
        console.log("3. Instructions: Click Privaty -> Attack -> Click Eunhwa (Target Unit).");
        console.log("4. Result: Privaty destroyed by battle. Exit effect triggers.");
        console.log("5. Verify: Opponent MUST select a card from their hand to trash.");
        this.renderCallback();
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

    setupBT01_Fire_Scenarios() {
        console.log("Setting up BT01 Fire Cards Verification Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        [p0, p1].forEach(p => {
            p.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; z.temporaryEffects = []; });
            p.trash = []; p.hand = []; p.damage = [];
        });

        // 1. Red Hood Leader (BT01-001)
        this.setLeader(0, "BT01-001");
        this.setLeaderLevel(0, 6); // Awakened

        // 2. Berserker Rapi (BT01-005)
        const rapi = this.getCard("BT01-005");
        if (rapi) p0.unitZones[0].unit = rapi;

        // 3. Neon (BT01-002) for Attacker test
        const neon = this.getCard("BT01-002");
        if (neon) p0.unitZones[1].unit = neon;

        // 4. Emma (BT01-012) and Viper (BT01-017) in hand
        const emma = this.getCard("BT01-012");
        const viper = this.getCard("BT01-017");
        if (emma) p0.hand.push(emma);
        if (viper) p0.hand.push(viper);

        // 5. Opponent Target for Viper
        const target = this.getCard("BT01-003"); // Crow (3000)
        if (target) p1.unitZones[2].unit = target;

        this.renderCallback();
        console.group("BT01 Fire Scenario Ready");
        console.log("1. P0 has Red Hood Awakened. Rapi (Berserker) in Lane 0, Neon in Lane 1.");
        console.log("2. Units power should be buffed by Red Hood (+2000).");
        console.log("3. Play Emma to grant 'Attacker: Power+1000' to all units.");
        console.log("4. Play Viper in Lane 2 to set opponent Crow power to 1000.");
        console.log("5. Go to ATTACK phase. Try to skip - confirm you MUST attack with Rapi.");
        console.groupEnd();
    }

    setupBT01_Recursion_Scenario() {
        console.log("Setting up BT01 Recursion (Scarlet BT01-014) Scenario...");
        const p0 = this.game.state.players[0];
        p0.trash = []; p0.deck = []; p0.damage = [];

        // 1. Put a 2-cost unit in trash
        const neon = this.getCard("BT01-002");
        if (neon) p0.trash.push(neon);

        // 2. Put Scarlet on top of deck
        const scarlet = this.getCard("BT01-014");
        if (scarlet) p0.deck.push(scarlet);

        this.renderCallback();
        console.log("Scenario Ready. Run window.debug.dealDamage(0, 1) to trigger Scarlet.");
        console.log("Confirm you can pick Neon from trash to hand.");
    }

    setupBT01_Earth_Passive_Scenario() {
        console.log("Setting up BT01 Earth Passive Scenario...");
        const p0 = this.game.state.players[0];
        this.setLeader(0, "BT01-028"); // Scarlet Leader
        this.setLeaderLevel(0, 5); // Awakened
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const brid = this.getCard("BT01-045"); // Brid (Passive: 1-cost +2000)
        const quency = this.getCard("BT01-036"); // Quency (Passive: Base +2000)
        const neon = this.getCard("BT01-031"); // Anne (1-cost, Base)

        if (brid) p0.unitZones[0].unit = brid;
        if (quency) p0.unitZones[1].unit = quency;
        if (neon) p0.unitZones[2].unit = neon;

        this.renderCallback();
        console.group("Earth Passive Verification");
        console.log("1. Scarlet Leader (Awakened) gives all Base units +1000.");
        console.log("2. Quency gives all Base units +2000.");
        console.log("3. Brid gives all 1-cost units +2000.");
        console.log("4. Result for Neon (Base, 1-cost): 2000(base) + 1000(Leader) + 2000(Quency) + 2000(Brid) = 7000 Power.");
        console.log("   Check neon power.");
        console.groupEnd();
    }

    setupBT01_Earth_Frontline_Scenario() {
        console.log("Setting up BT01 Earth Frontline Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const mica = this.getCard("BT01-030"); // Mica (Frontline: +3000)
        const diesel = this.getCard("BT01-037"); // Diesel (Frontline: Hit+1)
        if (mica) p0.unitZones[0].unit = mica;
        if (diesel) p0.unitZones[1].unit = diesel;

        this.renderCallback();
        console.log("1. Lane 2 is empty. Mica and Diesel should NOT have frontline buffs.");
        console.log("2. Running: window.debug.placeUnit(0, 2, 'BT01-031')");
        this.renderCallback(); // Wait for interaction instruction
        console.log("3. Now all 3 lanes are full. Confirm Mica power +3000 and Diesel Hit +1.");
    }

    setupBT01_Earth_Dynamic_Scenario() {
        console.log("Setting up BT01 Earth Dynamic power Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        this.setLeaderLevel(0, 6);

        const sin = this.getCard("BT01-032"); // Sin (+500 per Base unit)
        const ruppe = this.getCard("BT01-040"); // Rupee (+500 per Leader Level)
        const base1 = this.getCard("BT01-031"); // Anne (Base)

        if (sin) p0.unitZones[0].unit = sin;
        if (ruppe) p0.unitZones[1].unit = ruppe;
        if (base1) p0.unitZones[2].unit = base1;

        this.renderCallback();
        console.log("1. Leader Level 6. Rupee should have 4000(base) + 6*500 = 7000 Power.");
        console.log("2. 2 Base units on field (Anne and Rupee/Sin?). Sin has Base trait? Let me check.");
        console.log("   Sin (BT01-032) traits: '이펙트 / 미실리스'. NOT Base.");
        console.log("   Rupee (BT01-040) traits: '이펙트 / 테트라'. NOT Base.");
        console.log("   Anne (BT01-031) traits: '베이스 / 엘리시온'. YES Base.");
        console.log("3. Sin should have 4000(base) + 1*500(Anne) = 4500 Power.");
    }

    setupBT01_Earth_Search_Scenario() {
        console.log("Setting up BT01 Earth Search Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.deck = [];

        const rapunzel = this.getCard("BT01-044");
        const baseUnit = this.getCard("BT01-031");
        const nonBase = this.getCard("BT01-035");

        if (rapunzel) p0.hand.push(rapunzel);
        if (baseUnit) p0.deck.push(baseUnit);
        if (nonBase) { p0.deck.push(nonBase); p0.deck.push(nonBase); }

        this.renderCallback();
        console.log("1. Rapunzel in hand. Deck has 1 Base unit and 2 non-base.");
        console.log("2. Play Rapunzel. Confirm it picks the Base unit and shuffles others back.");
    }

    setupBT01_Earth_Duration_Scenario() {
        console.log("Setting up BT01 Earth Duration Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const belorta = this.getCard("BT01-029"); // +1000 till end of opp turn
        if (belorta) p0.hand = [belorta];

        this.renderCallback();
        console.log("1. Play Belorta. Note its power (3000 -> 4000).");
        console.log("2. Pass turn. (Now Opponent turn). Power should still be 4000.");
        console.log("3. Pass turn again. (Back to My turn). Power should return to 3000.");
    }

    setupBT01_Earth_Skill_Scenario() {
        console.log("Setting up BT01 Earth Skill Scenario (VIP Gift & Dessert Time)...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.deck = []; p0.unitZones.forEach(z => { z.unit = null; });

        const vipGift = this.getCard("BT01-051");
        const lowCost = this.getCard("BT01-031"); // 1-cost
        const highCost = this.getCard("BT01-040"); // 6-cost
        const baseUnit = this.getCard("BT01-031");

        if (vipGift) p0.hand.push(vipGift);
        if (lowCost) { p0.deck.push(lowCost); p0.deck.push(lowCost); }
        if (highCost) p0.deck.push(highCost);
        if (baseUnit) p0.unitZones[0].unit = baseUnit;

        const dessertTime = this.getCard("BT01-049");
        if (dessertTime) p0.hand.push(dessertTime);

        this.renderCallback();
        console.log("1. Play VIP Gift. Confirm it takes 2 low-cost cards, shuffles high-cost back.");
        console.log("2. Play Dessert Time. Confirm it draws 1 card (1 Base unit on field).");
    }

    setupBT01_035_Scenario() {
        console.log("Setting up BT01-035 (Soline) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const soline = this.getCard("BT01-035");
        const targetLow = this.getCard("BT01-031"); // 1-cost
        const targetHigh = this.getCard("BT01-040"); // 6-cost

        if (soline) p0.unitZones[0].unit = soline;
        if (targetLow) p1.unitZones[0].unit = targetLow;
        if (targetHigh) p1.unitZones[1].unit = targetHigh;

        this.renderCallback();
        console.log("1. Soline in Lane 0. Opponent has 1-cost in Lane 0, 6-cost in Lane 1.");
        console.log("2. Attack Lane 0: Confirm Breakthrough prevents blocking (Damage to Leader).");
        console.log("3. Attack Lane 1: Confirm blocking IS allowed.");
    }

    setupBT01_038_Scenario() {
        console.log("Setting up BT01-038 (Rupee) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = [];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const rupee = this.getCard("BT01-038");
        const fodder = this.getCard("BT01-031");
        const target = this.getCard("BT01-031");

        if (rupee) p0.unitZones[0].unit = rupee;
        if (fodder) p0.hand.push(fodder);
        if (target) p0.unitZones[1].unit = target;

        this.renderCallback();
        console.log("1. Rupee (Unit) on field. 1 fodder in hand. Another unit on field.");
        console.log("2. Activate Rupee Active effect. Confirm fodder trashed and target buffed +4000.");
    }

    setupBT01_041_Scenario() {
        console.log("Setting up BT01-041 (Admi) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = [];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const admi = this.getCard("BT01-041");
        const target = this.getCard("BT01-031");

        if (admi) p0.hand.push(admi);
        if (target) p0.unitZones[0].unit = target;

        this.renderCallback();
        console.log("1. Admi in hand, Unit on field.");
        console.log("2. Play Admi, select Unit.");
        console.log("3. Confirm Unit buffed +2000.");
    }

    setupBT01_044_Scenario() {
        console.log("Setting up BT01-044 (Rapunzel) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.deck = [];
        const rapunzel = this.getCard("BT01-044");
        const base = this.getCard("BT01-031");
        if (rapunzel) p0.hand.push(rapunzel);
        if (rapunzel && base) { p0.deck.push(base); p0.deck.push(rapunzel); p0.deck.push(base); }
        this.renderCallback();
        console.log("1. Rapunzel in hand. Deck has Base units.");
        console.log("2. Play Rapunzel. Confirm search works.");
    }

    setupBT01_044_Trigger_Scenario() {
        console.log("Setting up BT01-044 (Rapunzel) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        p0.leaderLevel = 1; p0.deck = [];
        const rapunzel = this.getCard("BT01-044");
        if (rapunzel) p0.deck.push(rapunzel);
        this.renderCallback();
        console.log("1. Rapunzel on top of P0 deck. Leader Level 1.");
        console.log("2. Run window.debug.dealDamage(0, 1).");
        console.log("3. Confirm Leader Level increases to 2 and Rapunzel is trashed.");
    }

    setupBT01_046_Scenario() {
        console.log("Setting up BT01-046 (Scarlet Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.hand = []; p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const scarlet = this.getCard("BT01-046");
        const base = this.getCard("BT01-031"); // Base
        const target3 = this.getCard("ST03-007"); // 3-cost enemy

        if (scarlet) p0.hand.push(scarlet);
        if (base) p0.unitZones[0].unit = base;
        if (target3) p1.unitZones[0].unit = target3;

        this.renderCallback();
        console.log("1. Scarlet in hand, Base unit in Lane 0, 3-cost enemy in Lane 0.");
        console.log("2. Play Scarlet, select Base unit.");
        console.log("3. Confirm Base unit gains Breakthrough [3-cost or less].");
        console.log("4. Attack Lane 0: Confirm damage goes to Leader.");
    }

    setupBT01_047_Scenario() {
        console.log("Setting up BT01-047 (Overfield) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });

        const skill = this.getCard("BT01-047");
        const anne = this.getCard("BT01-031"); // 1-cost, Base

        if (skill) p0.hand.push(skill);
        if (anne) p0.unitZones[0].unit = anne;

        this.renderCallback();
        console.log("1. Skill in hand, Anne (1-cost Base) on field.");
        console.log("2. Play skill, select Anne.");
        console.log("3. Confirm Anne Hit becomes 2.");
    }

    setupBT01_048_Scenario() {
        console.log("Setting up BT01-048 (Companions) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.unitZones.forEach(z => { z.unit = (z.unit ? z.unit : this.getCard("BT01-031") || null) });

        const skill = this.getCard("BT01-048");
        if (skill) p0.hand.push(skill);

        this.renderCallback();
        console.log("1. Skill in hand, some units on field.");
        console.log("2. Play skill. Confirm all units power +500.");
        console.log("3. Verify buff lasts until end of opponent's turn.");
    }

    setupBT01_049_Scenario() {
        console.log("Setting up BT01-049 (Dessert Time) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.unitZones.forEach(z => { z.unit = null; });
        const skill = this.getCard("BT01-049");
        const b1 = this.getCard("BT01-031");
        const b2 = this.getCard("BT01-031");
        if (skill) p0.hand.push(skill);
        if (b1) p0.unitZones[0].unit = b1;
        if (b2) p0.unitZones[1].unit = b2;
        this.renderCallback();
        console.log("1. Skill in hand, 2 Base units on field.");
        console.log("2. Play skill. Confirm you draw 2 cards.");
    }

    setupBT01_050_Scenario() {
        console.log("Setting up BT01-050 (Ice Festival) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = this.getCard("BT01-031") || null; });
        const skill = this.getCard("BT01-050");
        if (skill) p0.hand = [skill];
        this.renderCallback();
        console.log("1. Skill in hand, 3 units on field (Frontline active).");
        console.log("2. Play skill. Confirm all units power +1500.");
    }

    setupBT01_051_Scenario() {
        console.log("Setting up BT01-051 (VIP Gift) Scenario...");
        const p0 = this.game.state.players[0];
        p0.deck = []; p0.hand = [];
        const skill = this.getCard("BT01-051");
        const low = this.getCard("BT01-031"); // 1-cost
        const high = this.getCard("BT01-040"); // 6-cost
        if (skill) p0.hand.push(skill);
        if (low) { p0.deck.push(low); p0.deck.push(low); }
        if (high) p0.deck.push(high);
        this.renderCallback();
        console.log("1. Play VIP Gift. Takes low-cost cards, shuffles high back.");
    }

    setupBT01_051_Trigger_Scenario() {
        console.log("Setting up BT01-051 Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.deck = []; p1.unitZones[0].unit = this.getCard("BT01-031") || null; // 1-cost
        const skill = this.getCard("BT01-051");
        if (skill) p0.deck.push(skill);
        this.renderCallback();
        console.log("1. Skill on top of P0 deck. Opponent has 1-cost unit.");
        console.log("2. Run window.debug.dealDamage(0, 1).");
        console.log("3. Confirm opponent unit is trashed.");
    }

    setupBT01_052_Scenario() {
        console.log("Setting up BT01-052 (Prayer) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; });
        const skill = this.getCard("BT01-052");
        const base = this.getCard("BT01-031");
        if (skill) p0.hand = [skill];
        if (base) { p0.unitZones[0].unit = base; p0.unitZones[1].unit = base; }
        this.renderCallback();
        console.log("1. Skill in hand, 2 Base units on field.");
        console.log("2. Play skill. Confirm both Base units Hit+1.");
    }

    setupBT01_053_Scenario() {
        console.log("Setting up BT01-053 (Protector) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; });
        p1.unitZones.forEach(z => { z.unit = null; });

        const unit = this.getCard("BT01-031");
        const item = this.getCard("BT01-053");
        const low = this.getCard("BT01-031"); // 1-cost
        const high = this.getCard("ST03-011"); // 7-cost

        if (unit) p0.unitZones[0].unit = unit;
        if (item) p0.hand = [item];
        if (low) p1.unitZones[0].unit = low;
        if (high) p1.unitZones[1].unit = high;

        this.renderCallback();
        console.log("1. Unit on field, Protector in hand. Enemy has 1-cost and 7-cost.");
        console.log("2. Equip Protector. Attack Lane 0: Breakthrough (Damage to Leader).");
        console.log("3. Attack Lane 1: Block allowed.");
    }

    setupBT01_054_Scenario() {
        console.log("Setting up BT01-054 (Sword) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => { z.unit = null; z.items = []; });
        const unit = this.getCard("BT01-031");
        const item = this.getCard("BT01-054");
        if (unit) p0.unitZones[0].unit = unit;
        if (item) p0.hand = [item];
        this.renderCallback();
        console.log("1. Equip Sword. Confirm power +5000.");
    }

    setupBT01_055_Scenario() {
        console.log("Setting up BT01-055 (Cinderella Leader) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        this.setLeader(0, "BT01-055");
        p0.leaderLevel = 5;
        this.game.checkAwakening(0);

        const unit5 = this.getCard("BT01-069"); // 5-cost
        if (unit5) p0.unitZones[0].unit = unit5;
        if (unit5) p0.unitZones[1].unit = unit5;
        if (unit5) p0.unitZones[2].unit = unit5;

        if (unit5) p1.unitZones[0].unit = unit5;
        if (unit5) p1.unitZones[1].unit = unit5;
        if (unit5) p1.unitZones[2].unit = unit5;

        p0.hand = [];
        this.renderCallback();
        console.log("1. P0 is Level 5 Cinderella (Awakened).");
        console.log("2. Units (5-cost) are on both fields.");
        console.log("3. Trash P1's unit: Confirm P0 does NOT draw.");
        console.log("4. Trash P0's unit: Confirm P0 DOES draw (once per turn).");
    }

    setupBT01_058_Scenario() {
        console.log("Setting up BT01-058 (Maiden-Secret Nurse) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach(z => z.unit = null);
        p1.unitZones.forEach(z => z.unit = null);

        const attacker = this.getCard("BT01-002");
        const maiden = this.getCard("BT01-058");

        if (attacker) p1.unitZones[0].unit = attacker;
        if (maiden) p0.unitZones[0].unit = maiden;

        this.renderCallback();
        console.log("1. P1 attacks with Neon. P0 has Maiden (Defender: Terminate) in Lane 0.");
        console.log("2. Declare block with Maiden.");
        console.log("3. Confirm attack ends immediately and Maiden is trashed.");
    }

    setupBT01_060_Scenario() {
        console.log("Setting up BT01-060 (Admi) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach(z => z.unit = null);
        p0.hand = [];

        const admi = this.getCard("BT01-060");
        const fodder = this.getCard("BT01-002");

        if (admi) p0.unitZones[0].unit = admi;
        if (fodder) p0.hand = [fodder];

        this.renderCallback();
        console.log("1. Admi on field, 1 card in hand.");
        console.log("2. Go to Attack phase and attack with Admi.");
        console.log("3. Confirm cost prompt (trash 1 hand) appears.");
        console.log("4. After paying, confirm Admi proceeds with attack.");
    }

    setupBT01_Storm_Combat_Utilities_Scenario() {
        console.log("Setting up Storm Combat Utilities (BT01-056, 058, 070)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const ether = this.getCard("BT01-056");
        const mihara = this.getCard("BT01-058");
        const miharaSecret = this.getCard("BT01-070");
        const target = this.getCard("BT01-001");

        p0.hand = [];
        if (mihara) p0.hand.push(mihara);
        if (miharaSecret) p0.hand.push(miharaSecret);
        if (ether) p0.unitZones[0].unit = ether;

        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("1. Ether on field. Miharas in hand. Opponent has unit in Lane 0.");
        console.log("2. Use window.debug.setField(0, [null]) to trigger Ether's Exit: Buff enemy P-2000.");
        console.log("3. Play Mihara (BT01-058/070): If they block, combat terminates and they are trashed.");
    }

    setupBT01_Storm_Passive_Costs_Scenario() {
        console.log("Setting up Storm Passive Attack Costs (BT01-060, 065)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const admi = this.getCard("BT01-060");
        const maiden = this.getCard("BT01-065");
        const fodder = this.getCard("BT01-002");
        const target = this.getCard("BT01-001");

        p0.hand = fodder ? [fodder, fodder] : [];
        if (admi) p0.unitZones[0].unit = admi;
        if (maiden) p0.unitZones[1].unit = maiden;

        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("1. Admi and Maiden on field. Fodder in hand.");
        console.log("2. Attack with either: Confirm you must trash 1 hand card to proceed.");
    }

    setupBT01_Storm_Board_Control_Scenario() {
        console.log("Setting up Storm Board Control (BT01-061, 064, 069, 075, 077)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const sakura = this.getCard("BT01-061"); // ActiveMain
        const rapunzel = this.getCard("BT01-064"); // Entry
        const dorothy = this.getCard("BT01-069"); // Entry
        const glass = this.getCard("BT01-075"); // Skill
        const shot = this.getCard("BT01-077"); // Skill

        const selfFodder = this.getCard("BT01-010");
        const handFodder = this.getCard("BT01-001"); // 1 cost
        const targetLow = this.getCard("BT01-002"); // 1 cost
        const targetHigh = this.getCard("BT01-040"); // 6 cost

        p0.hand = [];
        [rapunzel, dorothy, glass, shot, handFodder, selfFodder].forEach(c => {
            if (c) p0.hand.push(c);
        });

        if (sakura) p0.unitZones[0].unit = sakura;
        if (selfFodder) p0.unitZones[1].unit = selfFodder;

        if (targetLow) p1.unitZones[0].unit = targetLow;
        if (targetHigh) p1.unitZones[1].unit = targetHigh;

        this.renderCallback();
        console.log("1. Board control cards in hand/field. Opponent has 1-cost and 6-cost units.");
        console.log("2. Sakura: Trash self fodder, buff other unit +2000.");
        console.log("3. Rapunzel: Play vs Encounter, trash 2 from hand to destroy.");
        console.log("4. Dorothy: Play vs 1-cost Encounter, destroy it.");
        console.log("5. Glass (Skill): Trash hand card, destroy enemy with same cost.");
        console.log("6. Shot (Skill): Choose target, trash hand cards equal to target's Hit, destroy it.");
    }

    setupBT01_Storm_Exit_Recursion_Scenario() {
        console.log("Setting up Storm Exit & Recursion (BT01-066, 068, 072, 080, 081, 079)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const soda = this.getCard("BT01-066");
        const bloom = this.getCard("BT01-068");
        const modernia = this.getCard("BT01-072");
        const boots = this.getCard("BT01-081");
        const glasses = this.getCard("BT01-080");
        const parasol = this.getCard("BT01-079");

        p0.hand = [];
        if (parasol) p0.hand.push(parasol);
        if (boots) p0.hand.push(boots);
        if (glasses) p0.hand.push(glasses);

        const exit1 = this.getCard("BT01-056");
        const exit2 = this.getCard("BT01-058");
        p0.trash = [];
        if (exit1) p0.trash.push(exit1);
        if (exit2) p0.trash.push(exit2);

        if (soda) p0.unitZones[0].unit = soda;
        if (bloom) p0.unitZones[1].unit = bloom;
        if (modernia) p0.unitZones[2].unit = modernia;

        p1.hand = [];
        ["BT01-001", "BT01-002", "BT01-003"].forEach(id => {
            const c = this.getCard(id);
            if (c) p1.hand.push(c);
        });

        this.renderCallback();
        console.log("1. Exit units and recursion in hand/field. Opponent has 3 cards.");
        console.log("2. Soda Exit: Opponent discards 1.");
        console.log("3. Bloom Exit: Draw 2, trash 1.");
        console.log("4. Modernia Passive: Grant 'Exit: Draw 1' to others (try trashing Soda).");
        console.log("5. Equip Glasses/Boots: Confirm Exit draw 2 (Glasses) or Turn end return (Boots).");
        console.log("6. Parasol (Skill): Return 2 Exit units from trash to hand.");
    }

    setupBT01_Storm_Synergy_Scenario() {
        console.log("Setting up Storm Synergy (BT01-063, 067, 076)...");
        const p0 = this.game.state.players[0];
        const exia = this.getCard("BT01-063");
        const mokdan = this.getCard("BT01-067");
        const training = this.getCard("BT01-076");

        p0.hand = [];
        if (training) p0.hand.push(training);
        if (exia) p0.unitZones[0].unit = exia;
        if (mokdan) p0.unitZones[1].unit = mokdan;

        this.renderCallback();
        console.log("1. Exia and Mokdan (Has MD) on field.");
        console.log("2. Confirm Exia buffs MD units (Mokdan) +2000.");
        console.log("3. Training (Skill): Buff MD unit +4500.");
    }

    setupBT01_Storm_Damage_Triggers_Scenario() {
        console.log("Setting up Storm Damage Triggers (BT01-071, 073, 074, 078)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const triggers = [
            this.getCard("BT01-071"), // Return to hand
            this.getCard("BT01-073"), // Opp discard
            this.getCard("BT01-074"), // Return to hand
            this.getCard("BT01-078")  // Return exit unit from trash
        ].filter(c => c !== null) as any[];

        p0.deck = [...triggers];
        const exit1 = this.getCard("BT01-056");
        if (exit1) p0.trash.push(exit1);

        p1.hand = [];
        ["BT01-001", "BT01-002", "BT01-003"].forEach(id => {
            const c = this.getCard(id);
            if (c) p1.hand.push(c);
        });

        this.renderCallback();
        console.log("1. Triggers at top of P0 deck. Opponent has 3 cards.");
        console.log("2. Dealt damage to P0: Confirm each trigger effect.");
    }

    setupBT01_064_Scenario() {
        this.forcePhase(Phase.MAIN);
        this.setLeaderLevel(0, 10); // Ensure enough cost
        this.setLeader(0, 'BT01-028');
        this.setHand(0, ['BT01-064', 'ST02-005', 'ST02-005', 'ST02-005']); // 3 dummy cards for cost
        this.setField(1, ['BT01-044', null, null]); // Encounter unit (using BT01-044 as valid unit)
        console.log("Setup BT01-064 Scenario: Play BT01-064 and check if it requires 2 cards to trash.");
        this.renderCallback();
    }
}
