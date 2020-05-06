import Messaging, { Socket } from './messaging';
import { QueueItem } from '../server/playback'; 

export type AssignMessage = { userId: string, token: string };
export type RejectMessage = { text: string };
export type UsersMessage = { users: any[] };
export type NameMessage = { userId: string, name: string };
export type LeaveMessage = { userId: string };
export type PlayMessage = { item: QueueItem; time: number };
export type QueueMessage = { items: QueueItem[] };
export type SearchMessage = { query: string };

export interface MessageMap {
    'heartbeat': {};
    'assign': AssignMessage;
    'reject': RejectMessage;
    'users': UsersMessage;
    'leave': LeaveMessage;
    'play': PlayMessage;
    'queue': QueueMessage;
    'search': SearchMessage;

    'chat': any;
    'name': NameMessage;
    'move': any;
    'emotes': any;
    'avatar': any;
}

export class ZoneClient {
    readonly messaging: Messaging;
    
    constructor(messaging: Messaging) {
        this.messaging = messaging;
    }

    expect<K extends keyof MessageMap>(type: K, timeout?: number): Promise<MessageMap[K]> {
        return new Promise((resolve, reject) => {
            if (timeout) setTimeout(() => reject('timeout'), timeout);
            this.messaging.messages.once(type, (message) => resolve(message));
        });
    }

    join(options: { name: string, token?: string, password?: string }) {
        return new Promise<AssignMessage>((resolve, reject) => {
            this.expect('assign', 500).then(resolve, reject);
            this.expect('reject').then(reject);
            this.messaging.send('join', options);
        });
    }
}

export default ZoneClient;
