import { PlayerState, Phase, CardType, ActivationCondition } from './types';
import { GameEngine } from './GameEngine';
import { TargetSelector } from './TargetSelector';

type ValidationResult = { valid: boolean; reason?: string };

export class RuleValidator {
    static canPlayUnit(engine: GameEngine, player: PlayerState, cardIndex: number, zoneIndex: number): { valid: boolean; reason?: string } {
        if (engine.state.phase !== Phase.MAIN) return { valid: false, reason: "Not in MAIN phase" };

        const card = player.hand[cardIndex];
        if (!card || card.type !== CardType.UNIT) return { valid: false, reason: "Card is not a unit" };
        const cardCost = engine.getCardCost(card);

        const zone = player.unitZones[zoneIndex];
        const opponent = engine.state.players.find(p => p.id !== player.id);
        if (opponent) {
            const lockedLane = opponent.unitZones[zoneIndex];
            const lockCostMin = this.getPreventOpponentPlayUnitCostMin(engine, opponent, lockedLane);
            const lockCostMax = this.getPreventOpponentPlayUnitCostMax(engine, opponent, lockedLane);
            if (typeof lockCostMin === 'number' && cardCost >= lockCostMin) {
                return { valid: false, reason: `Lane lock: cannot place unit cost ${lockCostMin} or higher in this lane` };
            }
            if (typeof lockCostMax === 'number' && cardCost <= lockCostMax) {
                return { valid: false, reason: `Lane lock: cannot place unit cost ${lockCostMax} or lower in this lane` };
            }
        }

        // 6.4.1.1.3 Check if unit was already placed in this zone this turn
        if (zone.hasPlacedUnitThisTurn) {
            return { valid: false, reason: "Already placed in this zone this turn" };
        }

        // Logic check: 3.5.5 - Cannot place if existing unit has higher/equal cost (unless upgrading)
        if (zone.unit && cardCost <= engine.getCardCost(zone.unit)) {
            return { valid: false, reason: "Cost must be higher than existing unit to upgrade" };
        }

        let costToSubtract = 0;
        if (zone.unit) {
            // Upgrade rule
            costToSubtract = engine.getCardCost(zone.unit) + zone.items.reduce((sum, item) => sum + engine.getCardCost(item), 0);
        }

        const currentSize = engine.getPlayerSize(player);
        const currentFieldCost = this.calculateFieldCost(engine, player);

        if (currentFieldCost - costToSubtract + cardCost > currentSize) {
            return { valid: false, reason: "Cost exceeds Size limit" };
        }

        return { valid: true };
    }

    static canPlaySkill(engine: GameEngine, player: PlayerState, cardIndex: number): ValidationResult {
        if (engine.state.phase !== Phase.MAIN) return { valid: false, reason: "Not in MAIN phase" };
        const card = player.hand[cardIndex];
        if (!card || card.type !== CardType.SKILL) return { valid: false, reason: "Card is not a skill" };
        const cardCost = engine.getCardCost(card);

        const lockedSkillIds = (player as any).lockedSkillIdsUntilTurnEnd as Record<string, boolean> | undefined;
        if (lockedSkillIds?.[card.id]) {
            return { valid: false, reason: "Skill is locked until end of turn" };
        }

        // Size Limit Check (Field Cost + Skill Cost must not exceed Size)
        const playerSize = engine.getPlayerSize(player);
        const currentFieldCost = this.calculateFieldCost(engine, player);
        if (currentFieldCost + cardCost > playerSize) {
            return { valid: false, reason: `Cost exceeds Size limit (Field: ${currentFieldCost}, Skill: ${cardCost}, Size: ${playerSize})` };
        }

        // Check if effect requires a specific card type for cost payment
        if (card.effects) {
            for (const effect of card.effects) {
                if (effect.cost?.type === 'TRASH_HAND' && effect.cost.cardTypeFilter) {
                    const requiredType = effect.cost.cardTypeFilter;
                    // Exclude the skill card itself from the search (it's about to be played)
                    const validCostCards = player.hand.filter((c, idx) => idx !== cardIndex && c.type === requiredType);
                    if (validCostCards.length === 0) {
                        return { valid: false, reason: `No ${requiredType} card in hand to pay cost` };
                    }
                }
            }
        }

        return { valid: true };
    }

