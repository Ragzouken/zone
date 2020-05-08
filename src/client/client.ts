import { getDefault } from './utility';
import Messaging from '../common/messaging';

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

export class ZoneClient {
    public readonly zone = new ZoneState();
    public readonly messaging = new Messaging(new WebSocket('ws://localhost'));

    public get localUser() {
        return this.zone.getUser(this.localUserId!);
    }

    public localUserId: UserId | undefined;
    public localToken: string | undefined;
    public joinPassword: string | undefined;
}
