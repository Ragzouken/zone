import Messaging, { Socket } from './messaging';
import { EventEmitter } from 'events';
import { specifically } from './utility';
import { ZoneState, UserState, QueueItem, UserEcho, Media } from './zone';
import fetch, { HeadersInit } from 'node-fetch';
const URL = window?.URL || require('url').URL;

export type StatusMesage = { text: string };
export type JoinMessage = { name: string; token?: string; avatar?: string };
export type RejectMessage = { text: string };
export type UsersMessage = { users: UserState[] };
export type LeaveMessage = { userId: string };
export type PlayMessage = { item: QueueItem; time: number };
export type QueueMessage = { items: QueueItem[] };
export type UnqueueMessage = { itemId: number };

export type SendChat = { text: string };
export type RecvChat = { text: string; userId: string };

export type EchoesMessage = { added?: UserEcho[]; removed?: number[][] };

export type DataMessage = { update: any };

export interface MessageMap {
    heartbeat: {};
    ready: {};
    reject: RejectMessage;
    users: UsersMessage;
    leave: LeaveMessage;
    play: PlayMessage;
    queue: QueueMessage;

    chat: SendChat;
    user: UserState;

    echoes: EchoesMessage;
}

export interface ClientOptions {
    urlRoot: string;
    quickResponseTimeout: number;
    slowResponseTimeout: number;
    joinName?: string;
    createSocket: (ticket: string) => Promise<Socket>;
}

export const DEFAULT_OPTIONS: ClientOptions = {
    urlRoot: '.',
    quickResponseTimeout: 3000,
    slowResponseTimeout: 5000,
    createSocket: () => { throw new Error("not implemented"); },
};

export interface ClientEventMap {
    disconnect: (event: { clean: boolean }) => void;

    chat: (event: { user: UserState; text: string; local: boolean }) => void;
    join: (event: { user: UserState }) => void;
    leave: (event: { user: UserState }) => void;
    rename: (event: { user: UserState; previous: string; local: boolean }) => void;
    status: (event: { text: string }) => void;
    users: (event: {}) => void;

    play: (event: { message: PlayMessage }) => void;
    queue: (event: { item: QueueItem }) => void;
    unqueue: (event: { item: QueueItem }) => void;

    move: (event: { user: UserState; position: number[]; local: boolean }) => void;
    emotes: (event: { user: UserState; emotes: string[]; local: boolean }) => void;
    avatar: (event: { user: UserState; data: string; local: boolean }) => void;
    tags: (event: { user: UserState; tags: string[]; local: boolean }) => void;
}

export interface ZoneClient {
    on<K extends keyof ClientEventMap>(event: K, callback: ClientEventMap[K]): this;
    off<K extends keyof ClientEventMap>(event: K, callback: ClientEventMap[K]): this;
    once<K extends keyof ClientEventMap>(event: K, callback: ClientEventMap[K]): this;
    emit<K extends keyof ClientEventMap>(event: K, ...args: Parameters<ClientEventMap[K]>): boolean;
}

export class ZoneClient extends EventEmitter {
    readonly options: ClientOptions;
    readonly messaging = new Messaging();
    readonly zone = new ZoneState();

    private credentials?: { userId: string, token: string };
    
    constructor(options: Partial<ClientOptions> = {}) {
        super();
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.addStandardListeners();
    }

    get localUserId() {
        return this.credentials?.userId;
    }

    get localUser() {
        return this.zone.users.get(this.localUserId || "");
    }

    clear() {
        this.zone.clear();
        this.credentials = undefined;
    }

    async expect<K extends keyof MessageMap>(type: K, timeout?: number): Promise<MessageMap[K]> {
        return new Promise((resolve, reject) => {
            if (timeout) setTimeout(() => reject('timeout'), timeout);
            this.messaging.messages.once(type, (message) => resolve(message));
        });
    }

    async join({ name = "anonymous", avatar = "" } = {}) {
        this.clear();

        const { ticket, token, userId } = await this.request("POST", "/zone/join", { name, avatar });
        this.credentials = { userId, token };

        const socket = await this.options.createSocket(ticket);
        this.messaging.setSocket(socket);

        return this.expect("ready");
    }

    async heartbeat() {
        return new Promise<{}>((resolve, reject) => {
            this.expect('heartbeat', this.options.quickResponseTimeout).then(resolve, reject);
            this.messaging.send('heartbeat', {});
        });
    }

    async auth(password: string) {
        return this.request("POST", "/admin/authorize", { password });
    }

    async command(name: string, args: any[] = []) {
        return this.request("POST", "/admin/command", { name, args });
    }

    async rename(name: string): Promise<UserState> {
        return new Promise((resolve, reject) => {
            setTimeout(() => reject('timeout'), this.options.quickResponseTimeout);
            specifically(
                this.messaging.messages,
                'user',
                (message: UserState) => message.userId === this.localUserId && message.name === name,
                resolve,
            );
            this.messaging.send('user', { name });
        });
    }

