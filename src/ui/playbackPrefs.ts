export type PlaybackSpeedPreference = 'SLOW' | 'NORMAL' | 'FAST';

export interface PlaybackPrefs {
    animationEnabled: boolean;
    speed: PlaybackSpeedPreference;
}

export const PLAYBACK_PREFS_STORAGE_KEY = 'nivelarena.playbackPrefs.v1';

function canUseStorage(): boolean {
    try {
        return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
        return false;
    }
}

export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

export function getDefaultPlaybackPrefs(): PlaybackPrefs {
    return {
        animationEnabled: !prefersReducedMotion(),
        speed: 'NORMAL',
    };
}

export function loadPlaybackPrefs(): PlaybackPrefs {
    const defaults = getDefaultPlaybackPrefs();
    if (!canUseStorage()) return defaults;

    try {
        const raw = window.localStorage.getItem(PLAYBACK_PREFS_STORAGE_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw) as Partial<PlaybackPrefs> | null;
        if (!parsed || typeof parsed !== 'object') return defaults;
        const speed = parsed.speed === 'SLOW' || parsed.speed === 'FAST' || parsed.speed === 'NORMAL'
            ? parsed.speed
            : defaults.speed;
        const animationEnabled = typeof parsed.animationEnabled === 'boolean'
            ? parsed.animationEnabled
            : defaults.animationEnabled;
        return {
            animationEnabled,
            speed,
        };
    } catch {
        return defaults;
    }
}

export function persistPlaybackPrefs(prefs: PlaybackPrefs): void {
    if (!canUseStorage()) return;
    try {
        window.localStorage.setItem(PLAYBACK_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // Ignore preference persistence failures.
    }
}
