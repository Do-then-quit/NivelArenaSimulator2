type StorageLike = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
    key: (index: number) => string | null;
    length: number;
};

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

function installStorage(target: object, storage: StorageLike): void {
    Object.defineProperty(target, 'localStorage', {
        value: storage,
        configurable: true,
        writable: true
    });
}

const storage = createMemoryStorage();
installStorage(globalThis, storage);

if (typeof window !== 'undefined') {
    installStorage(window, storage);
}
