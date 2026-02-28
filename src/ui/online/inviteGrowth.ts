export type OnlineGrowthEventName = 'share_clicked' | 'invite_accepted';

export interface OnlineGrowthMetrics {
    share_clicked: number;
    invite_accepted: number;
    lastEventAtMs: number | null;
}

interface PersistedOnlineGrowthMetrics extends OnlineGrowthMetrics {
    version: 1;
}

export const INVITE_ROOM_QUERY_PARAM = 'room';

const GROWTH_STORAGE_KEY = 'nivelarena_online_growth_metrics_v1';
const ROOM_CODE_PATTERN = /^\d{6}$/;

function createDefaultMetrics(): OnlineGrowthMetrics {
    return {
        share_clicked: 0,
        invite_accepted: 0,
        lastEventAtMs: null,
    };
}

function normalizeCounter(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
}

function toMetricsRecord(raw: unknown): OnlineGrowthMetrics {
    if (!raw || typeof raw !== 'object') return createDefaultMetrics();
    const candidate = raw as Partial<PersistedOnlineGrowthMetrics>;
    return {
        share_clicked: normalizeCounter(candidate.share_clicked),
        invite_accepted: normalizeCounter(candidate.invite_accepted),
        lastEventAtMs:
            typeof candidate.lastEventAtMs === 'number' && Number.isFinite(candidate.lastEventAtMs)
                ? Math.floor(candidate.lastEventAtMs)
                : null,
    };
}

function loadMetrics(): OnlineGrowthMetrics {
    try {
        const raw = localStorage.getItem(GROWTH_STORAGE_KEY);
        if (!raw) return createDefaultMetrics();
        const parsed = JSON.parse(raw) as unknown;
        return toMetricsRecord(parsed);
    } catch {
        return createDefaultMetrics();
    }
}

function persistMetrics(metrics: OnlineGrowthMetrics): void {
    const payload: PersistedOnlineGrowthMetrics = {
        version: 1,
        ...metrics,
    };

    try {
        localStorage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Ignore storage failures in private mode or quota edge cases.
    }
}

function sanitizeRoomCode(raw: string): string | null {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    return ROOM_CODE_PATTERN.test(digits) ? digits : null;
}

export function getInviteRoomCodeFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return sanitizeRoomCode(parsed.searchParams.get(INVITE_ROOM_QUERY_PARAM) ?? '');
    } catch {
        return null;
    }
}

export function getInviteRoomCodeFromCurrentLocation(): string | null {
    if (typeof window === 'undefined') return null;
    return getInviteRoomCodeFromUrl(window.location.href);
}

export function buildInviteLink(roomCode: string, baseUrl?: string): string {
    const normalized = sanitizeRoomCode(roomCode);
    if (!normalized) {
        throw new Error('Room code must be 6 digits.');
    }

    const href = baseUrl
        ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
    const url = new URL(href);
    url.searchParams.set(INVITE_ROOM_QUERY_PARAM, normalized);
    return url.toString();
}

export function getOnlineGrowthMetrics(): OnlineGrowthMetrics {
    return loadMetrics();
}

export function trackOnlineGrowthEvent(
    eventName: OnlineGrowthEventName,
    metadata: Record<string, string | number | boolean> = {},
): OnlineGrowthMetrics {
    const metrics = loadMetrics();
    metrics[eventName] += 1;
    metrics.lastEventAtMs = Date.now();
    persistMetrics(metrics);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nivelarena:online-growth', {
            detail: {
                eventName,
                metadata,
                atMs: metrics.lastEventAtMs,
            },
        }));
    }

    return metrics;
}
