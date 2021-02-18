import { getDefault, Grid } from './utility';

export type UserId = string;

export type UserState = {
    userId: UserId;
    name?: string;
    position?: number[];
    avatar?: string;
    emotes: string[];
    tags: string[];
};

export type Media = {
    mediaId: string;
    title: string;
    duration: number;
    src: string;
    subtitle?: string;
    thumbnail?: string;
    path?: string;
    library: string;
};

export type UserEcho = UserState & {
    text: string;
};

export type QueueInfo = { userId?: UserId; ip?: unknown; banger?: boolean };
export type QueueItem = { media: Media; info: QueueInfo; itemId: number };

export class ZoneState {
    public readonly users = new Map<UserId, UserState>();
    readonly queue: QueueItem[] = [];
    lastPlayedItem?: QueueItem;

    public readonly echoes = new Grid<UserEcho>();

    public clear() {
        this.users.clear();
        this.echoes.clear();
        this.queue.length = 0;
        this.lastPlayedItem = undefined;
    }

    public getUser(userId: UserId): UserState {
        return getDefault(this.users, userId, () => ({ userId, emotes: [], tags: [] }));
    }
}
