import Messaging from './messaging';

export type AssignMessage = { userId: string };
export type RejectMessage = { text: string };

export interface ZoneClient {
    expect(type: 'assign', timeout?: number): Promise<AssignMessage>;
    expect(type: 'reject', timeout?: number): Promise<RejectMessage>;
}

export class ZoneClient {
    readonly messaging: Messaging;
    
    constructor(messaging: Messaging) {
        this.messaging = messaging;
    }

    async expect(type: string, timeout?: number) {
        return new Promise((resolve, reject) => {
            if (timeout) setTimeout(() => reject('timeout'), timeout);
            this.messaging.messages.once(type, (message) => resolve(message));
        });
    }

    async join(name: string, token?: string) {
        return new Promise((resolve, reject) => {
            this.expect('assign', 500).then(resolve).catch(reject);
            this.expect('reject', 500).then(reject).catch();
            this.messaging.send('join', {name, token});
        });
    }
}

export default ZoneClient;
