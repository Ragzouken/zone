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