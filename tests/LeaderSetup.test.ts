
import { GameEngine } from '../src/logic/GameEngine';
import { createDeck, DUMMY_CARDS } from '../src/logic/CardDatabase';
import { CardType } from '../src/logic/types';

function runTest() {
    console.log("Running: LeaderSetup - Verify Leader in LevelZone Only");

    const deck1 = createDeck();
    const deck2 = createDeck();
    const leader1 = DUMMY_CARDS.find(c => c.type === CardType.LEADER);
    const leader2 = DUMMY_CARDS.find(c => c.type === CardType.LEADER);

    if (!leader1 || !leader2) throw new Error("Could not find Leader card in DUMMY_CARDS");

    const game = new GameEngine('P1', 'P2', deck1, deck2, leader1, leader2);
    const p1 = game.currentPlayer;

    // 1. Check Level Zone
    if (!p1.levelZone) {
        throw new Error("Level Zone is empty");
    }
    if (p1.levelZone.type !== CardType.LEADER) {
        throw new Error(`Level Zone contains ${p1.levelZone.type}, expected LEADER`);
    }
    console.log("Level Zone check: PASSED");

    // 2. Check Deck
    const leadersInDeck = p1.deck.filter(c => c.type === CardType.LEADER);
    if (leadersInDeck.length > 0) {
        throw new Error(`Deck contains ${leadersInDeck.length} LEADER cards!`);
    }
    console.log("Deck check: PASSED");

    // 3. Check Hand (Game starts by drawing 5 cards)
    const leadersInHand = p1.hand.filter(c => c.type === CardType.LEADER);
    if (leadersInHand.length > 0) {
        throw new Error(`Hand contains ${leadersInHand.length} LEADER cards!`);
    }
    console.log("Hand check: PASSED");

    console.log("PASSED: LeaderSetup - Verify Leader in LevelZone Only");
}

function testRobustness() {
    console.log("Running: LeaderSetup - Robustness Check");
    const leader = DUMMY_CARDS.find(c => c.type === CardType.LEADER)!;
    
    // Create a deck WITH a leader in it
    const dirtyDeck = createDeck();
    dirtyDeck.push(leader); 

    // We need to provide a valid deck for P2 as well to avoid errors if any
    const cleanDeck = createDeck();

    const game = new GameEngine('P1', 'P2', dirtyDeck, cleanDeck, leader, leader);
    
    // Check if GameEngine cleaned it
    const p1 = game.currentPlayer;
    // Note: createPlayer shuffles the deck, so we check both deck and hand/trash just in case
    // But since the game starts, some cards might be in hand.
    
    const allCards = [...p1.deck, ...p1.hand, ...p1.trash];
    const leaders = allCards.filter(c => c.type === CardType.LEADER);

    if (leaders.length > 0) {
        throw new Error(`Robustness Fail: GameEngine accepted a deck with ${leaders.length} LEADER cards!`);
    }

    console.log("PASSED: LeaderSetup - Robustness Check");
}

runTest();
testRobustness();
