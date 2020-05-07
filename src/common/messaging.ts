import { EventEmitter } from 'events';

export type Message = { type: string; [key: string]: any };
export type MessageEvent = { data: any };

export interface Socket {
    send(data: string): void;
    close(code?: number, reason?: string): void;

    addEventListener(event: string, listener: (event: any) => void): void;
    removeEventListener(event: string, listener: (event: any) => void): void;
}

export interface Messaging {
    on(event: 'open', callback: () => void): this;
    on(event: 'close', callback: (code: number) => void): this;
    on(event: 'error', callback: (error: any) => void): this;
}

export class Messaging extends EventEmitter {
    readonly messages = new EventEmitter();
    readonly socket: Socket;

    constructor(socket: Socket) {
        super();
        this.socket = socket;

        this.socket.addEventListener('open', () => this.emit('open'));
        this.socket.addEventListener('close', (event) => this.emit(event.code || event));

        this.socket.addEventListener('message', (event: MessageEvent) => {
            const { type, ...message } = JSON.parse(event.data) as Message;
            this.messages.emit(type, message);
        });
    }

    setSocket(socket: Socket) {

    }

    close(code: number = 1000) {

    }

    send(type: string, message: object) {
        const data = JSON.stringify({ type, ...message });
        
        try {
            this.socket.send(data);
        } catch (e) {
            this.emit('error', e);
        }
    }
}

export default Messaging;