    static canPlayItem(engine: GameEngine, player: PlayerState, cardIndex: number, zoneIndex: number): { valid: boolean; reason?: string } {
        if (engine.state.phase !== Phase.MAIN) return { valid: false, reason: "Not in MAIN phase" };

        const card = player.hand[cardIndex];
        if (!card || card.type !== CardType.ITEM) return { valid: false, reason: "Card is not an item" };
        const cardCost = engine.getCardCost(card);

        const zone = player.unitZones[zoneIndex];
        if (!zone.unit) return { valid: false, reason: "Target zone has no unit" };

        // Passive equip restrictions on the equipped unit can block normal PLAY_ITEM.
        const sourceOpponent = engine.state.players.find(p => p.id !== player.id);
        let restrictExternalItemEquip = false;
        let preventDuplicateItemNameOnUnit = false;
        const evaluateRestrictionEffects = (sourceCard: any, effects: any[]) => {
            if (!sourceCard || !Array.isArray(effects)) return;
            effects.forEach((effect: any) => {
                if (!effect || effect.activation !== ActivationCondition.PASSIVE) return;
                if (effect.action?.type !== 'NONE') return;
                const params = effect.action?.params || {};
                if (params.restrictExternalItemEquip !== true && params.preventDuplicateItemNameOnUnit !== true) return;

                const context: any = {
                    player,
                    opponent: sourceOpponent,
                    sourceCard,
                    unitZone: zone,
                    machine: engine,
                };
                if (!engine.effectManager.checkCondition(effect, context)) return;
                if (params.restrictExternalItemEquip === true) restrictExternalItemEquip = true;
                if (params.preventDuplicateItemNameOnUnit === true) preventDuplicateItemNameOnUnit = true;
            });
        };
        evaluateRestrictionEffects(zone.unit, zone.unit.effects || []);
        if (Array.isArray(zone.items)) {
            zone.items.forEach((item: any) => evaluateRestrictionEffects(item, item?.effects || []));
        }
        if (Array.isArray(zone.temporaryEffects)) {
            evaluateRestrictionEffects(zone.unit, zone.temporaryEffects);
        }

        if (restrictExternalItemEquip) {
            return { valid: false, reason: "This unit cannot equip items by external methods" };
        }
        if (preventDuplicateItemNameOnUnit && zone.items.some(item => item?.name === card.name)) {
            return { valid: false, reason: "Cannot equip duplicate item name on this unit" };
        }

        // Size Limit Check
        const currentSize = engine.getPlayerSize(player);
        const currentFieldCost = this.calculateFieldCost(engine, player);

        if (currentFieldCost + cardCost > currentSize) {
            return { valid: false, reason: "Cost exceeds Size limit" };
        }

        return this.validateItemEquipConditions(engine, player, zone, card);
    }

    static validateItemEquipConditions(
        engine: GameEngine,
        player: PlayerState,
        zone: any,
        itemCard: any,
    ): ValidationResult {
        if (!zone?.unit) return { valid: false, reason: "Target zone has no unit" };
        if (!itemCard || itemCard.type !== CardType.ITEM) return { valid: false, reason: "Card is not an item" };

        const sourceOpponent = engine.state.players.find(p => p.id !== player.id);
        if (!sourceOpponent) return { valid: false, reason: "No opponent found" };

        const equipConditionEffects = (itemCard.effects || []).filter((effect: any) => {
            if (!effect || effect.activation !== ActivationCondition.PASSIVE) return false;
            if (effect.action?.type !== 'NONE') return false;

            // Equip-condition lines in card data consistently start with this label.
            const description = String(effect.description || '').replace(/\u00a0/g, ' ').trim();
            return /^장착\s*조건/.test(description) || /^장착조건/.test(description);
        });

        for (const effect of equipConditionEffects) {
            const context: any = {
                player,
                opponent: sourceOpponent,
                sourceCard: itemCard,
                unitZone: zone,
                machine: engine,
            };
            if (!engine.effectManager.checkCondition(effect, context)) {
                return { valid: false, reason: "Equip condition is not satisfied" };
            }
        }

        return { valid: true };
    }

