import Messaging from './messaging';
import { QueueItem, PlayableMedia, PlayableSource } from '../server/playback';
import { EventEmitter } from 'events';
import { YoutubeVideo } from '../server/youtube';
import { objEqual } from './utility';
import { ZoneState } from './zone';

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

export type SearchResult = { results: YoutubeVideo[] };

function isYoutube(item: PlayableMedia): item is YoutubeVideo {
    return item.source.type === 'youtube';
}

function mediaEquals(a: PlayableMedia, b: PlayableMedia) {
    return objEqual(a.source, b.source);
}

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

export interface ClientOptions {
    quickResponseTimeout: number;
    slowResponseTimeout: number;
}

export const DEFAULT_OPTIONS: ClientOptions = {
    quickResponseTimeout: 1000,
    slowResponseTimeout: 5000,
};

export class ZoneClient extends EventEmitter {
    readonly options: ClientOptions;
    readonly messaging = new Messaging();
    readonly zone = new ZoneState();

    private assignation?: AssignMessage;

    constructor(options: Partial<ClientOptions> = {}) {
        super();
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.addStandardListeners();
    }

    get localUserId() {
        return this.assignation?.userId;
    }

    clear() {
        this.zone.clear();
    }

    async expect<K extends keyof MessageMap>(type: K, timeout?: number): Promise<MessageMap[K]> {
        return new Promise((resolve, reject) => {
            if (timeout) setTimeout(() => reject('timeout'), timeout);
            this.messaging.messages.once(type, (message) => resolve(message));
        });
    }

    async join(options: JoinMessage) {
        options.token = options.token || this.assignation?.token;

        return new Promise<AssignMessage>((resolve, reject) => {
            this.expect('assign', this.options.quickResponseTimeout).then(resolve, reject);
            this.expect('reject').then(reject);
            this.messaging.send('join', options);
        }).then((assign) => {
            this.assignation = assign;
            return assign;
        });
    }

    async heartbeat() {
        return new Promise<{}>((resolve, reject) => {
            this.expect('heartbeat', this.options.quickResponseTimeout).then(resolve, reject);
            this.messaging.send('heartbeat', {});
        });
    }

    async resync() {
        return new Promise<PlayMessage>((resolve, reject) => {
            this.expect('play', this.options.quickResponseTimeout).then(resolve, reject);
            this.messaging.send('resync');
        });
    }

    async search(query: string) {
        return new Promise<SearchResult>((resolve, reject) => {
            this.expect('search', this.options.slowResponseTimeout).then(resolve as any, reject);
            this.messaging.send('search', { query });
        });
    }

    async lucky(query: string) {
        return new Promise<QueueMessage>((resolve, reject) => {
            this.expect('queue', this.options.slowResponseTimeout).then(resolve, reject);
            this.messaging.send('search', { query, lucky: true });
        });
    }

    async youtube(videoId: string) {
        return new Promise<QueueMessage>((resolve, reject) => {
            setTimeout(() => reject('timeout'), this.options.slowResponseTimeout);
            this.messaging.messages.on('queue', (queue: QueueMessage) => {
                const media = queue.items[0].media;
                if (isYoutube(media) && media.source.videoId === videoId) resolve(queue);
            });
            this.messaging.send('youtube', { videoId });
        });
    }

    async skip(password?: string) {
        if (!this.zone.lastPlayedItem) return;

        this.messaging.send('skip', {
            password,
            source: this.zone.lastPlayedItem.media.source,
        });
    }

    async unplayable(source?: PlayableSource) {
        source = source || this.zone.lastPlayedItem?.media.source;
        if (!source) return;
        this.messaging.send('error', { source });
    }

    private addStandardListeners() {
        this.messaging.messages.on('play', (message: PlayMessage) => {
            this.zone.lastPlayedItem = message.item;

            const index = this.zone.queue.findIndex((item) => mediaEquals(item.media, message.item.media));
            if (index >= 0) this.zone.queue.splice(index, 1);
        });
        this.messaging.messages.on('queue', (message: QueueMessage) => {
            this.zone.queue.push(...message.items);
        });
    }
}

export default ZoneClient;
