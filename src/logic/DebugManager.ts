import { GameEngine } from './GameEngine';
import { PlayerState, Phase, Card, CardType } from './types';
import { DUMMY_CARDS } from './CardDatabase';

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

    private getCard(idOrName: string): Card | null {
        // Simple lookup by ID or Name from DUMMY_CARDS
        const card = DUMMY_CARDS.find(c => c.id === idOrName || c.name === idOrName);
        if (!card) return null;
        // Return a fresh copy
        return { ...card, id: `${card.id}_debug_${Date.now()}` };
    }

    // --- State Manipulation ---

    setLeaderLevel(playerIndex: number, level: number) {
        const player = this.getPlayer(playerIndex);
        if (player) {
            player.leaderLevel = level;
            console.log(`Player ${playerIndex} Level set to ${level}`);
            this.renderCallback();
        }
    }

    setHand(playerIndex: number, cardIdsOrNames: string[]) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;

        const newHand: Card[] = [];
        for (const id of cardIdsOrNames) {
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

    setField(playerIndex: number, unitIdsOrNames: (string | null)[]) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;

        for (let i = 0; i < 3; i++) {
            const id = unitIdsOrNames[i];
            const zone = player.unitZones[i];

            // Clean up existing
            if (zone.unit) {
                // Just remove reference, strictly speaking we might want to trigger exit effects? 
                // But this is "Force Set", so maybe not. Let's just overwrite.
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

    // --- Automated Testing ---

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

    async runAllTests() {
        console.log("Starting Automated Tests...");

        await this.runTest("Modify Leader Level", () => {
            this.setLeaderLevel(0, 5);
            this.assert(this.game.state.players[0].leaderLevel === 5, "Leader level should be 5");
        });

        await this.runTest("Add Card to Hand", () => {
            this.setHand(0, ["N102"]);
            this.assert(this.game.state.players[0].hand.length === 1, "Hand size should be 1");
            this.assert(this.game.state.players[0].hand[0].name === "N102", "Card should be N102");
        });

        await this.runTest("Place Unit on Field", () => {
            this.setField(0, ["미카", null, null]);
            const zone0 = this.game.state.players[0].unitZones[0];
            this.assert(zone0.unit !== null && zone0.unit.name === "미카", "Zone 0 should have Mika");
        });

        // Add more complex tests here...
        console.log("All Tests Completed.");
    }
}
