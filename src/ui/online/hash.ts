import type { GameEngine } from '../../logic/GameEngine';

function fnv1a32(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeStateHash(engine: GameEngine): string {
    const serialized = JSON.stringify(engine.getSerializableState());
    return fnv1a32(serialized);
}
