import * as readline from 'readline';
import { GameEngine } from '../logic/GameEngine';
import { CardDatabase } from '../logic/CardDatabase';
import { CommandParser, CLICommand } from './CommandParser';
import { TextRenderer } from './TextRenderer';
import { Card } from '../logic/types';

export class CLIHost {
    private engine: GameEngine;
    private parser: CommandParser;
    private renderer: TextRenderer;
    private rl: readline.Interface;

    constructor() {
        this.parser = new CommandParser();
        this.renderer = new TextRenderer();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Initialize Game
        console.log("Initializing NivelArena CLI...");
        const db = CardDatabase.getInstance();

        // Load default decks (using ST04 for now as it's open)
        // Ideally we'd have a deck loader, but for CLI test, hardcode or simple load
        const deck1 = this.createTestDeck(db);
        const deck2 = this.createTestDeck(db);
        const leader1 = db.getCard('ST04-001'); // Sol
        const leader2 = db.getCard('ST04-001'); // Sol

        if (!leader1 || !leader2) {
            console.error("Failed to load leaders. Check CardDatabase.");
            process.exit(1);
        }

        this.engine = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2);
    }

    private createTestDeck(db: CardDatabase): Card[] {
        // Simple test deck
        const ids = ['ST04-002', 'ST04-003', 'ST04-004', 'ST04-005', 'ST04-006',
            'ST04-007', 'ST04-008', 'ST04-009', 'ST04-010', 'ST04-011'];
        const deck: Card[] = [];
        for (let i = 0; i < 3; i++) {
            ids.forEach(id => {
                const card = db.getCard(id);
                if (card) deck.push(JSON.parse(JSON.stringify(card)));
            });
        }
        return deck.slice(0, 30); // 30 cards
    }

    public async start() {
        console.log("Game Started!");
        this.render();

        while (true) {
            const input = await this.ask('Action > ');
            const cmd = this.parser.parse(input);
            this.handleCommand(cmd);
            this.render();

            if (this.engine.state.winner) {
                console.log(`\n*** GAME OVER. Winner: ${this.engine.state.winner} ***\n`);
                break;
            }
        }
    }

    private handleCommand(cmd: CLICommand) {
        if (!cmd) return;

        try {
            switch (cmd.type) {
                case 'EXIT':
                    process.exit(0);
                    break;
                case 'HELP':
                    console.log(`
Commands:
  play <cardIndex> [zoneIndex]  : Play a unit or item
  play <cardIndex>              : Play a skill
  attack <zoneIndex>            : Attack with unit in zone
  pass / next                   : End phase/turn
  select <indices...>           : Select targets/costs (space separated)
  confirm                       : Confirm optional choice (yes)
  cancel                        : Cancel optional choice (no)
  debug                         : Dump state
                    `);
                    break;
                case 'PASS':
                    this.engine.nextPhase();
                    break;
                case 'PLAY':
                    this.handlePlay(cmd.args);
                    break;
                case 'ATTACK':
                    if (cmd.args.length < 1) {
                        console.log("Usage: attack <zoneIndex>");
                    } else {
                        const zoneIdx = parseInt(cmd.args[0]);
                        this.engine.attack(zoneIdx);
                    }
                    break;
                case 'SELECT':
                    this.handleSelect(cmd.args);
                    break;
                case 'CONFIRM':
                    if (this.engine.state.interactionMode === 'SELECT_OPTIONAL') {
                        this.engine.resolveOptionalEffect(true);
                    } else {
                        console.log("Nothing to confirm.");
                    }
                    break;
                case 'CANCEL':
                    if (this.engine.state.interactionMode === 'SELECT_OPTIONAL') {
                        this.engine.resolveOptionalEffect(false);
                    } else {
                        console.log("Nothing to cancel.");
                    }
                    break;
                case 'DEBUG':
                    console.log(JSON.stringify(this.engine.state, null, 2));
                    break;
                case 'UNKNOWN':
                default:
                    console.log("Unknown command. Type 'help'.");
                    break;
            }
        } catch (e) {
            console.error("Error executing command:", e);
        }
    }

    private handlePlay(args: string[]) {
        if (args.length < 1) {
            console.log("Usage: play <cardIndex> [zoneIndex]");
            return;
        }
        const cardIndex = parseInt(args[0]);
        const card = this.engine.currentPlayer.hand[cardIndex];

        if (!card) {
            console.log("Invalid card index.");
            return;
        }

        if (card.type === 'UNIT') {
            const zoneIndex = args.length > 1 ? parseInt(args[1]) : this.findEmptyZone();
            if (zoneIndex === -1) {
                console.log("No empty zones. Specify zone to replace.");
                return;
            }
            this.engine.playUnit(cardIndex, zoneIndex);
        } else if (card.type === 'ITEM') {
            if (args.length < 2) {
                console.log("Usage: play <cardIndex> <zoneIndex>");
                return;
            }
            const zoneIndex = parseInt(args[1]);
            this.engine.playItem(cardIndex, zoneIndex);
        } else if (card.type === 'SKILL') {
            this.engine.playSkill(cardIndex);
        }
    }

    private handleSelect(args: string[]) {
        const mode = this.engine.state.interactionMode;
        if (mode === 'NORMAL') {
            console.log("Not in selection mode.");
            return;
        }

        if (mode === 'SELECT_COST') {
            // Cost selection (usually Hand index)
            const indices = args.map(a => parseInt(a)).filter(n => !isNaN(n));
            if (indices.length > 0) {
                this.engine.selectCost(indices[0]);
            }
            return;
        }

        if (mode === 'SELECT_TARGET') {
            const pending = this.engine.state.pendingEffect;
            if (!pending) return;

            const scope = pending.validTargets; // This is the simple scope string from GameEngine
            // Note: GameEngine.ts initTargetSelection sets validTargets = effect.targets.scope

            // Handle "select opp 1" or "select 1"
            let isOpponent = false;
            let indices: number[] = [];

            args.forEach(arg => {
                if (arg.toLowerCase() === 'opp' || arg.toLowerCase() === 'opponent' || arg.toLowerCase() === 'o') {
                    isOpponent = true;
                } else {
                    const parsed = parseInt(arg);
                    if (!isNaN(parsed)) indices.push(parsed);
                }
            });

            if (indices.length === 0) {
                console.log("No valid indices provided.");
                return;
            }

            // Dispatch based on scope
            const index = indices[0]; // Process first index for now, complex multi-select might need loop

            switch (scope) {
                case 'MY_FIELD':
                    this.engine.selectTarget(index, false);
                    break;
                case 'OPP_FIELD':
                case 'ENCOUNTER':
                case 'ENCOUNTER_UNIT':
                    this.engine.selectTarget(index, true);
                    break;
                case 'BOTH_FIELDS':
                case 'SHARED_LANE':
                    // User must specify 'opp' if they mean opponent, otherwise default to self
                    // or maybe prompts should clearer.
                    this.engine.selectTarget(index, isOpponent);
                    break;
                case 'MY_TRASH':
                    this.engine.selectTrashTarget(index);
                    break;
                case 'MY_HAND':
                    this.engine.selectHandTarget(index, false);
                    break;
                case 'OPP_HAND':
                    this.engine.selectHandTarget(index, true);
                    break;
                case 'REVEALED':
                case 'LAST_DRAWN': // uses revealed logic often or custom? 
                    // GameEngine.selectRevealedTarget exists
                    this.engine.selectRevealedTarget(index);
                    break;
                default:
                    console.log(`Unknown target scope: ${scope}. Trying generic target selection.`);
                    this.engine.selectTarget(index, isOpponent);
                    break;
            }
        } else if (mode === 'SELECT_OPTIONAL') {
            // select command doesn't apply to optional (YES/NO), but maybe 'select 1' maps to yes?
            console.log("Use 'confirm' (yes) or 'cancel' (no) for optional effects.");
        }
    }

    private findEmptyZone(): number {
        const p = this.engine.currentPlayer;
        return p.unitZones.findIndex(z => z.unit === null);
    }

    private render() {
        console.clear();
        console.log(this.renderer.render(this.engine));
    }

    private ask(query: string): Promise<string> {
        return new Promise(resolve => {
            this.rl.question(query, resolve);
        });
    }
}

// Entry point (ES module compatible)
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

// Check if this file is being run directly
if (process.argv[1] === __filename || process.argv[1]?.endsWith('CLIHost.ts')) {
    const cli = new CLIHost();
    cli.start();
}
