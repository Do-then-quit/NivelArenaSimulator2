import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPlaybackMotionOverlay, playActionFxBeat } from '../../src/ui/playbackMotion';

function attachAnchor(anchorKey: string, rect: { left: number; top: number; width: number; height: number }): HTMLElement {
    const element = document.createElement('div');
    element.dataset.actionAnchorKey = anchorKey;
    Object.defineProperty(element, 'getBoundingClientRect', {
        value: () => ({
            ...rect,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height,
            x: rect.left,
            y: rect.top,
            toJSON: () => rect,
        }),
    });
    document.body.appendChild(element);
    return element;
}

describe('playback motion overlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        clearPlaybackMotionOverlay();
        vi.useRealTimers();
    });

    it('renders action overlay accents and clears highlight classes after the beat', () => {
        const sourceElement = attachAnchor('action:unit-zone:P1:0', { left: 24, top: 32, width: 88, height: 128 });
        const targetElement = attachAnchor('action:unit-zone:P2:0', { left: 320, top: 36, width: 88, height: 128 });

        const started = playActionFxBeat({
            id: 'fx-attack',
            kind: 'ATTACK',
            label: 'ATTACK',
            sourceAnchorKeys: ['action:unit-zone:P1:0'],
            targetAnchorKeys: ['action:unit-zone:P2:0'],
            emphasisAnchorKeys: ['action:unit-zone:P1:0', 'action:unit-zone:P2:0'],
            sourceRect: null,
            targetRect: null,
        }, 240);

        expect(started).toBe(true);
        expect(sourceElement.classList.contains('fx-action-source')).toBe(true);
        expect(sourceElement.classList.contains('fx-action-kind-attack')).toBe(true);
        expect(targetElement.classList.contains('fx-action-target')).toBe(true);
        expect(targetElement.classList.contains('fx-action-kind-attack')).toBe(true);
        expect(document.querySelector('.fx-action-shell.is-attack')).toBeTruthy();
        expect(document.querySelector('.fx-action-impact')).toBeTruthy();
        expect(document.querySelector('.fx-action-arrowhead')).toBeTruthy();

        vi.advanceTimersByTime(400);

        expect(sourceElement.classList.contains('fx-action-source')).toBe(false);
        expect(sourceElement.classList.contains('fx-action-kind-attack')).toBe(false);
        expect(targetElement.classList.contains('fx-action-target')).toBe(false);
        expect(targetElement.classList.contains('fx-action-kind-attack')).toBe(false);
        expect(document.querySelector('.fx-action-shell')).toBeNull();
    });
});
