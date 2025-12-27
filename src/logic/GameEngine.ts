import { GameState, PlayerState, Phase, Card, UnitZoneState, ActivationCondition, CardType, GameContext } from './types';
import { EffectManager } from './effects';
import { RuleValidator } from './RuleValidator';
import { TargetSelector } from './TargetSelector';

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
        // Strict Rule: Decks cannot contain Leaders.
        const validDeck = deck.filter(c => c.type !== CardType.LEADER);

        // Deep copy leader to ensure independence
        const leaderCopy = JSON.parse(JSON.stringify(leader));

        return {
            id: Math.random().toString(36).substring(7),
            name,
            deck: this.shuffle([...validDeck]),
            hand: [],
            trash: [],
            damage: [],
            levelZone: leaderCopy,
            leaderLevel: 1,
            unitZones: [
                { unit: null, items: [], buffs: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false },
                { unit: null, items: [], buffs: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false },
                { unit: null, items: [], buffs: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false },
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
                this.addLeaderLevel(this.state.turnPlayerIndex, 1);
                this.state.phase = Phase.DRAW;
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
            z.hasActivatedEffectThisTurn = false; // Reset activation limit
        });

        this.state.turnPlayerIndex = this.state.turnPlayerIndex === 0 ? 1 : 0;
        this.state.turnCount++;
        this.state.phase = Phase.LEVEL_UP;
    }

    public addLeaderLevel(playerIndex: number, amount: number) {
        const player = this.state.players[playerIndex];
        if (player.leaderLevel < 10) {
            player.leaderLevel = Math.min(10, player.leaderLevel + amount);
            console.log(`${player.name} level increased to ${player.leaderLevel}`);
            this.checkAwakening(playerIndex);
        }
    }

    public checkAwakening(playerIndex: number) {
        const player = this.state.players[playerIndex];
        if (player.levelZone && !player.levelZone.isAwakened) {
            const leader = player.levelZone;
            if (leader.effects) {
                const awakenEffect = leader.effects.find(e => e.activation === ActivationCondition.AWAKEN);
                if (awakenEffect) {
                    const context = {
                        player: player,
                        opponent: this.state.players[playerIndex === 0 ? 1 : 0],
                        sourceCard: leader,
                        machine: this
                    };
                    if (this.effectManager.checkCondition(awakenEffect, context)) {
                        this.awakenLeader(playerIndex);
                    }
                }
            }
        }
    }

    private awakenLeader(playerIndex: number) {
        const player = this.state.players[playerIndex];
        if (player.levelZone) {
            player.levelZone.isAwakened = true;
            console.log(`Leader ${player.levelZone.name} AWAKENED!`);
        }
    }

    // Actions
    playUnit(cardIndex: number, zoneIndex: number) {
        const validation = RuleValidator.canPlayUnit(this, this.currentPlayer, cardIndex, zoneIndex);
        if (!validation.valid) {
            console.log(`Cannot place unit: ${validation.reason}`);
            return;
        }

        const card = this.currentPlayer.hand[cardIndex];
        const zone = this.currentPlayer.unitZones[zoneIndex];
        let isUpgrade = false;

        if (zone.unit) {
            isUpgrade = true;
            // Trash existing unit and items
            this.currentPlayer.trash.push(zone.unit);
            zone.items.forEach(i => this.currentPlayer.trash.push(i));
            zone.items = [];
            zone.buffs = []; // Clear buffs on old unit
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
        const validation = RuleValidator.canPlaySkill(this, this.currentPlayer, cardIndex);
        if (!validation.valid) {
            console.log(`Cannot play skill: ${validation.reason}`);
            return;
        }

        const card = this.currentPlayer.hand[cardIndex];

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

    playItem(cardIndex: number, zoneIndex: number) {
        const validation = RuleValidator.canPlayItem(this, this.currentPlayer, cardIndex, zoneIndex);
        if (!validation.valid) {
            console.log(`Cannot play item: ${validation.reason}`);
            return;
        }

        const card = this.currentPlayer.hand[cardIndex];
        const zone = this.currentPlayer.unitZones[zoneIndex];

        // Move from Hand to Unit Zone Items
        this.currentPlayer.hand.splice(cardIndex, 1);
        zone.items.push(card);

        console.log(`Equipped ${card.name} to unit in zone ${zoneIndex}`);
    }

    activateEffect(zoneIndex: number, effectIndex: number) {
        const zone = this.currentPlayer.unitZones[zoneIndex];
        const card = zone.unit;
        if (!card || !card.effects || zone.hasActivatedEffectThisTurn) return;

        const effect = card.effects[effectIndex];
        if (effect.activation !== ActivationCondition.ACTIVE) return;

        const context = {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: zone,
            machine: this
        };

        if (this.effectManager.processEffect(effect, context)) {
            zone.hasActivatedEffectThisTurn = true;
        }
    }

    // checkPotentialTargets moved to RuleValidator

    initiateCostSelection(effect: any, context: any) {
        this.state.interactionMode = 'SELECT_COST';
        this.state.pendingEffect = {
            sourceCard: context.sourceCard,
            sourcePlayerId: context.player.id,
            actionType: effect.action.type,
            actionValue: effect.action.params,
            costToPay: effect.cost
        };
        (this.state.pendingEffect as any)._fullEffect = effect;
        (this.state.pendingEffect as any)._context = context;

        console.log("Entered Cost Selection Mode for " + context.sourceCard.name);
    }

    selectCost(handIndex: number) {
        if (this.state.interactionMode !== 'SELECT_COST' || !this.state.pendingEffect) return;
        const pending = this.state.pendingEffect as any;
        const costType = pending.costToPay?.type;

        // Execute Cost
        if (costType === 'TRASH_HAND') {
            const discarded = this.currentPlayer.hand.splice(handIndex, 1)[0];
            this.currentPlayer.trash.push(discarded);
            console.log(`Paid cost: Trashed ${discarded.name}`);
        } else if (costType === 'SHUFFLE_HAND_TO_DECK') {
            const card = this.currentPlayer.hand.splice(handIndex, 1)[0];
            this.currentPlayer.deck.push(card);
            this.shuffle(this.currentPlayer.deck);
            console.log(`Paid cost: Shuffled ${card.name} into deck`);
        }

        // Resume Effect Execution
        const effect = pending._fullEffect;
        const context = pending._context;
        context.costPaid = true; // Mark as paid to avoid loop

        // Reset State BEFORE processing effect (in case effect enters selection mode)
        this.state.interactionMode = 'NORMAL';
        this.state.pendingEffect = null;

        this.effectManager.processEffect(effect, context);
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
        const validation = RuleValidator.canAttack(this, this.currentPlayer, attackerZoneIndex);
        if (!validation.valid) {
            console.log(`Cannot attack: ${validation.reason}`);
            return;
        }

        const attackerZone = this.currentPlayer.unitZones[attackerZoneIndex];
        attackerZone.hasAttacked = true;

        // Trigger Attacker Effects (Unit + Items)
        this.effectManager.processEffects(ActivationCondition.ATTACKER, {
            sourceCard: attackerZone.unit,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: attackerZone,
            machine: this
        });

        attackerZone.items.forEach(item => {
            this.effectManager.processEffects(ActivationCondition.ATTACKER, {
                sourceCard: item,
                player: this.currentPlayer,
                opponent: this.opponentPlayer,
                unitZone: attackerZone,
                machine: this
            });
        });

        // Lane Alignment: In mirrored layout, Lane 0 faces Lane 0
        const blockerZoneIndex = attackerZoneIndex;
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        // DUALIST logic check (Rule 10.2.3.5)
        const isDualist = attackerZone.unit && this.hasKeyword(attackerZone.unit, 'DUALIST');

        if (blockerZone.unit) {
            // Encounter Unit exists -> Go to BLOCK phase
            this.state.phase = Phase.BLOCK;
            this.state.pendingAttackerIndex = attackerZoneIndex;

            // If Dualist, automatically resolve block if encounter unit exists? 
            // Rules say "must defend if possible". Usually this means the opponent choice is forced.
            // For now, let's keep it in BLOCK phase but we could flag it as forced.
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

        // CHECK BREAKTHROUGH
        if (shouldBlock && blockerZone.unit && attackerZone.unit && attackerZone.unit.effects) {
            const breakthroughEffect = attackerZone.unit.effects.find(e =>
                e.activation === ActivationCondition.ATTACKER && e.action.type === 'BREAKTHROUGH'
            );
            if (breakthroughEffect) {
                const costMax = breakthroughEffect.action.params.costMax;
                if (costMax !== undefined && blockerZone.unit.cost <= costMax) {
                    console.log(`Block prevented by BREAKTHROUGH (Cost ${blockerZone.unit.cost} <= ${costMax})`);
                    shouldBlock = false; // Force no block
                }
            }
        }

        // DUALIST (Rule 10.2.3.5.3): Must defend if encounter unit exists and can defend.
        const isDualist = attackerZone.unit && this.hasKeyword(attackerZone.unit, 'DUALIST');
        let finalShouldBlock = shouldBlock;
        if (isDualist && blockerZone.unit) {
            finalShouldBlock = true; // Forced block
        }

        if (finalShouldBlock && blockerZone.unit) {
            // Trigger Defender Effects (Unit + Items)
            this.effectManager.processEffects(ActivationCondition.DEFENDER, {
                sourceCard: blockerZone.unit,
                player: this.opponentPlayer,
                opponent: this.currentPlayer,
                unitZone: blockerZone,
                machine: this
            });

            blockerZone.items.forEach(item => {
                this.effectManager.processEffects(ActivationCondition.DEFENDER, {
                    sourceCard: item,
                    player: this.opponentPlayer,
                    opponent: this.currentPlayer,
                    unitZone: blockerZone,
                    machine: this
                });
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

            // PENETRATION (Rule 10.2.3.2)
            const penValue = this.getPenetrationValue(attacker);
            if (penValue > 0) {
                this.dealDamage(this.opponentPlayer, penValue);
            }

            // PLUNDER (Rule 10.2.3.3)
            const pluValue = this.getPlunderValue(attacker);
            if (pluValue > 0) {
                this.drawCard(this.state.turnPlayerIndex, pluValue);
            }
        }

        if (blkPower > attPower) {
            this.destroyUnit(this.currentPlayer, attacker);
        }
    }

    private hasKeyword(card: Card, keyword: string): boolean {
        return card.keywords?.includes(keyword) || false;
    }

    private getPenetrationValue(zone: UnitZoneState): number {
        if (!zone.unit) return 0;
        let value = 0;

        // 1. Static Keywords (e.g., Penetration[3] in text usually means Hit value damage, but cards like ST01-011 say Penetration[1])
        // The parser usually puts keywords like "PENETRATION" if it's there.
        // If it's a keyword from the card JSON, we need to know its value.
        // For now, let's check buffs first as ST01-011 uses an effect.
        if (this.hasKeyword(zone.unit, 'PENETRATION')) {
            value = Math.max(value, zone.unit.hit || 0);
        }

        // 2. Buffs (from effects)
        zone.buffs.forEach(b => {
            if (b.type === 'PENETRATION') value = Math.max(value, b.value);
        });

        return value;
    }

    private getPlunderValue(zone: UnitZoneState): number {
        if (!zone.unit) return 0;
        let value = 0;

        if (this.hasKeyword(zone.unit, 'PLUNDER')) value = Math.max(value, 1);

        zone.buffs.forEach(b => {
            if (b.type === 'PLUNDER') value = Math.max(value, b.value);
        });

        return value;
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

    public checkRuleProcessing() {
        this.state.players.forEach(player => {
            player.unitZones.forEach((zone, idx) => {
                if (zone.unit) {
                    const power = this.getUnitPower(zone, player);
                    if (power <= 0) {
                        console.log(`Rule Processing: Trashing ${zone.unit.name} due to 0 or less ATK (${power})`);
                        this.destroyUnit(player, zone);
                    }
                }
            });
        });
    }

    public dealDamage(player: PlayerState, amount: number) {
        console.log(`Dealing ${amount} damage to ${player.name}`);
        let damageRemaining = amount;

        while (damageRemaining > 0) {
            // 4.5.4.1. decrement damage
            damageRemaining--;

            // 4.5.4.3. Check deck
            if (player.deck.length === 0) {
                this.state.winner = this.opponentPlayer.id;
                return;
            }

            // 4.5.4.2. Reveal card and move to damage zone
            const card = player.deck.pop()!;
            player.damage.push(card);

            // 4.5.4.3. Check for Damage Triggers
            const wasTriggered = this.effectManager.processEffects(ActivationCondition.DAMAGE_TRIGGER, {
                sourceCard: card,
                player: player,
                opponent: this.state.players.find(p => p.id !== player.id),
                machine: this
            });

            if (wasTriggered) {
                console.log("TRIGGER ACTIVATED! Remaining damage cancelled.");
                damageRemaining = 0; // 4.5.4.3.1. Set remaining damage to 0
            }

            // 4.5.4.4. Defeat check
            if (player.damage.length >= 10) {
                this.state.winner = this.opponentPlayer.id;
                return;
            }
        }
    }

    public getPlayerSize(player: PlayerState): number {
        let size = player.leaderLevel + player.damage.length;

        // Leader Passive Size Bonus (e.g. ST02-001)
        if (player.levelZone && player.levelZone.effects) {
            player.levelZone.effects.forEach(effect => {
                if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'MODIFY_PLAYER_SIZE') {
                    // Check awakening condition if applicable
                    let conditionMet = true;
                    if (player.levelZone?.isAwakened) {
                        // For ST02-001, the bonus is on the awakened side
                        size += (effect.action.params.value || 0);
                    }
                }
            });
        }

        return size;
    }

    public getUnitPower(zone: UnitZoneState, player: PlayerState): number {
        if (!zone.unit) return 0;
        let power = zone.unit.power || 0;

        // 1. Buffs (Temporary effects like Noir, Besti, etc.)
        zone.buffs.forEach(buff => {
            if (buff.type === 'POWER') {
                power += buff.value;
            }
        });

        // 2. Global Passive Effects (Field-wide or Leader effects)
        const allPotentialSources: { card: Card, zone?: UnitZoneState, owner: PlayerState }[] = [];

        // Add all units on field
        this.state.players.forEach(p => {
            p.unitZones.forEach(z => {
                if (z.unit) allPotentialSources.push({ card: z.unit, zone: z, owner: p });
                z.items.forEach(item => allPotentialSources.push({ card: item, zone: z, owner: p }));
            });
            if (p.levelZone) allPotentialSources.push({ card: p.levelZone, owner: p });
        });

        allPotentialSources.forEach(source => {
            if (source.card.effects) {
                source.card.effects.forEach(effect => {
                    if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'BUFF_POWER') {
                        const context: GameContext = {
                            player: source.owner,
                            opponent: this.state.players.find(p => p !== source.owner)!,
                            sourceCard: source.card,
                            unitZone: source.zone,
                            machine: this
                        };

                        // Check condition
                        if (!this.effectManager.checkCondition(effect, context)) return;

                        // NEW: Check if leader passive requires awakening
                        if (source.card.type === CardType.LEADER && !source.card.isAwakened) {
                            // If it mentions "각성" in description, it probably requires awakening
                            if (effect.description.includes('각성')) return;
                        }

                        // Check if this effect targets the zone we are calculating power for
                        if (TargetSelector.isValidTarget(this, effect.targets!, context, zone)) {
                            const params = effect.action.params || {};
                            let value = params.value || 0;
                            if (params.dynamic === 'LEADER_LEVEL_MULTIPLIER') {
                                value = source.owner.leaderLevel * value;
                            }
                            power += value;
                        }
                    }
                });
            }
        });

        return power;
    }

    public getUnitHit(zone: UnitZoneState, player: PlayerState): number {
        if (!zone.unit) return 0;
        let hit = zone.unit.hit || 0;

        // 1. Buffs
        zone.buffs.forEach(buff => {
            if (buff.type === 'HIT') {
                hit += buff.value;
            }
        });

        // 2. Global Passive Effects
        const allPotentialSources: { card: Card, zone?: UnitZoneState, owner: PlayerState }[] = [];
        this.state.players.forEach(p => {
            p.unitZones.forEach(z => {
                if (z.unit) allPotentialSources.push({ card: z.unit, zone: z, owner: p });
                z.items.forEach(item => allPotentialSources.push({ card: item, zone: z, owner: p }));
            });
            if (p.levelZone) allPotentialSources.push({ card: p.levelZone, owner: p });
        });

        allPotentialSources.forEach(source => {
            if (source.card.effects) {
                source.card.effects.forEach(effect => {
                    if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'BUFF_HIT') {
                        const context: GameContext = {
                            player: source.owner,
                            opponent: this.state.players.find(p => p !== source.owner)!,
                            sourceCard: source.card,
                            unitZone: source.zone,
                            machine: this
                        };

                        if (!this.effectManager.checkCondition(effect, context)) return;

                        if (TargetSelector.isValidTarget(this, effect.targets!, context, zone)) {
                            const params = effect.action.params || {};
                            hit += (params.value || 0);
                        }
                    }
                });
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

        // UI renders opponent at the top (isOpponentZone=true) and currentPlayer at the bottom (isOpponentZone=false)
        const targetPlayer = isOpponentZone ? this.opponentPlayer : this.currentPlayer;
        const targetZone = targetPlayer.unitZones[zoneIndex];
        const scope = effect.targets?.scope;

        // NEW: Full validation using TargetSelector
        if (!TargetSelector.isValidTarget(this, effect.targets, context, targetZone)) {
            console.log("Invalid Target Selected. Mode maintained.");
            return;
        }

        // Shared Lane validation (extra layer for clarity, though isValidTarget covers it)
        if (scope === 'SHARED_LANE') {
            const myUnit = this.currentPlayer.unitZones[zoneIndex].unit;
            const oppUnit = this.opponentPlayer.unitZones[zoneIndex].unit;
            if (!myUnit || !oppUnit) {
                console.log("Invalid Target: Lane is not shared.");
                return;
            }
        }


        // If everything good, execute
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
