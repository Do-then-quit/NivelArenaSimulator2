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
        // Note: The previous logic allowed placing if ANY unit was there, assuming upgrade.
        // But rule 3.5.5 says "cannot place... if cost is lower or equal" unless "upgrade" logic applies?
        // Actually 3.5.5 says: "Cannot place a unit with cost <= existing unit's cost".
        // 3.5.5.1 says: "If placing a unit with cost > existing, can upgrade."
        // So strict check:
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

        // Check for Targeted Effects FIRST (Validation Phase)
        let pendingTargetEffect: { manualEffect: any, validTargets: string } | null = null;

        if (card.effects) {
            const manualEffect = card.effects.find(e => e.activation === ActivationCondition.ACTIVE || e.activation === ActivationCondition.ENTRY); // Skill usually Entry or Active
            if (manualEffect && (manualEffect.action.target === 'CHOICE_UNIT' || manualEffect.action.type === 'DESTROY_LANE_LOWEST')) {
                // Check if valid targets exist (Rule 8.1.3.1.2)
                let validTargets = 'MY_UNITS'; // Default
                if (card.id.startsWith('ST02-012')) validTargets = 'MY_UNITS';
                if (manualEffect.action.type === 'DESTROY_LANE_LOWEST') validTargets = 'SHARED_LANE';

                let hasTarget = false;
                if (validTargets === 'MY_UNITS') {
                    hasTarget = this.currentPlayer.unitZones.some(z => z.unit !== null);
                } else if (validTargets === 'OPP_UNITS') {
                    hasTarget = this.opponentPlayer.unitZones.some(z => z.unit !== null);
                } else if (validTargets === 'SHARED_LANE') {
                    // Check if any lane has BOTH our unit and opponent unit
                    for (let i = 0; i < 3; i++) {
                        if (this.currentPlayer.unitZones[i].unit && this.opponentPlayer.unitZones[i].unit) {
                            hasTarget = true;
                            break;
                        }
                    }
                } else { // ALL_UNITS
                    hasTarget = this.currentPlayer.unitZones.some(z => z.unit !== null) || this.opponentPlayer.unitZones.some(z => z.unit !== null);
                }

                if (!hasTarget) {
                    console.log("Cannot play skill: No valid targets.");
                    return;
                }

                pendingTargetEffect = { manualEffect, validTargets };
            }
        }

        // Commit Actions (Move Card)
        this.currentPlayer.hand.splice(cardIndex, 1);
        this.currentPlayer.skillZone.push(card);

        // Execute Effect logic
        if (pendingTargetEffect) {
            // Enter Selection Mode
            this.state.interactionMode = 'SELECT_TARGET';
            this.state.pendingEffect = {
                sourceCard: card,
                sourcePlayerId: this.currentPlayer.id,
                actionType: pendingTargetEffect.manualEffect.action.type,
                actionValue: pendingTargetEffect.manualEffect.action.value,
                validTargets: pendingTargetEffect.validTargets as any
            };
            console.log("Entered Selection Mode for " + card.name);
            return; // Pause here, wait for selection
        }

        // Trigger Auto-Effects (like Teacher's Grace)
        this.effectManager.processEffects(ActivationCondition.ENTRY, {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            machine: this
        });
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

        // 1. Items
        zone.items.forEach(item => {
            // Check if item has direct power stat (simplified) or effects
            // Assuming simplified approach where items might have 'power' prop if we modified Card type,
            // but Card type only has power for Units.
            // Items stats usually come from text/effects.
            // For MVP/ST02, we can check basic hardcoded item IDs or parse effects.
            // However, to follow the plan, we should use the effect system or hardcode for now.
            // Let's implement a basic check for known items or existing 'power' on items if we allowed it.
            // actually Card interface 'power' is optional.
            if (item.power) power += item.power;
        });

        // 2. Continuous/Passive Effects
        // Check Unit's own effects
        if (zone.unit.effects) {
            zone.unit.effects.forEach(effect => {
                if (effect.activation === ActivationCondition.PASSIVE) {
                    // Specific Logic for Diesel (ST02-011)
                    if (effect.action.type === 'POWER_BUFF_BY_LEVEL') {
                        power += player.leaderLevel * (effect.action.value || 0);
                    }
                    if (effect.action.type === 'POWER_BUFF_CONST') {
                        power += (effect.action.value || 0);
                    }
                }
            });
        }

        // Check Items Effects (Armed)
        zone.items.forEach(item => {
            if (item.effects) {
                item.effects.forEach(effect => {
                    // Items usually have their effects active when equipped (PASSIVE/ARMED)
                    // Simple check:
                    if (effect.action.type === 'POWER_BUFF_CONST') {
                        power += (effect.action.value || 0);
                    }
                });
            } else {
                // Fallback for ST02 items if effects aren't fully parsed yet
                if (item.id.startsWith('ST02-016')) power += 2000; // Kevlar
                // ST02-017 is Helmet (Hit+1), no power
            }
        });

        // 3. Buffs
        zone.buffs.forEach(buff => {
            if (buff.type === 'POWER') {
                power += buff.value;
            }
        });

        return power;
    }

    public getUnitHit(zone: UnitZoneState, player: PlayerState): number {
        if (!zone.unit) return 0;
        let hit = zone.unit.hit || 0;

        // 1. Items
        zone.items.forEach(item => {
            if (item.hit) hit += item.hit;

            // Fallback/Effect check
            if (item.id.startsWith('ST02-017')) hit += 1; // Helmet
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

        const targetPlayer = isOpponentZone ? this.opponentPlayer : this.currentPlayer;
        const targetZone = targetPlayer.unitZones[zoneIndex];

        // Validate Target
        if (!targetZone.unit) {
            console.log("Invalid Target: Empty Zone");
            return;
        }

        // Validate Target Ownership
        const effect = this.state.pendingEffect;
        if (effect.validTargets === 'MY_UNITS') {
            if (isOpponentZone) {
                console.log("Invalid Target: Must be your unit");
                return;
            }
        } else if (effect.validTargets === 'OPP_UNITS') {
            if (!isOpponentZone) {
                console.log("Invalid Target: Must be opponent unit");
                return;
            }
        } else if (effect.validTargets === 'SHARED_LANE') {
            // For SHARED_LANE, clicking EITHER unit in the lane is fine, but the lane MUST have both.
            const myUnit = this.currentPlayer.unitZones[zoneIndex].unit;
            const oppUnit = this.opponentPlayer.unitZones[zoneIndex].unit;
            if (!myUnit || !oppUnit) {
                console.log("Invalid Target: Lane must have units from both players.");
                return;
            }
        }

        switch (effect.actionType) {
            case 'BUFF_TARGET':
                const buffType = 'POWER'; // Simplified, could be params
                const duration = 'TURN_END';
                targetZone.buffs.push({
                    id: Math.random().toString(36),
                    sourceCard: effect.sourceCard,
                    type: buffType,
                    value: effect.actionValue,
                    duration: duration
                });
                console.log(`Applied Buff: ${effect.actionValue} to ${targetZone.unit.name}`);
                break;
            case 'DESTROY_LANE_LOWEST':
                const myZ = this.currentPlayer.unitZones[zoneIndex];
                const oppZ = this.opponentPlayer.unitZones[zoneIndex];

                const myPower = this.getUnitPower(myZ, this.currentPlayer);
                const oppPower = this.getUnitPower(oppZ, this.opponentPlayer);

                console.log(`Comparing Power: My ${myPower} vs Opp ${oppPower}`);

                if (myPower < oppPower) {
                    this.destroyUnit(this.currentPlayer, myZ);
                    console.log("Destroyed My Unit (Lower Power)");
                } else if (oppPower < myPower) {
                    this.destroyUnit(this.opponentPlayer, oppZ);
                    console.log("Destroyed Opponent Unit (Lower Power)");
                } else {
                    // Equal -> Destroy Both
                    this.destroyUnit(this.currentPlayer, myZ);
                    this.destroyUnit(this.opponentPlayer, oppZ);
                    console.log("Destroyed Both Units (Equal Power)");
                }
                break;
        }

        // Reset State
        this.state.interactionMode = 'NORMAL';
        this.state.pendingEffect = null;

        // Trash the Skill Card after use?
        // Rules 6.6.1.3: Skill cards are trashed in End Phase. So they stay in Skill Zone.
        // We already pushed it to Skill Zone in playSkill.
    }
}