    static canAttack(engine: GameEngine, player: PlayerState, zoneIndex: number): { valid: boolean; reason?: string } {
        if (engine.state.phase !== Phase.ATTACK) return { valid: false, reason: "Not in ATTACK phase" };

        const zone = player.unitZones[zoneIndex];
        if (!zone.unit) return { valid: false, reason: "No unit in zone" };
        if (zone.isExhausted) return { valid: false, reason: "Unit is exhausted" };

        const opponent = engine.state.players.find(p => p.id !== player.id);
        if (opponent) {
            const effectSources: Array<{ effect: any; sourceCard: any }> = [];
            if (zone.unit.effects) {
                zone.unit.effects.forEach(effect => effectSources.push({ effect, sourceCard: zone.unit }));
            }
            zone.items.forEach(item => {
                if (item.effects) {
                    item.effects.forEach(effect => effectSources.push({ effect, sourceCard: item }));
                }
            });
            if (Array.isArray(zone.temporaryEffects)) {
                zone.temporaryEffects.forEach(effect => effectSources.push({ effect, sourceCard: zone.unit }));
            }

            const hasCannotAttackFlag = effectSources.some(({ effect, sourceCard }) => {
                if (!effect || effect.activation !== ActivationCondition.PASSIVE) return false;
                if (effect.action?.type !== 'NONE') return false;
                const params = effect.action?.params || {};
                const hasStaticLock = params.cannotAttack === true;
                const hasTurnCountLock = typeof params.cannotAttackUntilTurnCount === 'number';
                if (!hasStaticLock && !hasTurnCountLock) return false;
                const context: any = {
                    player,
                    opponent,
                    sourceCard,
                    unitZone: zone,
                    machine: engine,
                };
                if (!engine.effectManager.checkCondition(effect, context)) return false;
                if (hasTurnCountLock && engine.state.turnCount > params.cannotAttackUntilTurnCount) return false;
                return true;
            });

            if (hasCannotAttackFlag) return { valid: false, reason: "Unit cannot attack" };
        }

        const attackCount = Math.max(zone.attackCountThisTurn || 0, zone.hasAttacked ? 1 : 0);
        const maxAttackCount = 1 + (zone.extraAttackAllowance || 0);
        if (attackCount >= maxAttackCount) return { valid: false, reason: "Unit already attacked" };

        const attackCostAlreadyPaid = (zone as any)._attackCostPaid === true;
        const attackCostEffect = zone.unit.effects?.find(effect =>
            effect.activation === ActivationCondition.PASSIVE &&
            effect.action?.type === 'NONE' &&
            effect.action?.params?.requiresAttackCost === true &&
            !!effect.cost
        );

        if (!attackCostAlreadyPaid && attackCostEffect?.cost) {
            const requiredAmount = attackCostEffect.cost.amount || 1;
            const costFilter = attackCostEffect.cost.cardTypeFilter;
            const payableCount = player.hand.filter(card => !costFilter || card.type === costFilter).length;
            if (payableCount < requiredAmount) {
                return { valid: false, reason: "Cannot pay attack cost" };
            }
        }

        return { valid: true };
    }

    static canEndPhase(engine: GameEngine, player: PlayerState): ValidationResult {
        if (engine.state.phase === Phase.ATTACK) {
            const hasReadyBerserker = player.unitZones.some(z => {
                if (z.unit && this.zoneHasKeyword(engine, z, '광전사') && !z.hasAttacked && !z.isExhausted) {
                    return true;
                }
                return false;
            });
            if (hasReadyBerserker) {
                return { valid: false, reason: "Must attack with Berserker units first" };
            }
        }
        return { valid: true };
    }

