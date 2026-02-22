import { GameEngine } from '../logic/GameEngine';
import { GameState, Phase } from '../logic/types';

export type GameLogLevel = 'INFO' | 'WARN' | 'ERROR';
export type GameLogCategory = 'ACTION' | 'PHASE' | 'COMBAT' | 'EFFECT' | 'TARGET' | 'RULE' | 'SYSTEM';

export interface GameLogEntry {
    id: string;
    createdAtMs: number;
    level: GameLogLevel;
    category: GameLogCategory;
    message: string;
    source: string;
    turnCount: number | null;
    phase: Phase | null;
    interactionMode: GameState['interactionMode'] | null;
}

export interface GameLogFeed {
    startConsoleCapture(getEngine: () => GameEngine | null): void;
    stopConsoleCapture(): void;
    getEntries(): GameLogEntry[];
    clear(): void;
    pushUiLog(message: string, category: GameLogCategory, level?: GameLogLevel): void;
}

type ConsoleMethodName = 'log' | 'warn' | 'error';

interface ConsolePatchState {
    originalLog: Console['log'];
    originalWarn: Console['warn'];
    originalError: Console['error'];
}

function createLogId(counter: number): string {
    return `glog_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function safeStringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (value === null || value === undefined) return String(value);
    if (value instanceof Error) {
        return value.stack || value.message || String(value);
    }
    try {
        const seen = new WeakSet<object>();
        return JSON.stringify(value, (_key, nested) => {
            if (typeof nested === 'object' && nested !== null) {
                if (seen.has(nested)) return '[Circular]';
                seen.add(nested);
            }
            return nested;
        });
    } catch {
        return String(value);
    }
}

function formatConsoleArgs(args: unknown[]): string {
    if (args.length === 0) return '';
    return args.map(arg => safeStringify(arg)).join(' ');
}

function classifyCategory(message: string): GameLogCategory {
    const lower = message.toLowerCase();

    if (
        lower.includes('entering phase') ||
        lower.includes('resolving end phase') ||
        lower.includes('phase:')
    ) {
        return 'PHASE';
    }

    if (
        lower.includes('[effectmanager]') ||
        lower.includes('executing effect:') ||
        lower.includes('optional effect') ||
        lower.includes('trigger activated')
    ) {
        return 'EFFECT';
    }

    if (
        lower.includes('invalid target') ||
        lower.includes('select target') ||
        lower.includes('target added') ||
        lower.includes('target removed') ||
        lower.includes('revealed')
    ) {
        return 'TARGET';
    }

    if (
        lower.includes('combat') ||
        lower.includes('attack') ||
        lower.includes('block') ||
        lower.includes('damage') ||
        lower.includes('destroy') ||
        lower.includes('trash')
    ) {
        return 'COMBAT';
    }

    if (
        lower.includes('rule ') ||
        lower.includes('[rule ') ||
        lower.includes('cannot play') ||
        lower.includes('cannot attack')
    ) {
        return 'RULE';
    }

    return 'SYSTEM';
}

function mapConsoleMethodToLevel(method: ConsoleMethodName): GameLogLevel {
    if (method === 'warn') return 'WARN';
    if (method === 'error') return 'ERROR';
    return 'INFO';
}

export function createGameLogFeed(maxEntries = 500): GameLogFeed {
    const entries: GameLogEntry[] = [];
    const capacity = Number.isFinite(maxEntries) && maxEntries > 0 ? Math.trunc(maxEntries) : 500;

    let idCounter = 0;
    let patchState: ConsolePatchState | null = null;
    let captureEnabled = false;
    let isForwarding = false;
    let getEngineRef: (() => GameEngine | null) | null = null;

    const pushEntry = (
        message: string,
        level: GameLogLevel,
        category: GameLogCategory,
        source: string,
    ) => {
        const engine = getEngineRef?.() ?? null;
        const entry: GameLogEntry = {
            id: createLogId(++idCounter),
            createdAtMs: Date.now(),
            level,
            category,
            message,
            source,
            turnCount: engine?.state.turnCount ?? null,
            phase: engine?.state.phase ?? null,
            interactionMode: engine?.state.interactionMode ?? null,
        };
        entries.push(entry);
        if (entries.length > capacity) {
            entries.splice(0, entries.length - capacity);
        }
    };

    const patchConsoleMethod = (method: ConsoleMethodName): Console[ConsoleMethodName] => {
        return (...args: unknown[]) => {
            const currentPatch = patchState;
            if (!currentPatch) return;

            const original = method === 'log'
                ? currentPatch.originalLog
                : method === 'warn'
                    ? currentPatch.originalWarn
                    : currentPatch.originalError;

            original.apply(console, args);

            if (!captureEnabled || isForwarding) return;
            const message = formatConsoleArgs(args);
            try {
                isForwarding = true;
                pushEntry(
                    message,
                    mapConsoleMethodToLevel(method),
                    classifyCategory(message),
                    `console.${method}`,
                );
            } finally {
                isForwarding = false;
            }
        };
    };

    return {
        startConsoleCapture(getEngine: () => GameEngine | null) {
            getEngineRef = getEngine;
            if (captureEnabled && patchState) return;

            patchState = {
                originalLog: console.log,
                originalWarn: console.warn,
                originalError: console.error,
            };
            captureEnabled = true;
            console.log = patchConsoleMethod('log');
            console.warn = patchConsoleMethod('warn');
            console.error = patchConsoleMethod('error');
        },

        stopConsoleCapture() {
            if (!captureEnabled || !patchState) {
                captureEnabled = false;
                return;
            }

            console.log = patchState.originalLog;
            console.warn = patchState.originalWarn;
            console.error = patchState.originalError;
            patchState = null;
            captureEnabled = false;
        },

        getEntries() {
            return [...entries];
        },

        clear() {
            entries.splice(0, entries.length);
        },

        pushUiLog(message: string, category: GameLogCategory, level: GameLogLevel = 'INFO') {
            pushEntry(message, level, category, 'ui');
        },
    };
}
