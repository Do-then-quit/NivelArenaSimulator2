import { describe, expect, it } from 'vitest';
import { encodeStableAction, toStableActionKey, toStableActionPayload } from '../../src/logic/ai/StableActionCodec';
import { EngineAction } from '../../src/logic/types';

describe('StableActionCodec', () => {
    it('builds a canonical key and payload for engine actions', () => {
        const action: EngineAction = {
            type: 'PLAY_UNIT',
            zoneIndex: 2,
            handIndex: 5,
            actorPlayerId: 'player-a',
        };

        const key = toStableActionKey(action);
        const payload = toStableActionPayload(action);
        const encoded = encodeStableAction(action);

        expect(key).toBe('PLAY_UNIT|actorPlayerId=player-a|handIndex=5|zoneIndex=2');
        expect(payload).toEqual({
            actorPlayerId: 'player-a',
            handIndex: 5,
            zoneIndex: 2,
        });
        expect(encoded).toEqual({
            type: 'PLAY_UNIT',
            key,
            payload,
        });
    });
});
