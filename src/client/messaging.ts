import { sleep } from './utility';
import { EventEmitter } from 'events';

export declare interface WebSocketMessaging {
    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: (code: number) => void): this;
}

export class WebSocketMessaging extends EventEmitter {
    public websocket: WebSocket | undefined = undefined;
    private handlers = new Map<string, (message: any) => void>();

    connect(address: string) {
        this.disconnect();
        this.websocket = new WebSocket(address);
        this.websocket.onopen = (event) => this.onOpen(event);
        this.websocket.onclose = (event) => this.onClose(event);
        this.websocket.onmessage = (event) => this.onMessage(event);
    }

    reconnect() {
        if (!this.websocket) return;
        this.connect(this.websocket.url);
    }

    disconnect() {
        if (!this.websocket) return;
        this.websocket.close(1000);
        this.websocket = undefined;
    }

    async wait() {
        while (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) await sleep(10);
    }

    send(type: string, message: any) {
        message.type = type;
        try {
            this.websocket!.send(JSON.stringify(message));
        } catch (e) {
            console.log("couldn't send", message, e);
        }
    }

    setHandler(type: string, handler: (message: any) => void) {
        this.handlers.set(type, handler);
    }

    onMessage(event: MessageEvent) {
        const message = JSON.parse(event.data);
        const handler = this.handlers.get(message.type);

        if (handler) {
            try {
                handler(message);
            } catch (e) {
                console.log('EXCEPTION HANDLING MESSAGE', message, e);
            }
        } else {
            console.log(`NO HANDLER FOR MESSAGE TYPE ${message.type}`);
        }
    }

    onOpen(event: Event) {
        this.emit('open');
    }

    async onClose(event: CloseEvent) {
        this.emit('close', event.code);
    }
}