    private static calculateFieldCost(engine: GameEngine, player: PlayerState): number {
        let cost = 0;
        player.unitZones.forEach(z => {
            if (z.unit) cost += engine.getCardCost(z.unit);
            z.items.forEach(i => cost += engine.getCardCost(i));
        });
        player.skillZone.forEach(s => cost += engine.getCardCost(s));
        return cost;
    }

    private static getPreventOpponentPlayUnitCostMin(engine: GameEngine, sourcePlayer: PlayerState, sourceZone: any): number | null {
        if (!sourceZone) return null;
        const sourceOpponent = engine.state.players.find(player => player.id !== sourcePlayer.id);
        if (!sourceOpponent) return null;

        const minValues: number[] = [];
        const evaluateEffectList = (sourceCard: any, effects: any[]) => {
            if (!sourceCard || !Array.isArray(effects)) return;
            effects.forEach((effect: any) => {
                if (!effect || effect.activation !== ActivationCondition.PASSIVE) return;
                if (effect.action?.type !== 'NONE') return;
                const minCost = effect.action?.params?.preventOpponentPlayUnitCostMin;
                if (typeof minCost !== 'number') return;
                const context: any = {
                    player: sourcePlayer,
                    opponent: sourceOpponent,
                    sourceCard,
                    unitZone: sourceZone,
                    machine: engine,
                };
                if (!engine.effectManager.checkCondition(effect, context)) return;
                minValues.push(minCost);
            });
        };

        if (sourceZone.unit) {
            evaluateEffectList(sourceZone.unit, sourceZone.unit.effects || []);
        }
        if (Array.isArray(sourceZone.items)) {
            sourceZone.items.forEach((item: any) => evaluateEffectList(item, item?.effects || []));
        }
        if (Array.isArray(sourceZone.temporaryEffects)) {
            const fallbackCard = sourceZone.unit || sourcePlayer.levelZone || null;
            evaluateEffectList(fallbackCard, sourceZone.temporaryEffects);
        }

        if (minValues.length === 0) return null;
        return Math.min(...minValues);
    }

    private static getPreventOpponentPlayUnitCostMax(engine: GameEngine, sourcePlayer: PlayerState, sourceZone: any): number | null {
        if (!sourceZone) return null;
        const sourceOpponent = engine.state.players.find(player => player.id !== sourcePlayer.id);
        if (!sourceOpponent) return null;

        const maxValues: number[] = [];
        const evaluateEffectList = (sourceCard: any, effects: any[]) => {
            if (!sourceCard || !Array.isArray(effects)) return;
            effects.forEach((effect: any) => {
                if (!effect || effect.activation !== ActivationCondition.PASSIVE) return;
                if (effect.action?.type !== 'NONE') return;
                const maxCost = effect.action?.params?.preventOpponentPlayUnitCostMax;
                if (typeof maxCost !== 'number') return;
                const context: any = {
                    player: sourcePlayer,
                    opponent: sourceOpponent,
                    sourceCard,
                    unitZone: sourceZone,
                    machine: engine,
                };
                if (!engine.effectManager.checkCondition(effect, context)) return;
                maxValues.push(maxCost);
            });
        };

        if (sourceZone.unit) {
            evaluateEffectList(sourceZone.unit, sourceZone.unit.effects || []);
        }
        if (Array.isArray(sourceZone.items)) {
            sourceZone.items.forEach((item: any) => evaluateEffectList(item, item?.effects || []));
        }
        if (Array.isArray(sourceZone.temporaryEffects)) {
            const fallbackCard = sourceZone.unit || sourcePlayer.levelZone || null;
            evaluateEffectList(fallbackCard, sourceZone.temporaryEffects);
        }

        if (maxValues.length === 0) return null;
        return Math.max(...maxValues);
    }

    private static cardHasKeyword(card: any, keyword: string): boolean {
        if (!card) return false;
        const aliases = this.getKeywordAliases(keyword);
        if (Array.isArray(card.keywords) && card.keywords.some((k: string) => aliases.includes(k))) return true;
        if (this.isBerserkKeyword(keyword)) {
            return Array.isArray(card.effects) && card.effects.some((effect: any) => this.effectDirectlyDefinesKeyword(effect, keyword));
        }
        if (card.effects?.some((effect: any) => (effect.description || '').includes(keyword))) return true;
        return false;
    }

