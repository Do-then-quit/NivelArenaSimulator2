
import { Card } from './logic/types';
import { HoverPreview } from './HoverPreview';

export class TrashHoverOverlay {
    private element: HTMLElement;
    private titleElement: HTMLElement;
    private gridElement: HTMLElement;
    private hoverPreview: HoverPreview;
    private hideTimeout: number | null = null;

    constructor(hoverPreview: HoverPreview) {
        this.hoverPreview = hoverPreview;

        this.element = document.createElement('div');
        this.element.className = 'trash-hover-overlay';

        this.titleElement = document.createElement('div');
        this.titleElement.className = 'trash-hover-overlay-title';
        this.element.appendChild(this.titleElement);

        this.gridElement = document.createElement('div');
        this.gridElement.className = 'trash-hover-grid'; // Fixed class name to match CSS
        this.element.appendChild(this.gridElement);

        document.body.appendChild(this.element);

        // Events to keep it open
        this.element.addEventListener('mouseenter', () => {
            this.cancelHide();
        });

        this.element.addEventListener('mouseleave', () => {
            this.hide();
        });
    }

    show(cards: Card[], anchorElement: HTMLElement, isOpponent: boolean, renderCardFn: (c: Card, small: boolean, p?: number, h?: number) => string) {
        this.cancelHide();


        this.titleElement.textContent = `${isOpponent ? "Opponent" : "Your"} Trash (${cards.length})`;

        if (cards.length === 0) {
            this.gridElement.innerHTML = '<div style="color: #666; font-style: italic; padding: 20px; grid-column: 1/-1; text-align: center;">Empty</div>';
        } else {
            this.gridElement.innerHTML = cards.map((c, i) => `
                <div class="trash-hover-card" data-index="${i}">
                    ${renderCardFn(c, true)}
                </div>
            `).join('');
        }

        // Attach hover listeners to new cards
        const cardElements = this.gridElement.querySelectorAll('.trash-hover-card');
        cardElements.forEach((el) => {
            el.addEventListener('mouseenter', (e) => {
                const index = parseInt((el as HTMLElement).dataset.index!);
                this.hoverPreview.show(cards[index], (e as MouseEvent).clientX, (e as MouseEvent).clientY);
            });
            el.addEventListener('mousemove', (e) => {
                const mouseEvent = e as MouseEvent;
                const index = parseInt((el as HTMLElement).dataset.index!);
                this.hoverPreview.show(cards[index], mouseEvent.clientX, mouseEvent.clientY);
            });
            el.addEventListener('mouseleave', () => {
                this.hoverPreview.hide();
            });
        });

        this.element.classList.add('active');
        this.updatePosition(anchorElement);
    }

    hide() {

        this.element.classList.remove('active');
        this.hoverPreview.hide();
    }

    scheduleHide() {
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        this.hideTimeout = window.setTimeout(() => {
            this.hide();
        }, 100);
    }

    cancelHide() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }

    private updatePosition(anchor: HTMLElement) {
        const rect = anchor.getBoundingClientRect();
        // Force a layout reflow/calculation to ensure we get correct dimensions if just made visible
        const overlayRect = this.element.getBoundingClientRect();

        // Initial strategy: Above the anchor, right aligned
        let top = rect.top - overlayRect.height - 10;
        let left = rect.right - overlayRect.width;

        // If top is off-screen (e.g. opponent trash at top), position below
        if (top < 10) {
            top = rect.bottom + 10;
        }

        // Ensure left is on screen
        if (left < 10) {
            left = 10;
        }

        // Update styling
        this.element.style.top = `${top}px`;
        this.element.style.left = `${left}px`;
    }
}
