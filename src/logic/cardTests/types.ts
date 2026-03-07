import { GameEngine } from '../GameEngine';

export interface CardTestContext {
    engine: GameEngine;
    getCard: (id: string) => any;
    assert: (condition: boolean, msg: string) => void;
    log: (msg: string) => void;
    resetEngine?: () => void;
}

export interface CardTestModule {
    setupScenarios: Record<string, (ctx: CardTestContext) => string>;
    runTests: Record<string, (ctx: CardTestContext) => Promise<void>>;
    displayNames?: Record<string, string>;
}