    async chat(text: string) {
        this.messaging.send('chat', { text });
    }

    async move(position: number[]) {
        this.messaging.send('user', { position });
    }

    async avatar(avatar: string) {
        this.messaging.send('user', { avatar });
    }

    async emotes(emotes: string[]) {
        this.messaging.send('user', { emotes });
    }

    async echo(position: number[], text: string) {
        return this.request("POST", "/echoes", { position, text });
    }

    async request(method: string, url: string, body?: any): Promise<any> {
        const headers: HeadersInit = {};

        if (this.credentials) {
            headers["Authorization"] = "Bearer " + this.credentials.token;
        }

        if (body) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(body);
        }

        return fetch(new URL(url, this.options.urlRoot === "." ? document.location.origin : this.options.urlRoot), { method, headers, body }).then(async (response) => {
            if (response.ok) return response.json().catch(() => {});
            throw new Error(await response.text());
        });
    }

    async searchLibrary(library: string, query?: string, tag?: string): Promise<Media[]> {
        const search = new URLSearchParams();
        if (query) search.set("q", query);
        if (tag) search.set("tag", tag);
        const results = await this.request("GET", `/libraries/${library}?${search}`) as Media[];
        results.forEach((item) => item.path = `${library}:${item.mediaId}`);
        return results;
    }

    async banger(tag?: string) {
        return this.request("POST", "/queue/banger", { tag });
    }

    async queue(path: string) {
        return this.request("POST", "/queue", { path });
    }

    async unqueue(item: QueueItem) {
        return this.request("DELETE", "/queue/" + item.itemId);
    }

    async skip() {
        if (!this.zone.lastPlayedItem) return;
        const { itemId } = this.zone.lastPlayedItem;
        return this.request("POST", "/queue/skip", { itemId });
    }

    private addStandardListeners() {
        const unqueue = (itemId: number) => {
            const index = this.zone.queue.findIndex((item) => item.itemId === itemId);
            if (index >= 0) {
                const [item] = this.zone.queue.splice(index, 1);
                this.emit('unqueue', { item });
            }
        };
        this.messaging.on('close', (code) => {
            const clean = code <= 1001 || code >= 4000;
            this.emit('disconnect', { clean });
        });
        this.messaging.messages.on('status', (message: StatusMesage) => {
            this.emit('status', { text: message.text });
        });
        this.messaging.messages.on('leave', (message: LeaveMessage) => {
            const user = this.zone.getUser(message.userId);
            this.zone.users.delete(message.userId);
            this.emit('leave', { user });
        });
        this.messaging.messages.on('users', (message: UsersMessage) => {
            this.zone.users.clear();
            message.users.forEach((user: UserState) => {
                this.zone.users.set(user.userId, user);
            });
            this.emit('users', {});
        });
        this.messaging.messages.on('echoes', (message: EchoesMessage) => {
            if (message.added) {
                message.added.forEach((echo) => this.zone.echoes.set(echo.position!, echo));
            } else if (message.removed) {
                message.removed.forEach((coord) => this.zone.echoes.delete(coord));
            }
        });
        this.messaging.messages.on('chat', (message: RecvChat) => {
            const user = this.zone.getUser(message.userId);
            const local = user.userId === this.localUserId;
            this.emit('chat', { user, text: message.text, local });
        });
        this.messaging.messages.on('play', (message: PlayMessage) => {
            this.zone.lastPlayedItem = message.item;
            if (message.item) unqueue(message.item.itemId);
            this.emit('play', { message });
        });
        this.messaging.messages.on('queue', (message: QueueMessage) => {
            this.zone.queue.push(...message.items);
            if (message.items.length === 1) this.emit('queue', { item: message.items[0] });
        });
        this.messaging.messages.on('unqueue', (message: UnqueueMessage) => {
            unqueue(message.itemId);
        });
        this.messaging.messages.on('user', (message: UserState) => {
            const user = this.zone.getUser(message.userId);
            const local = user.userId === this.localUserId;

            const prev = { ...user };
            const { userId, ...changes } = message;

            if (local && prev.position && changes.position) delete changes.position;

            Object.assign(user, changes);

            if (!prev.name) {
                this.emit('join', { user });
            } else if (prev.name !== user.name) {
                this.emit('rename', { user, local, previous: prev.name });
            }
            
            if (changes.position !== undefined) this.emit('move', { user, local, position: changes.position });
            if (changes.emotes) this.emit('emotes', { user, local, emotes: changes.emotes });
            if (changes.avatar) this.emit('avatar', { user, local, data: changes.avatar });
            if (changes.tags) this.emit('tags', { user, local, tags: changes.tags });
        });
    }
}

export default ZoneClient;
