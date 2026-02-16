import { GameEngine } from './GameEngine';
import { Card } from './types';
import { DUMMY_CARDS, createDeck } from './CardDatabase';
import { findTestModule, CARD_TEST_REGISTRY } from './cardTests/registry';
import { CardTestContext } from './cardTests/types';

export interface TestResult {
    testId: string;
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

    private reset(testId: string) {
        this.logs = [];
        this.engine = this.createTestEngine();
        this.log(`Starting test for ${testId}`);
    }

    private createCtx(): CardTestContext {
        const self = this;
        return {
            get engine() {
                return self.engine;
            },
            getCard: (id: string) => self.getCard(id),
            assert: (condition: boolean, msg: string) => self.assert(condition, msg),
            log: (msg: string) => self.log(msg),
            resetEngine: () => {
                self.engine = self.createTestEngine();
            },
        };
    }

    public setupScenario(testId: string): { engine: GameEngine, instructions: string } {
        this.reset(testId);
        let instructions = "";

        const module = findTestModule(testId);
        if (module && module.setupScenarios[testId]) {
            instructions = module.setupScenarios[testId](this.createCtx());
        } else {
            this.log(`No scenario found for ${testId}`);
            instructions = "Scenario not implemented.";
        }

        return { engine: this.engine, instructions };
    }

    public async runTest(testId: string): Promise<TestResult> {
        this.setupScenario(testId);
        try {
            const module = findTestModule(testId);
            if (module && module.runTests[testId]) {
                await module.runTests[testId](this.createCtx());
            } else {
                throw new Error(`Test for ${testId} not implemented yet`);
            }
            return { testId, success: true, logs: this.logs };
        } catch (e: any) {
            this.log(`ERROR: ${e.message}`);
            return { testId, success: false, logs: this.logs, error: e.message };
        }
    }
    public getAvailablePacks(): string[] {
        return Object.keys(CARD_TEST_REGISTRY);
    }

    public getTestsForPack(packId: string): string[] {
        const module = CARD_TEST_REGISTRY[packId];
        return module ? Object.keys(module.runTests) : [];
    }
}
