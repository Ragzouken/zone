import { getDefault } from './utility';
import { QueueItem } from '../server/playback';

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
    image?: string;
};

export type MediaMeta = Omit<Media, 'source'>;

export function mediaHasSource(a: Media, source: string) {
    return a.source.includes(source);
}

export function mediaEquals(a: Media, b: Media) {
    for (const source of a.source) {
        if (mediaHasSource(b, source)) {
            return true;
        }
    }

    return false;
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
