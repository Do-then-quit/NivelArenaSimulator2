import { GameState, PlayerState, Phase, Card, CardType, UnitZoneState, ActivationCondition } from './types';
import { EffectManager } from './effects';

export class GameEngine {
    state: GameState;
    effectManager: EffectManager;

    constructor(player1Name: string, player2Name: string, deck1: Card[], deck2: Card[], leader1: Card, leader2: Card) {
        this.effectManager = new EffectManager(this);
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
            interactionMode: 'NORMAL',
            pendingEffect: null,
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
                { unit: null, items: [], buffs: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false },
                { unit: null, items: [], buffs: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false },
                { unit: null, items: [], buffs: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false },
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

        // Remove TURN_END buffs
        [this.currentPlayer, this.opponentPlayer].forEach(p => {
            p.unitZones.forEach(z => {
                z.buffs = z.buffs.filter(b => b.duration !== 'TURN_END');
            });
        });

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

        // Logic check: 3.5.5 - Cannot place if existing unit has higher/equal cost (unless upgrading)
        if (zone.unit && card.cost <= zone.unit.cost) {
            console.log("Cannot place unit: Cost must be higher than existing unit to upgrade.");
            return;
        }

        let costToSubtract = 0;
        let isUpgrade = false;

        if (zone.unit) {
            if (card.cost > zone.unit.cost) {
                isUpgrade = true;
                // 6.4.1.1.2.1 Subtract cost of existing unit and its items when upgrading
                costToSubtract = zone.unit.cost + zone.items.reduce((sum, item) => sum + item.cost, 0);
            } else {
                console.log("Cannot place unit here (occupied and not upgradeable)");
                return;
            }
        }

        const currentSize = this.currentPlayer.leaderLevel + this.currentPlayer.damage.length;
        const currentFieldCost = this.calculateFieldCost(this.currentPlayer);

        if (currentFieldCost - costToSubtract + card.cost > currentSize) {
            console.log("Cost exceeds Size limit");
            return;
        }

        if (isUpgrade && zone.unit) {
            // Trash existing unit and items
            this.currentPlayer.trash.push(zone.unit);
            zone.items.forEach(i => this.currentPlayer.trash.push(i));
            zone.items = [];
            zone.buffs = []; // Clear buffs on old unit
        }


        this.currentPlayer.hand.splice(cardIndex, 1);
        zone.unit = card;
        zone.hasPlacedUnitThisTurn = true;
        zone.buffs = []; // Ensure clear state for new unit if not upgrade (though empty zone implies empty buffs)

        // Trigger Entry Effects
        this.effectManager.processEffects(ActivationCondition.ENTRY, {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: zone,
            machine: this
        });
    }

    playSkill(cardIndex: number) {
        if (this.state.phase !== Phase.MAIN) return;
        const card = this.currentPlayer.hand[cardIndex];
        if (!card || card.type !== CardType.SKILL) return;

        const currentSize = this.currentPlayer.leaderLevel + this.currentPlayer.damage.length;
        const currentFieldCost = this.calculateFieldCost(this.currentPlayer);
        if (currentFieldCost + card.cost > currentSize) {
            console.log("Cost exceeds Size limit");
            return;
        }

        // Validate Targets Existence for Manual Effects
        if (card.effects) {
            for (const effect of card.effects) {
                if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                    const hasValidTargets = this.checkPotentialTargets(effect.targets.scope);
                    if (!hasValidTargets) {
                        console.log(`Cannot play ${card.name}: No valid targets for effect.`);
                        return;
                    }
                }
            }
        }

        // Move to Skill Zone
        this.currentPlayer.hand.splice(cardIndex, 1);
        this.currentPlayer.skillZone.push(card);

