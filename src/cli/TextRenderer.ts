import { GameState, PlayerState, Phase, Card } from '../logic/types';
import { GameEngine } from '../logic/GameEngine';

export class TextRenderer {
    render(engine: GameEngine): string {
        const state = engine.state;
        const p1 = state.players[0];
        const p2 = state.players[1];
        const currentPlayer = engine.currentPlayer;
        const opponentPlayer = engine.opponentPlayer;

        let output = '\n' + '='.repeat(60) + '\n';
        output += ` Turn: ${state.turnCount} | Phase: ${state.phase} | Active: ${currentPlayer.name}\n`;
        output += '='.repeat(60) + '\n\n';

        // Opponent Field (Top) - Inverted visual order could be nice, but simple list is fine
        output += this.renderPlayerField(opponentPlayer, 'Opponent');
        output += '\n' + '-'.repeat(60) + '\n';

        // Player Field (Bottom)
        output += this.renderPlayerField(currentPlayer, 'You');

        output += '\n' + '='.repeat(60) + '\n';
        output += ` Hand [${currentPlayer.hand.length}]:\n`;
        currentPlayer.hand.forEach((card, idx) => {
            output += `  [${idx}] ${this.formatCard(card)}\n`;
        });

        output += '\n';

        // Interaction Prompt
        if (state.interactionMode !== 'NORMAL') {
            output += ` *** ACTION REQUIRED (${state.interactionMode}) ***\n`;
            if (state.pendingEffect) {
                const pending = state.pendingEffect;
                output += ` Effect: ${pending.sourceCard.name} -> ${pending.actionType}\n`;
                if (state.interactionMode === 'SELECT_COST') {
                    output += ` Cost: ${JSON.stringify(pending.costToPay)} (Paid: ${pending.costPaidCount || 0})\n`;
                }
                if (state.interactionMode === 'SELECT_TARGET') {
                    output += ` Targets: ${JSON.stringify(pending.validTargets)}\n`;
                }
            }
            output += ` command > select <indices...>\n`;
        } else {
            output += ` command > `;
        }

        return output;
    }

    private renderPlayerField(player: PlayerState, label: string): string {
        let out = ` [${label}] ${player.name} (Lv.${player.leaderLevel}, Life: ${player.damage.length}/7)\n`;

        // Unit Zones
        out += `  Units:\n`;
        player.unitZones.forEach((zone, idx) => {
            const status = [];
            if (zone.isExhausted) status.push('EXH');
            if (zone.hasAttacked) status.push('ATK');

            const unitStr = zone.unit
                ? `${this.formatCard(zone.unit)} [BP:${zone.unit.power}] <${status.join(',')}>`
                : '(Empty)';

            out += `    Zone ${idx}: ${unitStr}\n`;
            if (zone.items.length > 0) {
                out += `      Items: ${zone.items.map(i => i.name).join(', ')}\n`;
            }
        });

        // Skill Zone
        if (player.skillZone.length > 0) {
            out += `  Skills: ${player.skillZone.map(c => c.name).join(', ')}\n`;
        }

        return out;
    }

    private formatCard(card: Card): string {
        return `[${card.id}] ${card.name} (${card.cost})`;
    }
}
