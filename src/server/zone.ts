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
    library?: string;
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

    public addUser(userId: UserId): UserState {
        const user = { userId, emotes: [], tags: [] };
        this.users.set(userId, user);
        return user;
    }
}

export function coordsToKey(coords: number[]): string {
    return coords.join(',');
}

export class Grid<T> {
    private readonly cells = new Map<string, [number[], T]>();

    get size() {
        return this.cells.size;
    }

    clear() {
        return this.cells.clear();
    }

    has(coords: number[]) {
        return this.cells.has(coordsToKey(coords));
    }

    get(coords: number[]) {
        const [, value] = this.cells.get(coordsToKey(coords)) || [undefined, undefined];
        return value;
    }

    set(coords: number[], value: T) {
        return this.cells.set(coordsToKey(coords), [coords, value]);
    }

    delete(coords: number[]) {
        return this.cells.delete(coordsToKey(coords));
    }

    forEach(callbackfn: (value: T, coords: number[], grid: Grid<T>) => void) {
        return this.cells.forEach(([coords, value]) => callbackfn(value, coords, this));
    }

    [Symbol.iterator]() {
        return this.cells.values();
    }
}
