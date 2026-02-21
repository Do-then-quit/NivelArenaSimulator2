import { PlayerState, Phase, CardType, ActivationCondition } from './types';
import { GameEngine } from './GameEngine';
import { TargetSelector } from './TargetSelector';

type ValidationResult = { valid: boolean; reason?: string };

export class RuleValidator {
    static canPlayUnit(engine: GameEngine, player: PlayerState, cardIndex: number, zoneIndex: number): { valid: boolean; reason?: string } {
        if (engine.state.phase !== Phase.MAIN) return { valid: false, reason: "Not in MAIN phase" };

        const card = player.hand[cardIndex];
        if (!card || card.type !== CardType.UNIT) return { valid: false, reason: "Card is not a unit" };

        const zone = player.unitZones[zoneIndex];

        // 6.4.1.1.3 Check if unit was already placed in this zone this turn
        if (zone.hasPlacedUnitThisTurn) {
            return { valid: false, reason: "Already placed in this zone this turn" };
        }

        // Logic check: 3.5.5 - Cannot place if existing unit has higher/equal cost (unless upgrading)
        if (zone.unit && card.cost <= zone.unit.cost) {
            return { valid: false, reason: "Cost must be higher than existing unit to upgrade" };
        }

        let costToSubtract = 0;
        if (zone.unit) {
            // Upgrade rule
            costToSubtract = zone.unit.cost + zone.items.reduce((sum, item) => sum + item.cost, 0);
        }

        const currentSize = engine.getPlayerSize(player);
        const currentFieldCost = this.calculateFieldCost(player);

        if (currentFieldCost - costToSubtract + card.cost > currentSize) {
            return { valid: false, reason: "Cost exceeds Size limit" };
        }

        return { valid: true };
    }

    static canPlaySkill(engine: GameEngine, player: PlayerState, cardIndex: number): ValidationResult {
        if (engine.state.phase !== Phase.MAIN) return { valid: false, reason: "Not in MAIN phase" };
        const card = player.hand[cardIndex];
        if (!card || card.type !== CardType.SKILL) return { valid: false, reason: "Card is not a skill" };

        const lockedSkillIds = (player as any).lockedSkillIdsUntilTurnEnd as Record<string, boolean> | undefined;
        if (lockedSkillIds?.[card.id]) {
            return { valid: false, reason: "Skill is locked until end of turn" };
        }

        // Size Limit Check (Field Cost + Skill Cost must not exceed Size)
        const playerSize = engine.getPlayerSize(player);
        const currentFieldCost = this.calculateFieldCost(player);
        if (currentFieldCost + card.cost > playerSize) {
            return { valid: false, reason: `Cost exceeds Size limit (Field: ${currentFieldCost}, Skill: ${card.cost}, Size: ${playerSize})` };
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

        const zone = player.unitZones[zoneIndex];
        if (!zone.unit) return { valid: false, reason: "Target zone has no unit" };

        // Size Limit Check
        const currentSize = engine.getPlayerSize(player);
        const currentFieldCost = this.calculateFieldCost(player);

        if (currentFieldCost + card.cost > currentSize) {
            return { valid: false, reason: "Cost exceeds Size limit" };
        }

        // Equipment Requirement Check: Items with COST_COMPARISON passive effects
        if (card.effects) {
            for (const effect of card.effects) {
                if (effect.activation === ActivationCondition.PASSIVE && effect.condition?.type === 'COST_COMPARISON') {
                    const val = effect.condition.value;
                    if (val && val.operator === 'GTE' && zone.unit.cost < val.cost) {
                        return { valid: false, reason: `Requires unit cost ${val.cost} or higher` };
                    }
                    if (val && val.operator === 'LTE' && zone.unit.cost > val.cost) {
                        return { valid: false, reason: `Requires unit cost ${val.cost} or lower` };
                    }
                }

                if (effect.activation === ActivationCondition.PASSIVE && effect.condition?.type === 'HAS_KEYWORD') {
                    const requiredKeyword = typeof effect.condition.value === 'string'
                        ? effect.condition.value
                        : effect.condition.value?.keyword;
                    if (requiredKeyword && !this.cardHasKeyword(zone.unit, requiredKeyword)) {
                        return { valid: false, reason: `Requires unit keyword ${requiredKeyword}` };
                    }
                }

                if (effect.activation === ActivationCondition.PASSIVE && effect.condition?.type === 'HAS_TRAIT') {
                    const requiredTrait = typeof effect.condition.value === 'string'
                        ? effect.condition.value
                        : effect.condition.value?.trait;
                    if (requiredTrait && !zone.unit.traits?.includes(requiredTrait)) {
                        return { valid: false, reason: `Requires unit trait ${requiredTrait}` };
                    }
                }
            }
        }

        return { valid: true };
    }

    static canAttack(engine: GameEngine, player: PlayerState, zoneIndex: number): { valid: boolean; reason?: string } {
        if (engine.state.phase !== Phase.ATTACK) return { valid: false, reason: "Not in ATTACK phase" };

        const zone = player.unitZones[zoneIndex];
        if (!zone.unit) return { valid: false, reason: "No unit in zone" };
        if (zone.isExhausted) return { valid: false, reason: "Unit is exhausted" };

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

    private static calculateFieldCost(player: PlayerState): number {
        let cost = 0;
        player.unitZones.forEach(z => {
            if (z.unit) cost += z.unit.cost;
            z.items.forEach(i => cost += i.cost);
        });
        player.skillZone.forEach(s => cost += s.cost);
        return cost;
    }

    private static cardHasKeyword(card: any, keyword: string): boolean {
        if (!card) return false;
        if (card.keywords?.includes(keyword)) return true;
        if (card.effects?.some((effect: any) => (effect.description || '').includes(keyword))) return true;
        return false;
    }

    private static zoneHasKeyword(engine: GameEngine, zone: any, keyword: string): boolean {
        if (!zone || !zone.unit) return false;
        if (this.cardHasKeyword(zone.unit, keyword) || this.cardHasKeyword(zone.unit, 'BERSERK')) return true;
        if (Array.isArray(zone.items) && zone.items.some((item: any) => this.cardHasKeyword(item, keyword) || this.cardHasKeyword(item, 'BERSERK'))) return true;
        if (Array.isArray(zone.temporaryEffects) && zone.temporaryEffects.some((effect: any) => (effect.description || '').includes(keyword) || (effect.description || '').includes('BERSERK'))) return true;

        const allSources: Array<{ owner: PlayerState; zone: any; card: any }> = [];
        engine.state.players.forEach(sourceOwner => {
            sourceOwner.unitZones.forEach(sourceZone => {
                if (sourceZone.unit) allSources.push({ owner: sourceOwner, zone: sourceZone, card: sourceZone.unit });
                sourceZone.items.forEach((item: any) => allSources.push({ owner: sourceOwner, zone: sourceZone, card: item }));
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
                const grantedText = granted.description || '';
                if (!grantedText.includes(keyword) && !grantedText.includes('BERSERK')) return false;

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
}
