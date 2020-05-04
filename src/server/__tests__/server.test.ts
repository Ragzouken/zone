import { once } from 'events';
import * as Memory from 'lowdb/adapters/Memory';
import { Server } from 'http';
import * as WebSocket from 'ws';
import { AddressInfo } from 'net';

import { host, HostOptions } from '../server';
import WebSocketMessaging, { Message } from '../messaging';
import Playback, { QueueItem } from '../playback';
import { copy, sleep } from '../utility';
import { ARCHIVE_PATH_TO_MEDIA, YOUTUBE_VIDEOS, TINY_MEDIA, DAY_MEDIA } from './media.data';

const IMMEDIATE_REPLY_TIMEOUT = 50;

function socketAddress(server: Server) {
    const address = server.address() as AddressInfo;
    return `ws://localhost:${address.port}/zone`;
}

async function server(options: Partial<HostOptions>, callback: (server: TestServer) => Promise<void>) {
    const server = new TestServer(options);
    try {
        await once(server.hosting.server, 'listening');
        await callback(server);
    } finally {
        server.dispose();
    }
}

class TestServer {
    public hosting: { server: Server; playback: Playback };
    private readonly sockets: WebSocket[] = [];

    constructor(options?: Partial<HostOptions>) {
        this.hosting = host(new Memory(''), options);
    }

    public async socket() {
        const socket = new WebSocket(socketAddress(this.hosting.server));
        this.sockets.push(socket);
        await once(socket, 'open');
        return socket;
    }

    public async messaging() {
        return new WebSocketMessaging(await this.socket());
    }

    public dispose() {
        this.sockets.forEach((socket) => socket.close());
        this.hosting.server.close();
    }
}

async function response(messaging: WebSocketMessaging, type: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
        if (timeout) setTimeout(() => reject('timeout'), timeout);
        messaging.setHandler(type, (message) => {
            messaging.setHandler(type, () => {});
            resolve(message);
        });
    });
}

function join(messaging: WebSocketMessaging, message: any = {}, timeout?: number) {
    return new Promise<Message>((resolve, reject) => {
        if (timeout) setTimeout(() => reject('timeout'), timeout);
        messaging.setHandler('assign', resolve);
        messaging.setHandler('reject', reject);
        messaging.send('join', Object.assign({ name: 'anonymous' }, message));
    });
}

async function exchange(
    messaging: WebSocketMessaging,
    sendType: string,
    sendMessage: any,
    responseType: string,
): Promise<Message> {
    return new Promise((resolve, reject) => {
        messaging.setHandler(responseType, (message) => {
            messaging.setHandler(responseType, () => {});
            resolve(message);
        });
        messaging.send(sendType, sendMessage);
    });
}

describe('connectivity', () => {
    test('heartbeat response', async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();
            await join(messaging);
            await exchange(messaging, 'heartbeat', {}, 'heartbeat');
        });
    });

    test('server sends ping', async () => {
        await server({ pingInterval: 50 }, async (server) => {
            const socket = await server.socket();
            await once(socket, 'ping');
        });
    }, 100);

    test('server responds with pong', async () => {
        await server({ pingInterval: 50 }, async (server) => {
            const socket = await server.socket();
            const waiter = once(socket, 'pong');
            socket.ping();
            await waiter;
        });
    }, 100);
});

describe('join open server', () => {
    test('accepts no password', async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();
            await join(messaging);
        });
    });

    test('accepts any password', async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();
            await join(messaging, { password: 'old password' });
        });
    });
});

describe('join closed server', () => {
    test('rejects absent password', async () => {
        const password = 'riverdale';
        await server({ joinPassword: password }, async (server) => {
            const messaging = await server.messaging();
            const joining = join(messaging);
            await expect(joining).rejects.toMatchObject({ type: 'reject' });
        });
    });

    test('rejects incorrect password', async () => {
        const password = 'riverdale';
        await server({ joinPassword: password }, async (server) => {
            const messaging = await server.messaging();
            const joining = join(messaging, { password: 'wrong' });
            await expect(joining).rejects.toMatchObject({ type: 'reject' });
        });
    });

    test('accepts correct password', async () => {
        const password = 'riverdale';
        await server({ joinPassword: password }, async (server) => {
            const messaging = await server.messaging();
            await join(messaging, { password });
        });
    });
});

