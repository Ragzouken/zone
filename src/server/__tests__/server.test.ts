import { once } from 'events';
import * as Memory from 'lowdb/adapters/Memory';
import { Server } from 'http';
import * as WebSocket from 'ws';
import { AddressInfo } from 'net';

import { host, HostOptions } from '../server';

import ZoneClient, { MessageMap } from '../../common/client';
import Messaging from '../../common/messaging';

import Playback, { QueueItem } from '../playback';
import { copy, sleep } from '../../common/utility';
import { ARCHIVE_PATH_TO_MEDIA, YOUTUBE_VIDEOS, TINY_MEDIA, DAY_MEDIA } from './media.data';

const IMMEDIATE_REPLY_TIMEOUT = 50;
const NAME = 'baby yoda';

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
        const address = this.hosting.server.address() as AddressInfo;
        const socket = new WebSocket(`ws://localhost:${address.port}/zone`);
        this.sockets.push(socket);
        await once(socket, 'open');
        return socket;
    }

    public async client() {
        const client = new ZoneClient();
        client.messaging.setSocket(await this.socket());
        return client;
    }

    public dispose() {
        this.sockets.forEach((socket) => socket.close());
        this.hosting.server.close();
    }
}

describe('connectivity', () => {
    test('heartbeat response', async () => {
        await server({}, async (server) => {
            const client = await server.client();
            await client.join({ name: NAME });

            const waiter = client.expect('heartbeat');
            client.messaging.send('heartbeat', {});
            await waiter;
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
            const client = await server.client();
            await client.join({ name: 'no pass' });
        });
    });

    test('accepts any password', async () => {
        await server({}, async (server) => {
            const client = await server.client();
            await client.join({ name: 'any pass', password: 'old password' });
        });
    });
});

describe('join closed server', () => {
    const PASSWORD_REJECT = { text: expect.stringContaining('password') };

    test('rejects absent password', async () => {
        const password = 'riverdale';
        await server({ joinPassword: password }, async (server) => {
            const client = await server.client();
            const joining = client.join({ name: NAME });
            await expect(joining).rejects.toMatchObject(PASSWORD_REJECT);
        });
    });

    test('rejects incorrect password', async () => {
        const password = 'riverdale';
        await server({ joinPassword: password }, async (server) => {
            const client = await server.client();
            const joining = client.join({ name: NAME, password: password + ' wrong' });
            await expect(joining).rejects.toMatchObject(PASSWORD_REJECT);
        });
    });

    test('accepts correct password', async () => {
        const password = 'riverdale';
        await server({ joinPassword: password }, async (server) => {
            const client = await server.client();
            await client.join({ name: NAME, password });
        });
    });
});

describe('join server', () => {
    test('assigns id and token', async () => {
        await server({}, async (server) => {
            const client = await server.client();
            const { userId, token } = await client.join({ name: NAME });

            expect(userId).not.toBeUndefined();
            expect(token).not.toBeUndefined();
        });
    });

    test('ignores second join', async () => {
        await server({}, async (server) => {
            const client = await server.client();
            await client.join({ name: NAME });
            const repeat = client.join({ name: NAME });
            await expect(repeat).rejects.toEqual('timeout');
        });
    });

    it('sends user list', async () => {
        await server({}, async (server) => {
            const name = 'user1';
            const client1 = await server.client();
            const client2 = await server.client();
            const { userId } = await client1.join({ name });

            const waitUsers = client2.expect('users');
            await client2.join({ name: NAME });
            const { users } = await waitUsers;

            expect(users[0]).toMatchObject({ userId, name });
        });
    });

    test('server sends name on join', async () => {
        await server({}, async (server) => {
            const name = 'baby yoda';
            const client1 = await server.client();
            const client2 = await server.client();

            await client1.join({ name: NAME });
            const waiter = client1.expect('name');
            const { userId } = await client2.join({ name });
            const message = await waiter;

            expect(message.userId).toEqual(userId);
            expect(message.name).toEqual(name);
        });
    });
});

