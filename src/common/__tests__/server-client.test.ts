import { once } from 'events';
import { sleep } from '../utility';
import { YOUTUBE_MEDIA, TINY_MEDIA, DAY_MEDIA } from './media.data';
import { zoneServer } from './utilities';

const IMMEDIATE_REPLY_TIMEOUT = 50;

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
    }, 500);

    test('server responds with pong', async () => {
        await zoneServer({}, async (server) => {
            const socket = await server.socket();
            const waiter = once(socket, 'pong');
            socket.ping();
            await waiter;
        });
    }, 500);
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
            const waiter = client1.expect('user');
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

    test('client avatar', async () => {
        const avatar = 'AGb/w+f/WmY=';
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            const waiter = client.expect('user');
            client.avatar(avatar);
            await waiter;
            expect(client.localUser?.avatar).toEqual(avatar);
        });
    });

    test('client move', async () => {
        const position = [6, 9, 0];
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            const waiter = client.expect('user');
            client.move(position);
            await waiter;
            expect(client.localUser?.position).toEqual(position);
        });
    });

    test('client emotes', async () => {
        const emotes = ['shk', 'wvy'];
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();
            const waiter = client.expect('user');
            client.emotes(emotes);
            await waiter;
            expect(client.localUser?.emotes).toEqual(emotes);
        });
    });
});

describe('blocks', () => {
    const blocks = new Set([
        [-20, 0, 0],
        [-19, 1, 2],
        [-18, 5, 6]
    ]);

    it('can add a block', async () => {
        const coords = [-99, -88, -77];

        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();

            const waiter = client.expect('block');
            client.setBlock(coords, true);

            const added = await waiter;
            expect(added.coords).toEqual(coords);
            expect(added.value).toEqual(true); 
        });
    });

    it('can remove a block', async () => {
        const coords = [-88, -77, -99];

        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();

            const waiter = client.expect('block');
            client.setBlock(coords, false);

            const added = await waiter;
            expect(added.coords).toEqual(coords);
            expect(added.value).toEqual(false); 
        });
    });

    it('receives existing blocks', async () => {
        await zoneServer({}, async (server) => {
            const client1 = await server.client();
            await client1.join();

            blocks.forEach((coord) => client1.setBlock(coord, true));
            await sleep(100);

            const client2 = await server.client();
            const waiter = client2.expect('blocks');
            await client2.join();

            const received = await waiter;
            expect(new Set(received.coords)).toEqual(blocks);
        });
    });
});

describe('playback', () => {
    it('sends currently playing on join', async () => {
        await zoneServer({ playbackStartDelay: 0 }, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const client = await server.client();
            const waiter = client.expect('play');
            await client.join();
            const play = await waiter;

            expect(play.time).toBeGreaterThan(0);
            expect(play.item).toEqual(server.hosting.playback.currentItem);
        });
    });

    it('sends empty play when all playback ends', async () => {
        await zoneServer({ playbackStartDelay: 0 }, async (server) => {
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

            // queue twice because currently playing doesn't count
            server.hosting.playback.queueMedia(DAY_MEDIA);
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const waiter = client.expect('queue');
            await client.join();
            await waiter;
            const queued = client.local('DAY_MEDIA');

            await expect(queued).rejects.toEqual('timeout');
        });
    });

    it("doesn't queue beyond limit", async () => {
        await zoneServer({ perUserQueueLimit: 0 }, async (server) => {
            const client = await server.client();

            await client.join();
            const queued = client.local('DAY_MEDIA');

            await expect(queued).rejects.toEqual('timeout');
        });
    });

    it('can unqueue own items', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();

            await client.join();
            await client.local('DAY_MEDIA');
            const item = await client.local('TINY_MEDIA');

            await client.unqueue(item);
        });
    });

    it("can't unqueue another's items", async () => {
        await zoneServer({}, async (server) => {
            const client1 = await server.client();
            const client2 = await server.client();

            await client1.join();
            await client2.join();
            await client1.local('DAY_MEDIA');
            const item = await client1.local('TINY_MEDIA');
            const unqueued = client2.unqueue(item);

            await expect(unqueued).rejects.toEqual('timeout');
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

    it('skips with skip command', async () => {
        const password = 'riverdale';
        await zoneServer({ authPassword: 'riverdale' }, async (server) => {
            server.hosting.playback.queueMedia(DAY_MEDIA);

            const client = await server.client();
            await client.join();

            const waiter = client.expect('play');
            client.auth(password);
            client.command('skip');
            await waiter;
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

    it("doesn't skip incorrect video", async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();

            server.hosting.playback.queueMedia(DAY_MEDIA);

            const playWaiter = client.expect('play');
            await client.join();
            await playWaiter;
            const source = 'fake';

            const skip = client.expect('play', IMMEDIATE_REPLY_TIMEOUT);
            client.messaging.send('skip', { source });

            await expect(skip).rejects.toEqual('timeout');
        });
    });

    it('silently ignores skipping nothing', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();

            const skip = client.expect('play', IMMEDIATE_REPLY_TIMEOUT);
            client.skip();

            await expect(skip).rejects.toEqual('timeout');
        });
    });
});

describe('event mode', () => {
    it('prevents non-dj queueing', async () => {
        const authPassword = 'riverdale';
        await zoneServer({ authPassword }, async (server) => {
            const client = await server.client();
            await client.join();
            client.auth(authPassword);
            client.command('mode', ['event']);

            const queued = client.local('DAY_MEDIA');
            await expect(queued).rejects.toEqual('timeout');
        });
    });

    it('allows dj to queue', async () => {
        const authPassword = 'riverdale';
        await zoneServer({ authPassword }, async (server) => {
            const client = await server.client();
            await client.join();
            client.auth(authPassword);
            client.command('mode', ['event']);
            client.command('dj-add', [client.localUser!.name]);

            await client.local('DAY_MEDIA');
        });
    });

    it('prevents former dj queueing', async () => {
        const authPassword = 'riverdale';
        await zoneServer({ authPassword }, async (server) => {
            const client = await server.client();
            await client.join();
            client.auth(authPassword);
            client.command('mode', ['event']);
            client.command('dj-add', [client.localUser!.name]);
            client.command('dj-del', [client.localUser!.name]);

            const queued = client.local('DAY_MEDIA');
            await expect(queued).rejects.toEqual('timeout');
        });
    });
});

describe('media sources', () => {
    it('can queue youtube video', async () => {
        await zoneServer({}, async (server) => {
            const youtube = YOUTUBE_MEDIA[0];

            const client = await server.client({ slowResponseTimeout: 5000 });
            await client.join();
            const item = await client.youtube(youtube.videoId);
            expect(item.media.source).toContain(youtube.source[0]);
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
            const client = await server.client({ slowResponseTimeout: 5000 });
            await client.join();
            await client.lucky('hello');
        });
    });

    test('can queue banger', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client({ slowResponseTimeout: 5000 });
            await client.join();
            const waiter = client.expect('play');
            client.messaging.send('banger', {});
            await waiter;
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