describe('join server', () => {
    test('assigns id and token', async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();

            const { userId, token } = await join(messaging);

            expect(userId).not.toBeUndefined();
            expect(token).not.toBeUndefined();
        });
    });

    test('ignores second join', async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();

            await join(messaging);
            const repeat = join(messaging, {}, 100);
            await expect(repeat).rejects.toEqual('timeout');
        });
    });

    it('sends user list', async () => {
        await server({}, async (server) => {
            const name = 'user1';
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();
            const { userId } = await join(messaging1, { name });

            const waitUsers = response(messaging2, 'users');
            await join(messaging2);
            const { users } = await waitUsers;

            expect(users[0]).toMatchObject({ userId, name });
        });
    });

    test('server sends name on join', async () => {
        await server({}, async (server) => {
            const name = 'baby yoda';
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();

            await join(messaging1);
            const waiter = response(messaging1, 'name');
            const { userId } = await join(messaging2, { name });
            const message = await waiter;

            expect(message.userId).toEqual(userId);
            expect(message.name).toEqual(name);
        });
    });
});

describe('unclean disconnect', () => {
    test('can resume session with token', async () => {
        await server({}, async (server) => {
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();

            const assign1 = await join(messaging1);
            messaging1.disconnect(3000);
            const assign2 = await join(messaging2, { token: assign1.token });

            expect(assign2.userId).toEqual(assign1.userId);
            expect(assign2.token).toEqual(assign1.token);
        });
    });

    test('server assigns new user for expired token', async () => {
        await server({ userTimeout: 0 }, async (server) => {
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();

            const assign1 = await join(messaging1);
            messaging1.disconnect(3000);
            await sleep(100);
            const assign2 = await join(messaging2, { token: assign1.token });

            expect(assign2.userId).not.toEqual(assign1.userId);
            expect(assign2.token).not.toEqual(assign1.token);
        });
    });

    test('send leave message when token expires', async () => {
        await server({ userTimeout: 50 }, async (server) => {
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();

            await join(messaging1);
            await join(messaging2);

            const leaveWaiter = response(messaging2, 'leave');
            messaging1.disconnect(3000);
            await leaveWaiter;
        });
    });
});

describe('user presence', () => {
    const MESSAGES = [
        { type: 'chat', text: 'hello baby yoda' },
        { type: 'name', name: 'baby yoda' },
        { type: 'move', position: [0, 0] },
        { type: 'emotes', emotes: ['shk', 'wvy'] },
        { type: 'avatar', data: 'AGb/w+f/WmY=' },
    ];

    it.each(MESSAGES)('echoes own change', async ({ type, ...message }) => {
        await server({}, async (server) => {
            const messaging = await server.messaging();
            const { userId } = await join(messaging);
            const echo = await exchange(messaging, type, message, type);

            expect(echo).toEqual({ userId, ...message });
        });
    });

    it.each(MESSAGES)('forwards own change', async (message) => {
        await server({}, async (server) => {
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();

            const { userId } = await join(messaging1);
            await join(messaging2);

            const waiter = response(messaging2, message.type);
            messaging1.send(message.type, message);
            const forward = await waiter;

            expect(forward).toEqual({ userId, ...message });
        });
    });
});

