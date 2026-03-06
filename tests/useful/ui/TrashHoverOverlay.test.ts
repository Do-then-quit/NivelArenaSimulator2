import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverPreview } from '../../../src/HoverPreview';
import { TrashHoverOverlay } from '../../../src/TrashHoverOverlay';

function createCard(id: string, name: string) {
    return {
        id,
        name,
        type: 'UNIT',
        attribute: 'FIRE',
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '[Test] effect',
    } as any;
}

function dispatchPointerEvent(
    target: EventTarget,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    extras: Record<string, unknown>,
) {
    const event = new Event(type, { bubbles: true, cancelable: true }) as any;
    Object.assign(event, extras);
    target.dispatchEvent(event);
}

describe('TrashHoverOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="app"></div><div id="anchor-a" data-player="current"></div><div id="anchor-b" data-player="opponent"></div>';
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: !query.includes('hover: hover'),
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('moves active anchor highlight and clears it on hide/global dismiss', () => {
        const preview = new HoverPreview();
        const overlay = new TrashHoverOverlay(preview);
        const anchorA = document.getElementById('anchor-a') as HTMLElement;
        const anchorB = document.getElementById('anchor-b') as HTMLElement;
        const cards = [createCard('trash-1', 'Trash One')];

        overlay.show(cards, anchorA, false, () => '<div class="card">A</div>');
        expect(anchorA.classList.contains('selection-zone-active')).toBe(true);
        expect(anchorB.classList.contains('selection-zone-active')).toBe(false);

        overlay.show(cards, anchorB, true, () => '<div class="card">B</div>');
        expect(anchorA.classList.contains('selection-zone-active')).toBe(false);
        expect(anchorB.classList.contains('selection-zone-active')).toBe(true);

        window.dispatchEvent(new Event('resize'));
        expect(overlay.isActive()).toBe(false);
        expect(anchorA.classList.contains('selection-zone-active')).toBe(false);
        expect(anchorB.classList.contains('selection-zone-active')).toBe(false);
    });

    it('suppresses the first click after touch long-press and clears preview on outside release', () => {
        const preview = new HoverPreview();
        const overlay = new TrashHoverOverlay(preview);
        const anchorA = document.getElementById('anchor-a') as HTMLElement;
        const cards = [createCard('trash-1', 'Trash One')];
        const onCardSelect = vi.fn();

        overlay.show(cards, anchorA, false, () => '<div class="card">A</div>', 'Trash', {
            interactive: true,
            selectableIndexes: new Set([0]),
            onCardSelect,
        });

        const card = document.querySelector('.trash-hover-card[data-index="0"]') as HTMLElement;
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;

        dispatchPointerEvent(card, 'pointerdown', { pointerId: 9, pointerType: 'touch', clientX: 120, clientY: 180 });
        vi.advanceTimersByTime(360);
        expect(tooltip.style.display).toBe('block');

        dispatchPointerEvent(window, 'pointerup', { pointerId: 9, pointerType: 'touch', clientX: 480, clientY: 620 });
        expect(tooltip.style.display).toBe('none');

        card.click();
        expect(onCardSelect).not.toHaveBeenCalled();

        card.click();
        expect(onCardSelect).toHaveBeenCalledWith(0);
    });

    it('prevents context menu on overlay cards in non-hover mobile environments', () => {
        const preview = new HoverPreview();
        const overlay = new TrashHoverOverlay(preview);
        const anchorA = document.getElementById('anchor-a') as HTMLElement;
        const cards = [createCard('trash-1', 'Trash One')];

        overlay.show(cards, anchorA, false, () => '<div class="card">A</div>');

        const card = document.querySelector('.trash-hover-card[data-index="0"]') as HTMLElement;
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        card.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
    });
});
