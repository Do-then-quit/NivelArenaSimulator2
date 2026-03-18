import { EngineAction } from '../types';

export type StableActionValue = string | number | boolean | null;

export interface StableEncodedAction {
    type: EngineAction['type'];
    key: string;
    payload: Record<string, StableActionValue>;
}

function normalizeActionValue(value: unknown): StableActionValue {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return JSON.stringify(value);
}

export function toStableActionPayload(action: EngineAction): Record<string, StableActionValue> {
    const payload: Record<string, StableActionValue> = {};
    for (const [key, value] of Object.entries(action).sort(([left], [right]) => left.localeCompare(right))) {
        if (key === 'type') continue;
        payload[key] = normalizeActionValue(value);
    }
    return payload;
}

export function toStableActionKey(action: EngineAction): string {
    const payload = Object.entries(toStableActionPayload(action))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join('|');
    return `${action.type}|${payload}`;
}

export function encodeStableAction(action: EngineAction): StableEncodedAction {
    return {
        type: action.type,
        key: toStableActionKey(action),
        payload: toStableActionPayload(action),
    };
}