describe('unclean disconnect', () => {
    test('can resume session with token', async () => {
        await server({}, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const assign1 = await client1.join({ name: NAME });
            await client1.messaging.close(3000);
            const assign2 = await client2.join({ name: NAME, token: assign1.token });

            expect(assign2.userId).toEqual(assign1.userId);
            expect(assign2.token).toEqual(assign1.token);
        });
    });

    test('server assigns new user for expired token', async () => {
        await server({ userTimeout: 0 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const assign1 = await client1.join({ name: NAME });
            await client1.messaging.close(3000);
            await sleep(10); // TODO: server should check expiry at time of join
            const assign2 = await client2.join({ name: NAME, token: assign1.token });

            expect(assign2.userId).not.toEqual(assign1.userId);
            expect(assign2.token).not.toEqual(assign1.token);
        });
    });

    test('client join reuses existing token', async () => {
        await server({}, async (server) => {
            const socket = await server.socket();
            const client = await server.client();
            client.messaging.on('close', () => client.messaging.setSocket(socket));

            await client.join({ name: NAME });
            await client.messaging.close(3000);
            await client.join({ name: NAME });
        });
    });

    test('send leave message when token expires', async () => {
        await server({ userTimeout: 50 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const { userId } = await client1.join({ name: NAME });
            await client2.join({ name: NAME });

            const leaveWaiter = client2.expect('leave');
            await client1.messaging.close(3000);
            expect(await leaveWaiter).toEqual({ userId });
        });
    });
});

describe('user presence', () => {
    const MESSAGES: { type: keyof MessageMap; [key: string]: any }[] = [
        { type: 'chat', text: 'hello baby yoda' },
        { type: 'name', name: 'baby yoda' },
        { type: 'move', position: [0, 0] },
        { type: 'emotes', emotes: ['shk', 'wvy'] },
        { type: 'avatar', data: 'AGb/w+f/WmY=' },
    ];

    it.each(MESSAGES)('echoes own change', async ({ type, ...message }) => {
        await server({}, async (server) => {
            const client = await server.client();
            const { userId } = await client.join({ name: NAME });

            const waiter = client.expect(type);
            client.messaging.send(type, message);
            const echo = await waiter;

            expect(echo).toEqual({ userId, ...message });
        });
    });

    it.each(MESSAGES)('forwards own change', async (message) => {
        await server({}, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const { userId } = await client1.join({ name: NAME });
            await client2.join({ name: NAME });

            const waiter = client2.expect(message.type);
            client1.messaging.send(message.type, message);
            const forward = await waiter;

            expect(forward).toEqual({ userId, ...message, type: undefined });
        });
    });
});

