import Messaging from './messaging';
import { QueueItem } from '../server/playback'; 

export type AssignMessage = { userId: string, token: string };
export type RejectMessage = { text: string };
export type UsersMessage = { users: any[] };
export type NameMessage = { userId: string, name: string };
export type LeaveMessage = { userId: string };
export type PlayMessage = { item: QueueItem; time: number };

export interface ZoneClient {
    expect(type: 'assign', timeout?: number): Promise<AssignMessage>;
    expect(type: 'reject', timeout?: number): Promise<RejectMessage>;
    expect(type: 'users', timeout?: number): Promise<UsersMessage>;
    expect(type: 'name', timeout?: number): Promise<NameMessage>;
    expect(type: 'leave', timeout?: number): Promise<LeaveMessage>;
    expect(type: 'play', timeout?: number): Promise<PlayMessage>;
}

export class ZoneClient {
    readonly messaging: Messaging;
    
    constructor(messaging: Messaging) {
        this.messaging = messaging;
    }

    expect(type: string, timeout?: number) {
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
