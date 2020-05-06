import { EventEmitter } from 'events';

export type Message = { type: string; [key: string]: any };
export type MessageEvent = { data: any };

export interface Socket {
    send(data: string): void;
    close(code?: number, reason?: string): void;

    addEventListener(event: string, listener: (event: any) => void): void;
    removeEventListener(event: string, listener: (event: any) => void): void;
}

export default class Messaging extends EventEmitter {
    readonly messages = new EventEmitter();
    readonly socket: Socket;

    constructor(socket: Socket) {
        super();
        this.socket = socket;

        this.socket.addEventListener('open', () => this.emit('open'));

        this.socket.addEventListener('message', (event: MessageEvent) => {
            const { type, ...message } = JSON.parse(event.data) as Message;
            this.messages.emit(type, message);
        });
    }

    send(type: string, message: object) {
        const data = JSON.stringify({ type, ...message });
        this.socket.send(data);
    }
}
