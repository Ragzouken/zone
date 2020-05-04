import * as WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface Message {
    type: string;
    [key: string]: any;
}

export interface WebSocketMessaging {
    on(event: 'unhandled', callback: (message: Message) => void): this;
}

export class WebSocketMessaging extends EventEmitter {
    private handlers = new Map<string, (message: any) => void>();

    constructor(private websocket: WebSocket) {
        super();
        this.websocket.on('message', (message) => this.onMessage(message));
        this.websocket.on('close', (code, reason) => this.emit('close', code, reason));
    }

    disconnect(code = 1000) {
        this.websocket.removeAllListeners();
        this.websocket.close(code);
    }

    send(type: string, message: any) {
        message.type = type;
        const json = JSON.stringify(message);
        try {
            this.websocket.send(json);
        } catch (e) {
            // console.log("couldn't send:", e);
        }
    }

    setHandler(type: string, handler: (message: Message) => void) {
        this.handlers.set(type, handler);
    }

    onMessage(data: WebSocket.Data) {
        if (typeof data !== 'string') {
            console.log('WEIRD DATA', data);
            return;
        }

        const message = JSON.parse(data);
        const handler = this.handlers.get(message.type);

        if (handler) {
            try {
                handler(message);
            } catch (e) {
                console.log('EXCEPTION HANDLING MESSAGE', message, e);
            }
        } else {
            this.emit('unhandled', message);
        }
    }
}

export default WebSocketMessaging;
