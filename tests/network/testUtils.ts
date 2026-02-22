// @vitest-environment node
import { afterEach, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { createRelayServer } from '../../server/index';
import type { ClientToServerMessage, ServerToClientMessage } from '../../src/shared/onlineProtocol';

export interface TestClient {
    ws: WebSocket;
    received: ServerToClientMessage[];
}

interface RelayContext {
    port: number;
    url: string;
    close: () => Promise<void>;
}

let relay: RelayContext | null = null;

function randomPort(): number {
    return 20000 + Math.floor(Math.random() * 20000);
}

export async function bootRelay(): Promise<RelayContext> {
    const port = randomPort();
    const server = createRelayServer(port);
    return {
        port,
        url: `ws://127.0.0.1:${port}`,
        close: async () => {
            server.clients.forEach((client) => {
                try {
                    client.terminate();
                } catch {
                    // ignore teardown errors
                }
            });
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        },
    };
}

export async function connectClient(url: string): Promise<TestClient> {
    const ws = new WebSocket(url);
    const received: ServerToClientMessage[] = [];

    ws.on('message', (raw) => {
        received.push(JSON.parse(String(raw)) as ServerToClientMessage);
    });

    await new Promise<void>((resolve, reject) => {
        ws.once('open', () => resolve());
        ws.once('error', (error) => reject(error));
    });

    return { ws, received };
}

export function sendMessage(client: TestClient, message: ClientToServerMessage): void {
    client.ws.send(JSON.stringify(message));
}

export async function waitForMessage(
    client: TestClient,
    predicate: (message: ServerToClientMessage) => boolean,
    timeoutMs: number = 2000,
): Promise<ServerToClientMessage> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const found = client.received.find(predicate);
        if (found) return found;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for message');
}

export async function closeClient(client: TestClient): Promise<void> {
    await new Promise<void>((resolve) => {
        client.ws.once('close', () => resolve());
        client.ws.close();
    });
}

export function makeValidDeck(revision: number = 1, name: string = 'Deck'): ClientToServerMessage & { type: 'UPDATE_DECK' } {
    return {
        type: 'UPDATE_DECK',
        deck: {
            deckId: `deck-${revision}`,
            deckName: name,
            leaderId: 'ST01-001',
            cardIds: Array.from({ length: 40 }).map((_, index) => `ST01-${String(index + 1).padStart(3, '0')}`),
            revision,
        },
    };
}

beforeEach(async () => {
    relay = await bootRelay();
});

afterEach(async () => {
    if (relay) {
        await relay.close();
        relay = null;
    }
});

export function getRelay(): RelayContext {
    if (!relay) {
        throw new Error('Relay not initialized');
    }
    return relay;
}
