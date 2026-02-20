import { GameEngine } from './GameEngine';
import { PlayerState, Phase, Card, CardType, ActivationCondition } from './types';
import { DUMMY_CARDS } from './CardDatabase';
import { RuleValidator } from './RuleValidator';
import { registerST01DebugScenarios } from './debugScenarios/st01';
import { registerST02DebugScenarios } from './debugScenarios/st02';
import { registerST03DebugScenarios } from './debugScenarios/st03';
import { registerBT01DebugScenarios } from './debugScenarios/bt01';

export class DebugManager {
    game: GameEngine;
    renderCallback: () => void;
    private debugCardCounter = 0;

    constructor(game: GameEngine, renderCallback: () => void) {
        this.game = game;
        this.renderCallback = renderCallback;
        console.log("DebugManager Initialized. Access via `window.debug`.");
        registerST01DebugScenarios(this);
        registerST02DebugScenarios(this);
        registerST03DebugScenarios(this);
        registerBT01DebugScenarios(this);
    }

    private getPlayer(playerIndex: number): PlayerState {
        return this.game.state.players[playerIndex];
    }

    private getCard(id: string): Card | null {
        const card = DUMMY_CARDS.find(c => c.id === id);
        if (!card) return null;
        this.debugCardCounter += 1;
        return { ...card, id: `${card.id}_debug_${this.debugCardCounter}` };
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
