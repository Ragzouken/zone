import { once } from 'events';
import { MessageMap, RecvChat } from '../client';
import { copy, sleep } from '../utility';
import { ARCHIVE_PATH_TO_MEDIA, YOUTUBE_VIDEOS, TINY_MEDIA, DAY_MEDIA } from './media.data';
import { zoneServer } from './utilities';

const IMMEDIATE_REPLY_TIMEOUT = 50;
const NAME = 'baby yoda';

describe('connectivity', () => {
    test('heartbeat response', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            await client.heartbeat();
        });
    });

    test('server sends ping', async () => {
        await zoneServer({ pingInterval: 10 }, async (server) => {
            const socket = await server.socket();
            await once(socket, 'ping');
        });
    }, 100);

    test('server responds with pong', async () => {
        await zoneServer({ pingInterval: 50 }, async (server) => {
            const socket = await server.socket();
            const waiter = once(socket, 'pong');
            socket.ping();
            await waiter;
        });
    }, 100);
});

describe('join open server', () => {
    test('accepts no password', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join({ name: 'no pass' });
        });
    });

    test('accepts any password', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join({ name: 'any pass', password: 'old password' });
        });
    });
});

describe('join closed server', () => {
    const PASSWORD_REJECT = { text: expect.stringContaining('password') };

    test('rejects absent password', async () => {
        const password = 'riverdale';
        await zoneServer({ joinPassword: password }, async (server) => {
            const client = await server.client();
            const joining = client.join();
            await expect(joining).rejects.toMatchObject(PASSWORD_REJECT);
        });
    });

    test('rejects incorrect password', async () => {
        const password = 'riverdale';
        await zoneServer({ joinPassword: password }, async (server) => {
            const client = await server.client();
            const joining = client.join({ password: password + ' wrong' });
            await expect(joining).rejects.toMatchObject(PASSWORD_REJECT);
        });
    });

    test('accepts correct password', async () => {
        const password = 'riverdale';
        await zoneServer({ joinPassword: password }, async (server) => {
            const client = await server.client();
            await client.join({ password });
        });
    });
});

describe('join server', () => {
    test('assigns id and token', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            const { userId, token } = await client.join();

            expect(userId).not.toBeUndefined();
            expect(token).not.toBeUndefined();
        });
    });

    test('ignores second join', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            const repeat = client.join();
            await expect(repeat).rejects.toEqual('timeout');
        });
    });

    it('sends user list', async () => {
        await zoneServer({}, async (server) => {
            const name = 'user1';
            const client1 = await server.client();
            const client2 = await server.client();
            const { userId } = await client1.join({ name });

            const waitUsers = client2.expect('users');
            await client2.join();
            const { users } = await waitUsers;

            expect(users[0]).toMatchObject({ userId, name });
        });
    });

    test('server sends name on join', async () => {
        await zoneServer({}, async (server) => {
            const name = 'baby yoda 2';
            const client1 = await server.client();
            const client2 = await server.client();

            await client1.join();
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
        await zoneServer({}, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const assign1 = await client1.join();
            await client1.messaging.close(3000);
            const assign2 = await client2.join({ token: assign1.token });

            expect(assign2.userId).toEqual(assign1.userId);
            expect(assign2.token).toEqual(assign1.token);
        });
    });

    test('server assigns new user for expired token', async () => {
        await zoneServer({ userTimeout: 0 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const assign1 = await client1.join();
            await client1.messaging.close(3000);
            await sleep(10); // TODO: server should check expiry at time of join
            const assign2 = await client2.join({ token: assign1.token });

            expect(assign2.userId).not.toEqual(assign1.userId);
            expect(assign2.token).not.toEqual(assign1.token);
        });
    });

    test('client join reuses existing token', async () => {
        await zoneServer({}, async (server) => {
            const socket = await server.socket();
            const client = await server.client();
            client.messaging.on('close', () => client.messaging.setSocket(socket));

            await client.join();
            await client.messaging.close(3000);
            await client.join();
        });
    });

    test('send leave message when token expires', async () => {
        await zoneServer({ userTimeout: 50 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const { userId } = await client1.join();
            await client2.join();

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

    test('client chat', async () => {
        const message = 'hello baby yoda';
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            const waiter = once(client, 'chat');
            client.chat(message);
            const chat = (await waiter)[0];
            expect(chat.text).toEqual(message);
        });
    });

    test('client rename', async () => {
        const newName = 'adult yoda';
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            const { name, userId } = await client.rename(newName);
            expect(name).toEqual(newName);
            expect(userId).toEqual(client.localUserId);
        });
    });

    it.each(MESSAGES)('echoes own change', async ({ type, ...message }) => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            const { userId } = await client.join();

            const waiter = client.expect(type);
            client.messaging.send(type, message);
            const echo = await waiter;

            expect(echo).toEqual({ userId, ...message });
        });
    });

    it.each(MESSAGES)('forwards own change', async (message) => {
        await zoneServer({}, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            const { userId } = await client1.join();
            await client2.join();

            const waiter = client2.expect(message.type);
            client1.messaging.send(message.type, message);
            const forward = await waiter;

            expect(forward).toEqual({ userId, ...message, type: undefined });
        });
    });
});

