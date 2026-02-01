import { GameEngine } from './GameEngine';
import { Card } from './types';
import { DUMMY_CARDS, createDeck } from './CardDatabase';
import { findTestModule } from './cardTests/registry';
import { CardTestContext } from './cardTests/types';

export interface TestResult {
    cardId: string;
    success: boolean;
    logs: string[];
    error?: string;
}

export class CardTester {
    private engine: GameEngine;
    private logs: string[] = [];

    constructor() {
        this.engine = this.createTestEngine();
    }

    private createTestEngine(): GameEngine {
        const deck1 = createDeck();
        const deck2 = createDeck();
        const leader1 = DUMMY_CARDS.find(c => c.id === 'ST01-001') || DUMMY_CARDS[0];
        const leader2 = DUMMY_CARDS.find(c => c.id === 'ST01-001') || DUMMY_CARDS[0];
        return new GameEngine('Test P1', 'Test P2', deck1, deck2, leader1, leader2);
    }

    public log(msg: string) {
        this.logs.push(msg);
        console.log(`[Tester] ${msg}`);
    }

    public getCard(id: string): Card {
        const card = DUMMY_CARDS.find(c => c.id === id);
        if (!card) throw new Error(`Card ${id} not found in database`);
        return JSON.parse(JSON.stringify(card));
    }

    public assert(condition: boolean, msg: string) {
        if (!condition) {
            throw new Error(`Assertion Failed: ${msg}`);
        }
        this.log(`PASS: ${msg}`);
    }

    private reset(cardId: string) {
        this.logs = [];
        this.engine = this.createTestEngine();
        this.log(`Starting test for ${cardId}`);
    }

    private createCtx(): CardTestContext {
        return {
            engine: this.engine,
            getCard: (id: string) => this.getCard(id),
            assert: (condition: boolean, msg: string) => this.assert(condition, msg),
            log: (msg: string) => this.log(msg)
        };
    }

    public setupScenario(cardId: string): { engine: GameEngine, instructions: string } {
        this.reset(cardId);
        let instructions = "";

        const module = findTestModule(cardId);
        if (module && module.setupScenarios[cardId]) {
            instructions = module.setupScenarios[cardId](this.createCtx());
        } else {
            this.log(`No scenario found for ${cardId}`);
            instructions = "Scenario not implemented.";
        }

        return { engine: this.engine, instructions };
    }

    public async runTest(cardId: string): Promise<TestResult> {
        this.setupScenario(cardId);
        try {
            const module = findTestModule(cardId);
            if (module && module.runTests[cardId]) {
                await module.runTests[cardId](this.createCtx());
            } else {
                throw new Error(`Test for ${cardId} not implemented yet`);
            }
            return { cardId, success: true, logs: this.logs };
        } catch (e: any) {
            this.log(`ERROR: ${e.message}`);
            return { cardId, success: false, logs: this.logs, error: e.message };
        }
    }
}