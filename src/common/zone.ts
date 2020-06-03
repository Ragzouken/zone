import { getDefault } from './utility';

export type UserId = string;

export type UserState = {
    userId: UserId;
    name?: string;
    position?: number[];
    avatar?: string;
    emotes: string[];
};

export type Media = {
    title: string;
    duration: number;
    source: string;
    thumbnail?: string;
};

export type QueueInfo = { userId?: UserId; ip?: unknown };
export type QueueItem = { media: Media; info: QueueInfo };

export type MediaMeta = Omit<Media, 'source'>;

export function mediaEquals(a: Media, b: Media) {
    return a.source === b.source;
}

export class ZoneState {
    public readonly users = new Map<UserId, UserState>();
    readonly queue: QueueItem[] = [];
    lastPlayedItem?: QueueItem;

    public clear() {
        this.users.clear();
        this.queue.length = 0;
        this.lastPlayedItem = undefined;
    }

    public getUser(userId: UserId): UserState {
        return getDefault(this.users, userId, () => ({ userId, emotes: [] }));
    }
}