        // Process Entry Effects (Skills are treated as Entry effects when played)
        this.effectManager.processEffects(ActivationCondition.ENTRY, {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            machine: this
        });
    }

    private checkPotentialTargets(scope: string): boolean {
        switch (scope) {
            case 'MY_FIELD':
                return this.currentPlayer.unitZones.some(z => z.unit !== null);
            case 'OPP_FIELD':
                return this.opponentPlayer.unitZones.some(z => z.unit !== null);
            case 'SHARED_LANE':
                // Needs units in BOTH slots of the same lane index
                for (let i = 0; i < 3; i++) {
                    if (this.currentPlayer.unitZones[i].unit && this.opponentPlayer.unitZones[i].unit) return true;
                }
                return false;
            case 'ALL':
            case 'BOTH_FIELDS':
                return this.currentPlayer.unitZones.some(z => z.unit !== null) || this.opponentPlayer.unitZones.some(z => z.unit !== null);
            default:
                return true; // Self or other non-unit targets assumed always valid or checked elsewhere
        }
    }

    initiateTargetSelection(effect: any, context: any) {
        this.state.interactionMode = 'SELECT_TARGET';
        // Create a PendingEffect state to store context until target is selected
        this.state.pendingEffect = {
            sourceCard: context.sourceCard,
            sourcePlayerId: context.player.id,
            actionType: effect.action.type, // redundant but useful for UI
            actionValue: effect.action.params,
            validTargets: effect.targets.scope // specific simplified scope for UI
        };
        // We need to store the full effect object to resume execution
        // But GameState must be serializable. Ideally we store the Effect ID or index.
        // For prototype, we'll attach the ephemeral effect object to the state instance (bad practice for serialization but ok for now)
        (this.state.pendingEffect as any)._fullEffect = effect;
        (this.state.pendingEffect as any)._context = context;

        console.log("Entered Selection Mode for " + context.sourceCard.name);
    }

    attack(attackerZoneIndex: number) {
        if (this.state.phase !== Phase.ATTACK) return;
        const attackerZone = this.currentPlayer.unitZones[attackerZoneIndex];
        if (!attackerZone.unit || attackerZone.hasAttacked) return;

        attackerZone.hasAttacked = true;

        // Trigger Attacker Effects
        this.effectManager.processEffects(ActivationCondition.ATTACKER, {
            sourceCard: attackerZone.unit,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: attackerZone,
            machine: this
        });

        // Lane Alignment: In mirrored layout, Lane 0 faces Lane 0
        const blockerZoneIndex = attackerZoneIndex;
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        if (blockerZone.unit) {
            // Encounter Unit exists -> Go to BLOCK phase
            this.state.phase = Phase.BLOCK;
            this.state.pendingAttackerIndex = attackerZoneIndex;
        } else {
            // Direct Attack
            this.dealDamage(this.opponentPlayer, this.getUnitHit(attackerZone, this.currentPlayer));
        }
    }

    resolveBlock(shouldBlock: boolean) {
        if (this.state.phase !== Phase.BLOCK || this.state.pendingAttackerIndex === null) return;

        const attackerZoneIndex = this.state.pendingAttackerIndex;
        const attackerZone = this.currentPlayer.unitZones[attackerZoneIndex];

        const blockerZoneIndex = attackerZoneIndex;
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        if (shouldBlock && blockerZone.unit) {
            // Trigger Defender Effects
            this.effectManager.processEffects(ActivationCondition.DEFENDER, {
                sourceCard: blockerZone.unit,
                player: this.opponentPlayer,
                opponent: this.currentPlayer,
                unitZone: blockerZone,
                machine: this
            });

            // Combat
            this.resolveCombat(attackerZone, blockerZone);
        } else {
            // Direct Damage
            this.dealDamage(this.opponentPlayer, this.getUnitHit(attackerZone, this.currentPlayer));
        }

        // Return to ATTACK phase
        this.state.phase = Phase.ATTACK;
        this.state.pendingAttackerIndex = null;
    }

    private resolveCombat(attacker: UnitZoneState, blocker: UnitZoneState) {
        // Use calculated stats
        const attPower = this.getUnitPower(attacker, this.currentPlayer);
        const blkPower = this.getUnitPower(blocker, this.opponentPlayer);

        console.log(`Combat! Attacker Power: ${attPower}, Blocker Power: ${blkPower}`);

        if (attPower >= blkPower) {
            this.destroyUnit(this.opponentPlayer, blocker);
        }

        if (blkPower > attPower) {
            this.destroyUnit(this.currentPlayer, attacker);
        }
    }

    public destroyUnit(player: PlayerState, zone: UnitZoneState) {
        if (zone.unit) {
            // Trigger Exit Effects
            this.effectManager.processEffects(ActivationCondition.EXIT, {
                sourceCard: zone.unit,
                player: player,
                opponent: player === this.state.players[0] ? this.state.players[1] : this.state.players[0], // simplified check for opponent
                unitZone: zone,
                machine: this
            });

            player.trash.push(zone.unit);
            zone.items.forEach(i => player.trash.push(i));
            zone.unit = null;
            zone.items = [];
            zone.buffs = [];
        }
    }

    public dealDamage(player: PlayerState, amount: number) {
        for (let i = 0; i < amount; i++) {
            if (player.deck.length === 0) {
                this.state.winner = this.state.turnPlayerIndex === 0 ? this.state.players[0].id : this.state.players[1].id;
                return;
            }
            const card = player.deck.pop()!;
            player.damage.push(card);

            // Check for Damage Triggers
            this.effectManager.processEffects(ActivationCondition.DAMAGE_TRIGGER, {
                sourceCard: card,
                player: player,
                opponent: this.state.players.find(p => p.id !== player.id),
                machine: this
            });
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

    public getUnitPower(zone: UnitZoneState, player: PlayerState): number {
        if (!zone.unit) return 0;
        let power = zone.unit.power || 0;

        // 1. Items (Stats handled via PASSIVE effects now)
        zone.items.forEach(item => {
            if (item.power) power += item.power;
            // Check item passive effects
            if (item.effects) {
                item.effects.forEach(effect => {
                    if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'BUFF_POWER') {
                        const params = effect.action.params || {};
                        power += (params.value || 0);
                    }
                });
            }
        });

        // 2. Continuous/Passive Effects on Unit
        if (zone.unit.effects) {
            zone.unit.effects.forEach(effect => {
                if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'BUFF_POWER') {
                    // Logic to check conditions (already done in EffectManager but this is a continuous query)
                    // Simplified: assume ALWAYS for MVP or simple check
                    const params = effect.action.params || {};
                    let value = params.value || 0;
                    if (params.dynamic === 'LEADER_LEVEL_MULTIPLIER') {
                        value = player.leaderLevel * value;
                    }
                    power += value;
                }
            });
        }

        // 3. Buffs
        zone.buffs.forEach(buff => {
            if (buff.type === 'POWER') {
                power += buff.value;
            }
        });

        return power;
    }

    public getUnitHit(zone: UnitZoneState, _player: PlayerState): number {
        if (!zone.unit) return 0;
        let hit = zone.unit.hit || 0;

        // 1. Items
        zone.items.forEach(item => {
            if (item.hit) hit += item.hit;
            if (item.effects) {
                item.effects.forEach(effect => {
                    if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'BUFF_HIT') {
                        const params = effect.action.params || {};
                        // Check condition if any (e.g. Cost Comparison for Helmet)
                        let conditionMet = true;
                        if (effect.condition && effect.condition.type === 'COST_COMPARISON') {
                            const val = effect.condition.value;
                            if (val && val.operator === 'GTE' && zone.unit) {
                                if (zone.unit.cost < val.cost) conditionMet = false;
                            }
                        }

                        if (conditionMet) hit += (params.value || 0);
                    }
                });
            }
        });

        // 2. Buffs
        zone.buffs.forEach(buff => {
            if (buff.type === 'HIT') {
                hit += buff.value;
            }
        });

        return hit;
    }


    public selectTarget(zoneIndex: number, isOpponentZone: boolean) {
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return;

        // This logic handles the manual selection input from the UI
        const pending = this.state.pendingEffect as any;
        const effect = pending._fullEffect;
        const context = pending._context;

        const targetPlayer = isOpponentZone ? this.opponentPlayer : this.currentPlayer;
        const targetZone = targetPlayer.unitZones[zoneIndex];
        const scope = effect.targets?.scope;

        // 1. Ownership Scope Validation
        if (scope === 'MY_FIELD' && isOpponentZone) {
            console.log("Invalid Target: Must pick your own unit.");
            return;
        }
        if (scope === 'OPP_FIELD' && !isOpponentZone) {
            console.log("Invalid Target: Must pick opponent's unit.");
            return;
        }

        // 2. Unit Existence Validation
        // For shared lane, we deal with the lane index, but usually user clicks a unit.
        // We'll trust the checked lane logic.
        if (scope !== 'SHARED_LANE' && effect.targets?.type === 'UNIT') {
            if (!targetZone.unit) {
                console.log("Invalid Target: Empty Zone.");
                return;
            }
        }

        // 3. Shared Lane Validation
        if (scope === 'SHARED_LANE') {
            const myUnit = this.currentPlayer.unitZones[zoneIndex].unit;
            const oppUnit = this.opponentPlayer.unitZones[zoneIndex].unit;
            if (!myUnit || !oppUnit) {
                console.log("Invalid Target: Lane is not shared (needs units on both sides).");
                return;
            }
        }


        // If everything good, execute
        // For Shared Lane, we pass the index
        if (effect.action.type === 'DESTROY_LANE_LOWEST') {
            context.selectedLaneIndex = zoneIndex;
        }

        // Execute via Manager
        this.effectManager.executeEffect(effect, context, [targetZone]);

        // Reset State
        this.state.interactionMode = 'NORMAL';
        this.state.pendingEffect = null;
    }
}
