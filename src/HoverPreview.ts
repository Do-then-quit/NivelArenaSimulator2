import { Card, CardType } from './logic/types';

export class HoverPreview {
    private tooltipElement: HTMLElement;

    constructor() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'hover-preview-tooltip';
        this.tooltipElement.style.display = 'none';
        this.tooltipElement.style.position = 'fixed';
        this.tooltipElement.style.zIndex = '3000';
        this.tooltipElement.style.pointerEvents = 'none'; // Ensure it doesn't block mouse events
        document.body.appendChild(this.tooltipElement);
    }

    show(card: Card, x: number, y: number) {
        const isUnit = card.type === CardType.UNIT;
        const formattedText = this.formatEffectText(card.text);

        this.tooltipElement.innerHTML = `
            <div class="preview-content">
                ${card.imageUrl ? `<img src="${card.imageUrl}" class="preview-image">` : ''}
                <div class="preview-info">
                    <div class="preview-name">${card.name}</div>
                    <div class="preview-traits">${card.traits || ''}</div>
                    <div class="preview-stats">
                        <span>Cost: ${card.cost}</span>
                        ${isUnit ? `<span>ATK: ${card.power}</span> <span>HIT: ${card.hit}</span>` : ''}
                    </div>
                    <div class="preview-text">${formattedText}</div>
                </div>
            </div>
        `;

        this.tooltipElement.style.display = 'block';

        // Initial positioning
        this.updatePosition(x, y);
    }

    hide() {
        this.tooltipElement.style.display = 'none';
    }

    move(x: number, y: number) {
        if (this.tooltipElement.style.display === 'none') return;
        this.updatePosition(x, y);
    }

    private formatEffectText(text: string): string {
        if (!text) return '';
        // Match words inside square brackets [Keyword]
        return text.replace(/\[([^\]]+)\]/g, '<span class="keyword">[$1]</span>');
    }

    private updatePosition(x: number, y: number) {
        // Offset from cursor
        const offsetX = 20;
        const offsetY = 20;

        let left = x + offsetX;
        let top = y + offsetY;

        const tooltipWidth = this.tooltipElement.offsetWidth || 320;
        const tooltipHeight = this.tooltipElement.offsetHeight || 400;

        // Check right edge
        if (left + tooltipWidth > window.innerWidth) {
            left = x - tooltipWidth - offsetX;
        }

        // Check bottom edge
        if (top + tooltipHeight > window.innerHeight) {
            top = y - tooltipHeight - offsetY;
        }

        // Ensure it doesn't go off the left or top edges
        left = Math.max(10, left);
        top = Math.max(10, top);

        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.style.top = `${top}px`;
    }
}
