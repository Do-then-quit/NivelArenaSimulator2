import type { ClientToServerMessage, ServerToClientMessage } from '../../shared/onlineProtocol';

type MessageHandler = (message: ServerToClientMessage) => void;
type VoidHandler = () => void;
type ErrorHandler = (error: string) => void;

export class OnlineClient {
    private socket: WebSocket | null = null;
    private readonly url: string;
    private messageHandler: MessageHandler | null = null;
    private openHandler: VoidHandler | null = null;
    private closeHandler: VoidHandler | null = null;
    private errorHandler: ErrorHandler | null = null;

    constructor(url: string) {
        this.url = url;
    }

    public isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    public onMessage(handler: MessageHandler): void {
        this.messageHandler = handler;
    }

    public onOpen(handler: VoidHandler): void {
        this.openHandler = handler;
    }

    public onClose(handler: VoidHandler): void {
        this.closeHandler = handler;
    }

    public onError(handler: ErrorHandler): void {
        this.errorHandler = handler;
    }

    public connect(): void {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const socket = new WebSocket(this.url);
        this.socket = socket;

        socket.addEventListener('open', () => {
            this.openHandler?.();
        });

        socket.addEventListener('close', () => {
            this.closeHandler?.();
            if (this.socket === socket) {
                this.socket = null;
            }
        });

        socket.addEventListener('error', () => {
            this.errorHandler?.('WebSocket connection error');
        });

        socket.addEventListener('message', (event) => {
            try {
                const parsed = JSON.parse(String(event.data)) as ServerToClientMessage;
                this.messageHandler?.(parsed);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.errorHandler?.(`Invalid server message: ${message}`);
            }
        });
    }

    public disconnect(): void {
        if (!this.socket) return;
        this.socket.close();
        this.socket = null;
    }

    public send(message: ClientToServerMessage): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.errorHandler?.('Socket is not connected.');
            return false;
        }
        this.socket.send(JSON.stringify(message));
        return true;
    }
}
