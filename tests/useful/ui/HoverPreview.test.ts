import { describe, it, expect, beforeEach } from 'vitest';
import { HoverPreview } from '../../../src/HoverPreview';
import { Card, CardType, Attribute } from '../../../src/logic/types';

describe('HoverPreview', () => {
    let hoverPreview: HoverPreview;
    const dummyCard: Card = {
        id: 'test-card',
        name: 'Test Card',
        type: CardType.UNIT,
        attribute: Attribute.FIRE,
        cost: 3,
        power: 3000,
        hit: 1,
        text: 'Test effect text',
        imageUrl: 'test.jpg'
    };

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        hoverPreview = new HoverPreview();
    });

    it('should create a tooltip element in the DOM', () => {
        const tooltip = document.querySelector('.hover-preview-tooltip');
        expect(tooltip).toBeTruthy();
    });

    it('should show the tooltip with card information and traits', () => {
        const traitCard: Card = {
            ...dummyCard,
            traits: 'Base / Effect'
        };
        hoverPreview.show(traitCard, 100, 200);
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;
        expect(tooltip.style.display).toBe('block');
        expect(tooltip.innerHTML).toContain('Test Card');
        expect(tooltip.innerHTML).toContain('3000');
        expect(tooltip.innerHTML).toContain('Base / Effect');
    });

    it('should hide the tooltip', () => {
        hoverPreview.show(dummyCard, 100, 200);
        hoverPreview.hide();
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;
        expect(tooltip.style.display).toBe('none');
    });

    it('should adjust position to stay within viewport', () => {
        // Mock viewport size
        window.innerWidth = 1000;
        window.innerHeight = 800;
        
        // Tooltip size is roughly 320x400 (just guessing for the test)
        // Set fixed dimensions for test consistency
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;
        Object.defineProperty(tooltip, 'offsetWidth', { value: 320 });
        Object.defineProperty(tooltip, 'offsetHeight', { value: 400 });

        // Hover near right edge
        hoverPreview.show(dummyCard, 900, 100);
        expect(parseInt(tooltip.style.left)).toBeLessThan(900); // Should flip to left of cursor

        // Hover near bottom edge
        hoverPreview.show(dummyCard, 100, 700);
        expect(parseInt(tooltip.style.top)).toBeLessThan(700); // Should flip to above cursor
    });

    it('should highlight keywords in effect text', () => {
        const keywordCard: Card = {
            ...dummyCard,
            text: 'This card has [Penetration] and [Dualist].'
        };
        hoverPreview.show(keywordCard, 100, 200);
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;
        expect(tooltip.innerHTML).toContain('<span class="keyword">[Penetration]</span>');
        expect(tooltip.innerHTML).toContain('<span class="keyword">[Dualist]</span>');
    });

    it('should hide the tooltip on global dismiss events', () => {
        hoverPreview.show(dummyCard, 100, 200);
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;
        expect(tooltip.style.display).toBe('block');

        window.dispatchEvent(new Event('resize'));
        expect(tooltip.style.display).toBe('none');

        hoverPreview.show(dummyCard, 120, 240);
        expect(tooltip.style.display).toBe('block');

        window.dispatchEvent(new Event('blur'));
        expect(tooltip.style.display).toBe('none');
    });
});