describe('playback', () => {
    it('sends currently playing on join', async () => {
        await server({}, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const messaging = await server.messaging();
            const waiter = response(messaging, 'play');
            await join(messaging);
            const play = await waiter;

            expect(play.time).toBeGreaterThan(0);
            expect(play.item).toEqual(server.hosting.playback.currentItem);
        });
    });

    it('sends currently playing on resync', async () => {
        await server({}, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const messaging = await server.messaging();
            const waiter = response(messaging, 'play');
            await join(messaging);
            await waiter;

            const play = await exchange(messaging, 'resync', {}, 'play');

            expect(play.time).toBeGreaterThan(0);
            expect(play.item).toEqual(server.hosting.playback.currentItem);
        });
    });

    it('sends empty play when all playback ends', async () => {
        await server({ playbackPaddingTime: 0 }, async (server) => {
            const messaging = await server.messaging();
            await join(messaging);

            const playWaiter = response(messaging, 'play');
            server.hosting.playback.queueMedia(TINY_MEDIA);
            await playWaiter;

            const stop = await response(messaging, 'play');
            expect(stop).toEqual({ type: 'play' });
        });
    });

    it("doesn't queue duplicate media", async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();

            const media = YOUTUBE_VIDEOS[0];
            // queue twice because currently playing doesn't count
            server.hosting.playback.queueMedia(media);
            server.hosting.playback.queueMedia(media);

            await join(messaging);
            const waitQueue = response(messaging, 'queue', 200);
            messaging.send('youtube', { videoId: media.source.videoId });

            await expect(waitQueue).rejects.toEqual('timeout');
        });
    });

    it("doesn't queue beyond limit", async () => {
        await server({ perUserQueueLimit: 0 }, async (server) => {
            const messaging = await server.messaging();

            await join(messaging);
            const queue = response(messaging, 'queue', 200);
            messaging.send('youtube', { videoId: '2GjyNgQ4Dos' });

            await expect(queue).rejects.toEqual('timeout');
        });
    });

    it('skips with sufficient votes', async () => {
        await server({ voteSkipThreshold: 1 }, async (server) => {
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const waiter1 = response(messaging1, 'play');
            const waiter2 = response(messaging2, 'play');

            await join(messaging1);
            await join(messaging2);

            const { item }: { item: QueueItem } = await waiter1;
            await waiter2;

            const waiter = response(messaging1, 'play');
            messaging1.send('skip', { source: item.media.source });
            messaging2.send('skip', { source: item.media.source });

            await waiter;
        });
    });

    it('skips with sufficient errors', async () => {
        await server({ voteSkipThreshold: 1 }, async (server) => {
            const messaging1 = await server.messaging();
            const messaging2 = await server.messaging();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const waiter1 = response(messaging1, 'play');
            const waiter2 = response(messaging2, 'play');

            await join(messaging1);
            await join(messaging2);

            const { item }: { item: QueueItem } = await waiter1;
            await waiter2;

            const waiter = response(messaging1, 'play');
            messaging1.send('error', { source: item.media.source });
            messaging2.send('error', { source: item.media.source });

            await waiter;
        });
    });

    it('skips with password', async () => {
        const password = 'riverdale';
        await server({ voteSkipThreshold: 2, skipPassword: password }, async (server) => {
            const messaging = await server.messaging();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = response(messaging, 'play');
            await join(messaging);
            const { item } = await playWaiter;

            const stopWaiter = response(messaging, 'play');
            messaging.send('skip', { source: item.media.source, password });

            await stopWaiter;
        });
    });

    it("doesn't skip with insufficient votes", async () => {
        await server({ voteSkipThreshold: 2 }, async (server) => {
            const messaging = await server.messaging();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = response(messaging, 'play');
            await join(messaging);
            const { item } = await playWaiter;

            const skip = response(messaging, 'play', IMMEDIATE_REPLY_TIMEOUT);
            messaging.send('skip', { source: item.media.source });

            await expect(skip).rejects.toEqual('timeout');
        });
    });

    it("doesn't skip with insufficient errors", async () => {
        await server({ errorSkipThreshold: 2 }, async (server) => {
            const messaging = await server.messaging();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = response(messaging, 'play');
            await join(messaging);
            const { item } = await playWaiter;

            const skip = response(messaging, 'play', IMMEDIATE_REPLY_TIMEOUT);
            messaging.send('error', { source: item.media.source });

            await expect(skip).rejects.toEqual('timeout');
        });
    });

    it("doesn't skip incorrect video", async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = response(messaging, 'play');
            await join(messaging);
            const { item } = await playWaiter;

            const source = copy(item.media.source);
            source.type = 'fake';

            const skip = response(messaging, 'play', IMMEDIATE_REPLY_TIMEOUT);
            messaging.send('skip', { source });

            await expect(skip).rejects.toEqual('timeout');
        });
    });
});

describe('media sources', () => {
    it('can play archive item', async () => {
        await server({}, async (server) => {
            const { path, media } = ARCHIVE_PATH_TO_MEDIA[0];

            const messaging = await server.messaging();
            await join(messaging);
            const message = await exchange(messaging, 'archive', { path }, 'play');

            expect(message.item.media).toEqual(media);
        });
    });

    it('can play youtube video', async () => {
        await server({}, async (server) => {
            const source = YOUTUBE_VIDEOS[0].source;

            const messaging = await server.messaging();
            await join(messaging);
            const message = await exchange(messaging, 'youtube', { videoId: source.videoId }, 'play');

            expect(message.item.media.source).toEqual(source);
        });
    });

    test('can search youtube', async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();
            await join(messaging);
            await exchange(messaging, 'search', { query: 'hello' }, 'search');
        });
    });

    test('can lucky search youtube', async () => {
        await server({}, async (server) => {
            const messaging = await server.messaging();
            await join(messaging);
            await exchange(messaging, 'search', { query: 'hello', lucky: true }, 'play');
        });
    });
});

test('server sends leave on clean quit', async () => {
    await server({}, async (server) => {
        const messaging1 = await server.messaging();
        const messaging2 = await server.messaging();

        const { userId: joinedId } = await join(messaging1);
        await join(messaging2);

        const waiter = response(messaging2, 'leave');
        messaging1.disconnect();
        const { userId: leftId } = await waiter;

        expect(joinedId).toEqual(leftId);
    });
});