describe('playback', () => {
    it('sends currently playing on join', async () => {
        await server({}, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const client = await server.client();
            const waiter = client.expect('play');
            await client.join({ name: NAME });
            const play = await waiter;

            expect(play.time).toBeGreaterThan(0);
            expect(play.item).toEqual(server.hosting.playback.currentItem);
        });
    });

    it('sends currently playing on resync', async () => {
        await server({}, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const client = await server.client();
            const waiter1 = client.expect('play');
            await client.join({ name: NAME });
            await waiter1;

            const waiter2 = client.expect('play');
            client.messaging.send('resync', {});
            const play = await waiter2;

            expect(play.time).toBeGreaterThan(0);
            expect(play.item).toEqual(server.hosting.playback.currentItem);
        });
    });

    it('sends empty play when all playback ends', async () => {
        await server({ playbackPaddingTime: 0 }, async (server) => {
            const client = await server.client();
            await client.join({ name: NAME });

            const waiter = client.expect('play');
            server.hosting.playback.queueMedia(TINY_MEDIA);
            await waiter;

            const stop = await client.expect('play');
            expect(stop).toEqual({});
        });
    });

    it("doesn't queue duplicate media", async () => {
        await server({}, async (server) => {
            const client = await server.client();

            const media = YOUTUBE_VIDEOS[0];
            // queue twice because currently playing doesn't count
            server.hosting.playback.queueMedia(media);
            server.hosting.playback.queueMedia(media);

            await client.join({ name: NAME });
            const waiter = client.expect('queue', 200);
            client.messaging.send('youtube', { videoId: media.source.videoId });

            await expect(waiter).rejects.toEqual('timeout');
        });
    });

    it("doesn't queue beyond limit", async () => {
        await server({ perUserQueueLimit: 0 }, async (server) => {
            const client = await server.client();

            await client.join({ name: NAME });
            const queue = client.expect('queue', 200);
            client.messaging.send('youtube', { videoId: '2GjyNgQ4Dos' });

            await expect(queue).rejects.toEqual('timeout');
        });
    });

    it('skips with sufficient votes', async () => {
        await server({ voteSkipThreshold: 1 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const waiter1 = client1.expect('play');
            const waiter2 = client2.expect('play');

            await client1.join({ name: NAME });
            await client2.join({ name: NAME });

            const { item }: { item: QueueItem } = await waiter1;
            await waiter2;

            const waiter = client1.expect('play');
            client1.messaging.send('skip', { source: item.media.source });
            client2.messaging.send('skip', { source: item.media.source });

            await waiter;
        });
    });

    it('skips with sufficient errors', async () => {
        await server({ voteSkipThreshold: 1 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const waiter1 = client1.expect('play');
            const waiter2 = client2.expect('play');

            await client1.join({ name: NAME });
            await client2.join({ name: NAME });

            const { item }: { item: QueueItem } = await waiter1;
            await waiter2;

            const waiter = client1.expect('play');
            client1.messaging.send('error', { source: item.media.source });
            client2.messaging.send('error', { source: item.media.source });

            await waiter;
        });
    });

    it('skips with password', async () => {
        const password = 'riverdale';
        await server({ voteSkipThreshold: 2, skipPassword: password }, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = client.expect('play');
            await client.join({ name: NAME });
            const { item } = await playWaiter;

            const stopWaiter = client.expect('play');
            client.messaging.send('skip', { source: item.media.source, password });

            await stopWaiter;
        });
    });

    it("doesn't skip with insufficient votes", async () => {
        await server({ voteSkipThreshold: 2 }, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = client.expect('play');
            await client.join({ name: NAME });
            const { item } = await playWaiter;

            const skip = client.expect('play', IMMEDIATE_REPLY_TIMEOUT);
            client.messaging.send('skip', { source: item.media.source });

            await expect(skip).rejects.toEqual('timeout');
        });
    });

    it("doesn't skip with insufficient errors", async () => {
        await server({ errorSkipThreshold: 2 }, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = client.expect('play');
            await client.join({ name: NAME });
            const { item } = await playWaiter;

            const skip = client.expect('play', IMMEDIATE_REPLY_TIMEOUT);
            client.messaging.send('error', { source: item.media.source });

            await expect(skip).rejects.toEqual('timeout');
        });
    });

    it("doesn't skip incorrect video", async () => {
        await server({}, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = client.expect('play');
            await client.join({ name: NAME });
            const { item } = await playWaiter;

            const source = copy(item.media.source);
            source.type = 'fake';

            const skip = client.expect('play', IMMEDIATE_REPLY_TIMEOUT);
            client.messaging.send('skip', { source });

            await expect(skip).rejects.toEqual('timeout');
        });
    });
});

describe('media sources', () => {
    it('can play archive item', async () => {
        await server({}, async (server) => {
            const { path, media } = ARCHIVE_PATH_TO_MEDIA[0];

            const client = await server.client();
            await client.join({ name: NAME });

            const waiter = client.expect('play');
            client.messaging.send('archive', { path });
            const message = await waiter;

            expect(message.item.media).toEqual(media);
        });
    });

    it('can play youtube video', async () => {
        await server({}, async (server) => {
            const source = YOUTUBE_VIDEOS[0].source;

            const client = await server.client();
            await client.join({ name: NAME });

            const waiter = client.expect('play');
            client.messaging.send('youtube', { videoId: source.videoId });
            const message = await waiter;

            expect(message.item.media.source).toEqual(source);
        });
    });

    test('can search youtube', async () => {
        await server({}, async (server) => {
            const client = await server.client();
            await client.join({ name: NAME });

            const waiter = client.expect('search');
            client.messaging.send('search', { query: 'hello' });
            await waiter;
        });
    });

    test('can lucky search youtube', async () => {
        await server({}, async (server) => {
            const client = await server.client();
            await client.join({ name: NAME });

            const waiter = client.expect('play');
            client.messaging.send('search', { query: 'hello', lucky: true });
            await waiter;
        });
    });
});

test('server sends leave on clean quit', async () => {
    await server({}, async (server) => {
        const client1 = await server.client();
        const client2 = await server.client();

        const { userId: joinedId } = await client1.join({ name: NAME });
        await client2.join({ name: NAME });

        const waiter = client2.expect('leave');
        await client1.messaging.close();
        const { userId: leftId } = await waiter;

        expect(joinedId).toEqual(leftId);
    });
});
