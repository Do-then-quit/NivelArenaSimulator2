
import { Card } from './logic/types';
import { HoverPreview } from './HoverPreview';

interface TrashHoverOverlayOptions {
    interactive?: boolean;
    selectableIndexes?: Set<number>;
    selectedIndexes?: Set<number>;
    onCardSelect?: (index: number) => void;
}

const TOUCH_LONG_PRESS_MS = 350;
const TOUCH_LONG_PRESS_MOVE_THRESHOLD_PX = 16;

export class TrashHoverOverlay {
    private element: HTMLElement;
    private titleElement: HTMLElement;
    private gridElement: HTMLElement;
    private hoverPreview: HoverPreview;
    private supportsMouseHoverPreview: boolean;
    private hideTimeout: number | null = null;
    private activeAnchorElement: HTMLElement | null = null;

    constructor(hoverPreview: HoverPreview) {
        this.hoverPreview = hoverPreview;
        this.supportsMouseHoverPreview = (() => {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
            try {
                return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
            } catch {
                return true;
            }
        })();

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

    show(
        cards: Card[],
        anchorElement: HTMLElement,
        isOpponent: boolean,
        renderCardFn: (c: Card, small: boolean, p?: number, h?: number) => string,
        zoneLabel: string = 'Trash',
        options?: TrashHoverOverlayOptions,
    ) {
        this.cancelHide();
        const interactive = options?.interactive === true;
        const selectableIndexes = options?.selectableIndexes ?? new Set<number>();
        const selectedIndexes = options?.selectedIndexes ?? new Set<number>();
        const onCardSelect = options?.onCardSelect;

        this.titleElement.textContent = `${isOpponent ? 'Opponent' : 'Your'} ${zoneLabel} (${cards.length})`;
        this.setActiveAnchor(anchorElement);

        if (cards.length === 0) {
            this.gridElement.innerHTML = '<div style="color: #666; font-style: italic; padding: 20px; grid-column: 1/-1; text-align: center;">Empty</div>';
        } else {
            this.gridElement.innerHTML = cards.map((c, i) => `
                <div class="trash-hover-card ${this.buildCardClass(i, interactive, selectableIndexes, selectedIndexes)}" data-index="${i}">
                    ${renderCardFn(c, true)}
                </div>
            `).join('');
        }

        // Attach hover listeners to new cards
        const cardElements = this.gridElement.querySelectorAll('.trash-hover-card');
        cardElements.forEach((el) => {
            let pressTimer: number | null = null;
            let longPressActive = false;
            let activePointerId: number | null = null;
            let originX = 0;
            let originY = 0;
            let suppressNextClick = false;

            const clearPressTimer = () => {
                if (pressTimer === null) return;
                window.clearTimeout(pressTimer);
                pressTimer = null;
            };
            const stopLongPress = (consumeClick: boolean) => {
                clearPressTimer();
                if (longPressActive) {
                    this.hoverPreview.hide();
                    suppressNextClick = consumeClick;
                }
                longPressActive = false;
                activePointerId = null;
            };

            if (this.supportsMouseHoverPreview) {
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
            }
            el.addEventListener('pointerdown', (event: Event) => {
                const e = event as PointerEvent;
                if (e.pointerType === 'mouse') return;
                const index = parseInt((el as HTMLElement).dataset.index || '-1', 10);
                if (index < 0) return;
                const card = cards[index];
                if (!card) return;
                activePointerId = e.pointerId;
                originX = e.clientX;
                originY = e.clientY;
                suppressNextClick = false;
                longPressActive = false;
                clearPressTimer();
                pressTimer = window.setTimeout(() => {
                    longPressActive = true;
                    this.hoverPreview.show(card, originX, originY);
                }, TOUCH_LONG_PRESS_MS);
            });
            el.addEventListener('pointermove', (event: Event) => {
                const e = event as PointerEvent;
                if (activePointerId === null || e.pointerId !== activePointerId || e.pointerType === 'mouse') return;
                if (!longPressActive) {
                    const movedX = e.clientX - originX;
                    const movedY = e.clientY - originY;
                    if (Math.hypot(movedX, movedY) > TOUCH_LONG_PRESS_MOVE_THRESHOLD_PX) {
                        stopLongPress(false);
                    }
                    return;
                }
                const index = parseInt((el as HTMLElement).dataset.index || '-1', 10);
                if (index < 0) return;
                const card = cards[index];
                if (!card) return;
                this.hoverPreview.show(card, e.clientX, e.clientY);
            });
            el.addEventListener('pointerup', (event: Event) => {
                const e = event as PointerEvent;
                if (activePointerId === null || e.pointerId !== activePointerId || e.pointerType === 'mouse') return;
                stopLongPress(true);
            });
            el.addEventListener('pointercancel', () => stopLongPress(false));
            el.addEventListener('contextmenu', (event: Event) => {
                if (this.supportsMouseHoverPreview) return;
                (event as MouseEvent).preventDefault();
            });
            if (interactive) {
                el.addEventListener('click', () => {
                    if (suppressNextClick) {
                        suppressNextClick = false;
                        return;
                    }
                    const index = parseInt((el as HTMLElement).dataset.index || '-1', 10);
                    if (index < 0) return;
                    if (selectableIndexes.size > 0 && !selectableIndexes.has(index)) return;
                    onCardSelect?.(index);
                });
            } else {
                el.addEventListener('click', () => {
                    suppressNextClick = false;
                });
            }
        });

        this.element.classList.add('active');
        this.updatePosition(anchorElement);
    }

    hide() {

        this.element.classList.remove('active');
        this.hoverPreview.hide();
        this.clearActiveAnchor();
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

    private buildCardClass(
        index: number,
        interactive: boolean,
        selectableIndexes: Set<number>,
        selectedIndexes: Set<number>,
    ): string {
        if (!interactive) return '';
        const isSelected = selectedIndexes.has(index);
        const isSelectable = selectableIndexes.size === 0 || selectableIndexes.has(index);
        if (isSelected) return 'overlay-card-selected';
        if (isSelectable) return 'overlay-card-selectable';
        return 'overlay-card-disabled';
    }

    private setActiveAnchor(anchorElement: HTMLElement) {
        if (this.activeAnchorElement && this.activeAnchorElement !== anchorElement) {
            this.activeAnchorElement.classList.remove('selection-zone-active');
        }
        this.activeAnchorElement = anchorElement;
        this.activeAnchorElement.classList.add('selection-zone-active');
    }

    private clearActiveAnchor() {
        if (!this.activeAnchorElement) return;
        this.activeAnchorElement.classList.remove('selection-zone-active');
        this.activeAnchorElement = null;
    }
}
