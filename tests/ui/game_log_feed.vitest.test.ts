import { describe, expect, it } from 'vitest';
import { createGameLogFeed } from '../../src/ui/gameLogFeed';

function createEngineMetaMock() {
    return {
        state: {
            turnCount: 7,
            phase: 'ATTACK',
            interactionMode: 'SELECT_TARGET',
        },
    } as any;
}

describe('game log feed', () => {
    it('captures console log/warn/error levels', () => {
        const feed = createGameLogFeed(50);
        feed.startConsoleCapture(() => createEngineMetaMock());
        try {
            console.log('[feed-level] info');
            console.warn('[feed-level] warn');
            console.error('[feed-level] error');
        } finally {
            feed.stopConsoleCapture();
        }

        const entries = feed.getEntries().filter(entry => entry.message.includes('[feed-level]'));
        expect(entries.map(entry => entry.level)).toEqual(['INFO', 'WARN', 'ERROR']);
    });

    it('classifies major categories from message patterns', () => {
        const feed = createGameLogFeed(50);
        feed.startConsoleCapture(() => createEngineMetaMock());
        try {
            console.log('[cat-phase] Entering Phase: MAIN');
            console.log('[cat-effect] [EffectManager] Added 1 effects to queue');
            console.log('[cat-combat] Combat! Attacker Power: 3000, Blocker Power: 2000');
            console.log('[cat-target] Invalid Target Selected. Mode maintained.');
            console.log('[cat-rule] [Rule 6.6.1.4] hand size adjustment');
        } finally {
            feed.stopConsoleCapture();
        }

        const entries = feed.getEntries();
        expect(entries.find(entry => entry.message.includes('[cat-phase]'))?.category).toBe('PHASE');
        expect(entries.find(entry => entry.message.includes('[cat-effect]'))?.category).toBe('EFFECT');
        expect(entries.find(entry => entry.message.includes('[cat-combat]'))?.category).toBe('COMBAT');
        expect(entries.find(entry => entry.message.includes('[cat-target]'))?.category).toBe('TARGET');
        expect(entries.find(entry => entry.message.includes('[cat-rule]'))?.category).toBe('RULE');
    });

    it('injects engine metadata at capture time', () => {
        const feed = createGameLogFeed(10);
        feed.startConsoleCapture(() => createEngineMetaMock());
        try {
            console.log('[meta-check] message');
        } finally {
            feed.stopConsoleCapture();
        }

        const entry = feed.getEntries().find(candidate => candidate.message.includes('[meta-check]'));
        expect(entry?.turnCount).toBe(7);
        expect(entry?.phase).toBe('ATTACK');
        expect(entry?.interactionMode).toBe('SELECT_TARGET');
    });

    it('applies ring buffer limit and clear/restore behavior', () => {
        const feed = createGameLogFeed(3);
        feed.startConsoleCapture(() => createEngineMetaMock());
        try {
            console.log('[ring] 1');
            console.log('[ring] 2');
            console.log('[ring] 3');
            console.log('[ring] 4');
        } finally {
            feed.stopConsoleCapture();
        }

        const ringEntries = feed.getEntries().filter(entry => entry.message.includes('[ring]'));
        expect(ringEntries.length).toBe(3);
        expect(ringEntries.map(entry => entry.message)).toEqual([
            '[ring] 2',
            '[ring] 3',
            '[ring] 4',
        ]);

        const countBefore = feed.getEntries().length;
        console.log('[ring-after-stop] should not be captured');
        expect(feed.getEntries().length).toBe(countBefore);

        feed.clear();
        expect(feed.getEntries()).toHaveLength(0);
    });
});
