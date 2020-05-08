import Messaging from './messaging';
import { QueueItem } from '../server/playback';
import { EventEmitter } from 'events';

export type JoinMessage = { name: string; token?: string; password?: string };
export type AssignMessage = { userId: string; token: string };
export type RejectMessage = { text: string };
export type UsersMessage = { users: any[] };
export type NameMessage = { userId: string; name: string };
export type LeaveMessage = { userId: string };
export type PlayMessage = { item: QueueItem; time: number };
export type QueueMessage = { items: QueueItem[] };
export type SearchMessage = { query: string };
export type ChatMessage = { text: string };
export type MoveMessage = { position: number[] };
export type EmotesMessage = { emotes: string[] };
export type AvatarMessage = { data: string };

export interface MessageMap {
    heartbeat: {};
    assign: AssignMessage;
    reject: RejectMessage;
    users: UsersMessage;
    leave: LeaveMessage;
    play: PlayMessage;
    queue: QueueMessage;
    search: SearchMessage;

    chat: ChatMessage;
    name: NameMessage;
    move: MoveMessage;
    emotes: EmotesMessage;
    avatar: AvatarMessage;
}

export class ZoneClient extends EventEmitter {
    readonly messaging = new Messaging();
    private assignation?: AssignMessage;

    constructor() {
        super();
        this.addStandardListeners();
    }

    get localUserId() {
        return this.assignation?.userId;
    }

    expect<K extends keyof MessageMap>(type: K, timeout?: number): Promise<MessageMap[K]> {
        return new Promise((resolve, reject) => {
            if (timeout) setTimeout(() => reject('timeout'), timeout);
            this.messaging.messages.once(type, (message) => resolve(message));
        });
    }

    join(options: JoinMessage) {
        options.token = options.token || this.assignation?.token;

        return new Promise<AssignMessage>((resolve, reject) => {
            this.expect('assign', 500).then(resolve, reject);
            this.expect('reject').then(reject);
            this.messaging.send('join', options);
        }).then((assign) => {
            this.assignation = assign;
            return assign;
        });
    }

    private addStandardListeners() {
        this.messaging.on('error', (error) => console.log('hmm', error));
    }
}

export default ZoneClient;
