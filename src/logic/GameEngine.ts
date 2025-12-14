import { GameState, PlayerState, Phase, Card, CardType, UnitZoneState } from './types';

export class GameEngine {
    state: GameState;

    constructor(player1Name: string, player2Name: string, deck1: Card[], deck2: Card[], leader1: Card, leader2: Card) {
        this.state = {
            players: [
                this.createPlayer(player1Name, deck1, leader1),
                this.createPlayer(player2Name, deck2, leader2),
            ],
            turnPlayerIndex: 0, // Randomize later
            phase: Phase.LEVEL_UP,
            turnCount: 1,
            winner: null,
            pendingAttackerIndex: null,
        };
        this.startGame();
    }

    private createPlayer(name: string, deck: Card[], leader: Card): PlayerState {
        return {
            id: Math.random().toString(36).substring(7),
            name,
            deck: this.shuffle([...deck]),
            hand: [],
            trash: [],
            damage: [],
            levelZone: leader,
            leaderLevel: 1,
            unitZones: [
                { unit: null, items: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false },
                { unit: null, items: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false },
                { unit: null, items: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false },
            ],
            skillZone: [],
        };
    }

    private shuffle(deck: Card[]): Card[] {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    private startGame() {
        // Draw 5 cards for each player
        this.drawCard(0, 5);
        this.drawCard(1, 5);
    }

    get currentPlayer(): PlayerState {
        return this.state.players[this.state.turnPlayerIndex];
    }

    get opponentPlayer(): PlayerState {
        return this.state.players[this.state.turnPlayerIndex === 0 ? 1 : 0];
    }

    drawCard(playerIndex: number, count: number = 1) {
        const player = this.state.players[playerIndex];
        for (let i = 0; i < count; i++) {
            if (player.deck.length === 0) {
                this.state.winner = this.state.players[playerIndex === 0 ? 1 : 0].id; // Loss by deck out
                return;
            }
            const card = player.deck.pop()!;
            player.hand.push(card);
        }
    }

    nextPhase() {
        if (this.state.winner) return;

        switch (this.state.phase) {
            case Phase.LEVEL_UP:
                if (this.currentPlayer.leaderLevel < 10) {
                    this.currentPlayer.leaderLevel++;
                }
                this.state.phase = Phase.DRAW;
                this.nextPhase();
                break;
            case Phase.DRAW:
                if (!(this.state.turnCount === 1 && this.state.turnPlayerIndex === 0)) {
                    this.drawCard(this.state.turnPlayerIndex);
                }
                this.state.phase = Phase.MAIN;
                break;
            case Phase.MAIN:
                this.state.phase = Phase.ATTACK;
                break;
            case Phase.ATTACK:
                this.state.phase = Phase.END;
                this.endPhase();
                break;
            case Phase.BLOCK:
                console.warn("Cannot skip BLOCK phase manually. Must resolve block.");
                break;
            case Phase.END:
                this.endTurn();
                break;
        }
    }

    private endPhase() {
        // Trash skills
        this.currentPlayer.skillZone.forEach(c => this.currentPlayer.trash.push(c));
        this.currentPlayer.skillZone = [];

        // Hand limit 7
        while (this.currentPlayer.hand.length > 7) {
            const discarded = this.currentPlayer.hand.pop()!;
            this.currentPlayer.trash.push(discarded);
        }
    }

    private endTurn() {
        this.currentPlayer.unitZones.forEach(z => {
            z.hasAttacked = false;
            z.isExhausted = false;
            z.hasPlacedUnitThisTurn = false; // Reset placement limit
        });

        this.state.turnPlayerIndex = this.state.turnPlayerIndex === 0 ? 1 : 0;
        this.state.turnCount++;
        this.state.phase = Phase.LEVEL_UP;
    }

    // Actions
    playUnit(cardIndex: number, zoneIndex: number) {
        if (this.state.phase !== Phase.MAIN) return;
        const card = this.currentPlayer.hand[cardIndex];
        if (!card || card.type !== CardType.UNIT) return;

        const zone = this.currentPlayer.unitZones[zoneIndex];

        // 6.4.1.1.3 Check if unit was already placed in this zone this turn
        if (zone.hasPlacedUnitThisTurn) {
            console.log("Cannot place unit: Already placed in this zone this turn.");
            return;
        }

        const currentSize = this.currentPlayer.leaderLevel + this.currentPlayer.damage.length;
        const currentFieldCost = this.calculateFieldCost(this.currentPlayer);
        if (currentFieldCost + card.cost > currentSize) {
            console.log("Cost exceeds Size limit");
            return;
        }

        if (zone.unit) {
            if (card.cost > zone.unit.cost) {
                this.currentPlayer.trash.push(zone.unit);
                zone.items.forEach(i => this.currentPlayer.trash.push(i));
                zone.items = [];
            } else {
                console.log("Cannot place unit here (occupied and not upgradeable)");
                return;
            }
        }

        this.currentPlayer.hand.splice(cardIndex, 1);
        zone.unit = card;
        zone.hasPlacedUnitThisTurn = true;
    }

    attack(attackerZoneIndex: number) {
        if (this.state.phase !== Phase.ATTACK) return;
        const attackerZone = this.currentPlayer.unitZones[attackerZoneIndex];
        if (!attackerZone.unit || attackerZone.hasAttacked) return;

        attackerZone.hasAttacked = true;

        // Lane Alignment: Player 1's Lane 0 faces Player 2's Lane 2 (assuming 3 lanes)
        const blockerZoneIndex = 2 - attackerZoneIndex;
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        if (blockerZone.unit) {
            // Encounter Unit exists -> Go to BLOCK phase
            this.state.phase = Phase.BLOCK;
            this.state.pendingAttackerIndex = attackerZoneIndex;
        } else {
            // Direct Attack
            this.dealDamage(this.opponentPlayer, attackerZone.unit.hit || 0);
        }
    }

    resolveBlock(shouldBlock: boolean) {
        if (this.state.phase !== Phase.BLOCK || this.state.pendingAttackerIndex === null) return;

        const attackerZoneIndex = this.state.pendingAttackerIndex;
        const attackerZone = this.currentPlayer.unitZones[attackerZoneIndex];

        const blockerZoneIndex = 2 - attackerZoneIndex;
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        if (shouldBlock && blockerZone.unit) {
            // Combat
            this.resolveCombat(attackerZone, blockerZone);
        } else {
            // Direct Damage
            this.dealDamage(this.opponentPlayer, attackerZone.unit!.hit || 0);
        }

        // Return to ATTACK phase
        this.state.phase = Phase.ATTACK;
        this.state.pendingAttackerIndex = null;
    }

    private resolveCombat(attacker: UnitZoneState, blocker: UnitZoneState) {
        const attUnit = attacker.unit!;
        const blkUnit = blocker.unit!;

        if ((attUnit.power || 0) >= (blkUnit.power || 0)) {
            this.destroyUnit(this.opponentPlayer, blocker);
        }

        if ((blkUnit.power || 0) > (attUnit.power || 0)) {
            this.destroyUnit(this.currentPlayer, attacker);
        }
    }

    private destroyUnit(player: PlayerState, zone: UnitZoneState) {
        if (zone.unit) {
            player.trash.push(zone.unit);
            zone.items.forEach(i => player.trash.push(i));
            zone.unit = null;
            zone.items = [];
        }
    }

    private dealDamage(player: PlayerState, amount: number) {
        for (let i = 0; i < amount; i++) {
            if (player.deck.length === 0) {
                this.state.winner = this.state.turnPlayerIndex === 0 ? this.state.players[0].id : this.state.players[1].id;
                return;
            }
            const card = player.deck.pop()!;
            player.damage.push(card);
        }
        if (player.damage.length >= 10) {
            this.state.winner = this.state.turnPlayerIndex === 0 ? this.state.players[0].id : this.state.players[1].id;
        }
    }

    private calculateFieldCost(player: PlayerState): number {
        let cost = 0;
        player.unitZones.forEach(z => {
            if (z.unit) cost += z.unit.cost;
            z.items.forEach(i => cost += i.cost);
        });
        player.skillZone.forEach(s => cost += s.cost);
        return cost;
    }
}
