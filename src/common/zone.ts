import { getDefault } from './utility';

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

    public reset() {
        this.users.clear();
    }

    public getUser(userId: UserId): UserState {
        return getDefault(this.users, userId, () => ({ userId, emotes: [] }));
    }
}