    private static zoneHasKeyword(engine: GameEngine, zone: any, keyword: string): boolean {
        if (!zone || !zone.unit) return false;
        if (this.cardHasKeyword(zone.unit, keyword) || this.cardHasKeyword(zone.unit, 'BERSERK')) return true;
        if (Array.isArray(zone.items) && zone.items.some((item: any) => this.cardHasKeyword(item, keyword) || this.cardHasKeyword(item, 'BERSERK'))) return true;
        if (Array.isArray(zone.temporaryEffects) && zone.temporaryEffects.some((effect: any) => this.effectDirectlyDefinesKeyword(effect, keyword) || this.effectDirectlyDefinesKeyword(effect, 'BERSERK'))) return true;

        const allSources: Array<{ owner: PlayerState; zone: any; card: any }> = [];
        engine.state.players.forEach(sourceOwner => {
            sourceOwner.unitZones.forEach(sourceZone => {
                if (sourceZone.unit) allSources.push({ owner: sourceOwner, zone: sourceZone, card: sourceZone.unit });
                sourceZone.items.forEach((item: any) => allSources.push({ owner: sourceOwner, zone: sourceZone, card: item }));
                if (sourceZone.unit && Array.isArray(sourceZone.temporaryEffects)) {
                    sourceZone.temporaryEffects.forEach((effect: any) => {
                        allSources.push({
                            owner: sourceOwner,
                            zone: sourceZone,
                            card: {
                                ...sourceZone.unit!,
                                effects: [effect],
                            },
                        });
                    });
                }
            });
            if (sourceOwner.levelZone) allSources.push({ owner: sourceOwner, zone: null, card: sourceOwner.levelZone });
        });

        return allSources.some(source => {
            if (!source.card?.effects) return false;
            const sourceOpponent = engine.state.players.find(player => player.id !== source.owner.id);
            if (!sourceOpponent) return false;

            return source.card.effects.some((effect: any) => {
                if (effect.activation !== ActivationCondition.PASSIVE) return false;
                if (effect.action?.type !== 'GRANT_EFFECT') return false;
                const granted = effect.action?.params?.effect;
                if (!granted) return false;
                if (
                    !this.effectContainsGrantedKeyword(granted, keyword) &&
                    !this.effectContainsGrantedKeyword(granted, 'BERSERK')
                ) return false;

                const context: any = {
                    player: source.owner,
                    opponent: sourceOpponent,
                    sourceCard: source.card,
                    unitZone: source.zone,
                    machine: engine,
                };
                if (!engine.effectManager.checkCondition(effect, context)) return false;
                if (!effect.targets) return false;
                return TargetSelector.isValidTarget(engine, effect.targets, context, zone);
            });
        });
    }

    private static isBerserkKeyword(keyword: string): boolean {
        return keyword === '광전사' || keyword === 'BERSERK';
    }

    private static getKeywordAliases(keyword: string): string[] {
        if (this.isBerserkKeyword(keyword)) return ['광전사', 'BERSERK'];
        return [keyword];
    }

    private static effectDirectlyDefinesKeyword(effect: any, keyword: string): boolean {
        if (!effect) return false;
        const aliases = this.getKeywordAliases(keyword);
        const paramsKeyword = effect.action?.params?.keyword;
        if (typeof paramsKeyword === 'string' && aliases.includes(paramsKeyword)) return true;

        const normalized = String(effect.description || '').replace(/\u00a0/g, ' ').trim();
        return aliases.some((alias) => {
            const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const labelPattern = new RegExp(`^[\\s「\\[]*${escaped}\\s*:`);
            return labelPattern.test(normalized);
        });
    }

    private static effectContainsGrantedKeyword(effect: any, keyword: string): boolean {
        if (!effect) return false;
        if (this.effectDirectlyDefinesKeyword(effect, keyword)) return true;
        if (effect.action?.type !== 'GRANT_EFFECT') return false;
        return this.effectContainsGrantedKeyword(effect.action?.params?.effect, keyword);
    }
}
