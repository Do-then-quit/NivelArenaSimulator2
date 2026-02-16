type StorageLike = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
    key: (index: number) => string | null;
    length: number;
};

function isValidStorage(value: unknown): value is StorageLike {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.getItem === 'function' &&
        typeof candidate.setItem === 'function' &&
        typeof candidate.removeItem === 'function' &&
        typeof candidate.clear === 'function' &&
        typeof candidate.key === 'function'
    );
}

function createMemoryStorage(): StorageLike {
    const store = new Map<string, string>();
    return {
        getItem(key: string): string | null {
            return store.has(key) ? store.get(key)! : null;
        },
        setItem(key: string, value: string): void {
            store.set(String(key), String(value));
        },
        removeItem(key: string): void {
            store.delete(key);
        },
        clear(): void {
            store.clear();
        },
        key(index: number): string | null {
            return Array.from(store.keys())[index] ?? null;
        },
        get length(): number {
            return store.size;
        }
    };
}

function readWindowLocalStorage(): unknown {
    try {
        if (typeof window !== 'undefined') {
            return window.localStorage;
        }
    } catch {
        // ignore and fallback
    }
    return undefined;
}

function readGlobalLocalStorage(): unknown {
    try {
        return (globalThis as any).localStorage;
    } catch {
        // ignore and fallback
    }
    return undefined;
}

function installStorage(target: object, storage: StorageLike): void {
    Object.defineProperty(target, 'localStorage', {
        value: storage,
        configurable: true,
        writable: true
    });
}

const windowStorage = readWindowLocalStorage();
const globalStorage = readGlobalLocalStorage();
const storage = isValidStorage(windowStorage)
    ? windowStorage
    : isValidStorage(globalStorage)
        ? globalStorage
        : createMemoryStorage();

if (!isValidStorage(globalStorage)) {
    installStorage(globalThis, storage);
}

if (typeof window !== 'undefined' && !isValidStorage(windowStorage)) {
    installStorage(window, storage);
}