describe('playback', () => {
    it('sends currently playing on join', async () => {
        await zoneServer({}, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const client = await server.client();
            const waiter = client.expect('play');
            await client.join();
            const play = await waiter;

            expect(play.time).toBeGreaterThan(0);
            expect(play.item).toEqual(server.hosting.playback.currentItem);
        });
    });

    it('sends currently playing on resync', async () => {
        await zoneServer({}, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const client = await server.client();
            const waiter = client.expect('play');
            await client.join();
            await waiter;

            const play = await client.resync();

            expect(play.time).toBeGreaterThan(0);
            expect(play.item).toEqual(server.hosting.playback.currentItem);
        });
    });

    it('sends empty play when all playback ends', async () => {
        await zoneServer({ playbackPaddingTime: 0 }, async (server) => {
            const client = await server.client();
            await client.join();

            const waiter = client.expect('play');
            server.hosting.playback.queueMedia(TINY_MEDIA);
            await waiter;

            const stop = await client.expect('play');
            expect(stop).toEqual({});
        });
    });

    it("doesn't queue duplicate media", async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();

            const media = YOUTUBE_VIDEOS[0];
            // queue twice because currently playing doesn't count
            server.hosting.playback.queueMedia(media);
            server.hosting.playback.queueMedia(media);

            await client.join();
            const queued = client.youtube(media.source.videoId);

            await expect(queued).rejects.toEqual('timeout');
        });
    });

    it("doesn't queue beyond limit", async () => {
        await zoneServer({ perUserQueueLimit: 0 }, async (server) => {
            const client = await server.client();

            await client.join();
            const queued = client.youtube('2GjyNgQ4Dos');

            await expect(queued).rejects.toEqual('timeout');
        });
    });

    it('skips with sufficient votes', async () => {
        await zoneServer({ voteSkipThreshold: 1 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const waiter1 = client1.expect('play');
            const waiter2 = client2.expect('play');

            await client1.join();
            await client2.join();

            await waiter1;
            await waiter2;

            const waiter = client1.expect('play');
            client1.skip();
            client2.skip();
            await waiter;
        });
    });

    it('skips with sufficient unplayables', async () => {
        await zoneServer({ voteSkipThreshold: 1 }, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const waiter1 = client1.expect('play');
            const waiter2 = client2.expect('play');

            await client1.join();
            await client2.join();

            await waiter1;
            await waiter2;

            const waiter = client1.expect('play');
            client1.unplayable();
            client2.unplayable();
            await waiter;
        });
    });

    it('skips with password', async () => {
        const password = 'riverdale';
        await zoneServer({ voteSkipThreshold: 2, skipPassword: password }, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const played = client.expect('play');
            await client.join();
            await played;

            const skipped = client.expect('play');
            client.skip(password);
            await skipped;
        });
    });

    it("doesn't skip with insufficient votes", async () => {
        await zoneServer({ voteSkipThreshold: 2 }, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const played = client.expect('play');
            await client.join();
            await played;

            const skipped = client.expect('play', IMMEDIATE_REPLY_TIMEOUT);
            client.skip();
            await expect(skipped).rejects.toEqual('timeout');
        });
    });

    it("doesn't skip with insufficient errors", async () => {
        await zoneServer({ errorSkipThreshold: 2 }, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const played = client.expect('play');
            await client.join();
            await played;

            const skipped = client.expect('play', IMMEDIATE_REPLY_TIMEOUT);
            client.unplayable();
            await expect(skipped).rejects.toEqual('timeout');
        });
    });

    it("doesn't skip incorrect video", async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = client.expect('play');
            await client.join();
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
        await zoneServer({}, async (server) => {
            const { path, media } = ARCHIVE_PATH_TO_MEDIA[0];

            const client = await server.client();
            await client.join();

            const waiter = client.expect('play');
            client.messaging.send('archive', { path });
            const message = await waiter;

            expect(message.item.media).toEqual(media);
        });
    });

    it('can queue youtube video', async () => {
        await zoneServer({}, async (server) => {
            const source = YOUTUBE_VIDEOS[0].source;

            const client = await server.client();
            await client.join();

            const { items } = await client.youtube(source.videoId);
            expect(items[0].media.source).toEqual(source);
        });
    });

    test('can search youtube', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            await client.search('hello');
        });
    });

    test('can lucky search youtube', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            await client.lucky('hello');
        });
    });
});

test('server sends leave on clean quit', async () => {
    await zoneServer({}, async (server) => {
        const client1 = await server.client();
        const client2 = await server.client();

        const { userId: joinedId } = await client1.join();
        await client2.join();

        const waiter = client2.expect('leave');
        await client1.messaging.close();
        const { userId: leftId } = await waiter;

        expect(joinedId).toEqual(leftId);
    });
});