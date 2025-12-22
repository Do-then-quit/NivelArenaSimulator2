import { GameState, PlayerState, Phase, CardType } from './types';

export class RuleValidator {
    static canPlayUnit(state: GameState, player: PlayerState, cardIndex: number, zoneIndex: number): { valid: boolean; reason?: string } {
        if (state.phase !== Phase.MAIN) return { valid: false, reason: "Not in MAIN phase" };

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

        const currentSize = player.leaderLevel + player.damage.length;
        const currentFieldCost = this.calculateFieldCost(player);

        if (currentFieldCost - costToSubtract + card.cost > currentSize) {
            return { valid: false, reason: "Cost exceeds Size limit" };
        }

        return { valid: true };
    }

    static canPlaySkill(state: GameState, player: PlayerState, cardIndex: number, checkTargets: boolean = true): { valid: boolean; reason?: string } {
        if (state.phase !== Phase.MAIN) return { valid: false, reason: "Not in MAIN phase" };

        const card = player.hand[cardIndex];
        if (!card || card.type !== CardType.SKILL) return { valid: false, reason: "Card is not a skill" };

        const currentSize = player.leaderLevel + player.damage.length;
        const currentFieldCost = this.calculateFieldCost(player);
        if (currentFieldCost + card.cost > currentSize) {
            return { valid: false, reason: "Cost exceeds Size limit" };
        }

        if (checkTargets && card.effects) {
            for (const effect of card.effects) {
                if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                    const hasValidTargets = this.checkPotentialTargets(state, player, effect.targets.scope);
                    if (!hasValidTargets) {
                        return { valid: false, reason: "No valid targets for effect" };
                    }
                }
            }
        }

        return { valid: true };
    }

    static canAttack(state: GameState, player: PlayerState, zoneIndex: number): { valid: boolean; reason?: string } {
        if (state.phase !== Phase.ATTACK) return { valid: false, reason: "Not in ATTACK phase" };

        const zone = player.unitZones[zoneIndex];
        if (!zone.unit) return { valid: false, reason: "No unit in zone" };
        if (zone.hasAttacked) return { valid: false, reason: "Unit already attacked" };
        if (zone.isExhausted) return { valid: false, reason: "Unit is exhausted" };

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

    private static checkPotentialTargets(state: GameState, player: PlayerState, scope: string): boolean {
        const opponent = state.players.find(p => p.id !== player.id);
        if (!opponent) return false;

        switch (scope) {
            case 'MY_FIELD':
                return player.unitZones.some(z => z.unit !== null);
            case 'OPP_FIELD':
                return opponent.unitZones.some(z => z.unit !== null);
            case 'SHARED_LANE':
                for (let i = 0; i < 3; i++) {
                    if (player.unitZones[i].unit && opponent.unitZones[i].unit) return true;
                }
                return false;
            case 'ALL':
            case 'BOTH_FIELDS':
                return player.unitZones.some(z => z.unit !== null) || opponent.unitZones.some(z => z.unit !== null);
            default:
                return true;
        }
    }
}
