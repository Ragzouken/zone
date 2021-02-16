import { once } from 'events';
import { sleep } from '../utility';
import { zoneServer } from './utilities';

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

xdescribe('unclean disconnect', () => {
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

describe('echoes', () => {
    const position = [6, 9, 0];
    const message = 'hello';

    it('can add an echo', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            const initial = client.expect('echoes');
            await client.join();
            await initial;

            const waiter = client.expect('echoes');
            client.echo(position, message);

            const { added, removed } = await waiter;
            expect(added).not.toBe(undefined);
            expect(removed).toBe(undefined);

            const first = added![0];
            expect(first.position).toEqual(position);
            expect(first.text).toEqual(message);
        });
    });

    it('receives existing echoes', async () => {
        await zoneServer({}, async (server) => {
            const client1 = await server.client();
            await client1.join();
            client1.echo(position, message);

            await sleep(100);

            const client2 = await server.client();
            const initial2 = client2.expect('echoes');
            await client2.join();
            const { added, removed } = await initial2;

            expect(added).not.toBe(undefined);
            expect(removed).toBe(undefined);

            const first = added![0];
            expect(first.position).toEqual(position);
            expect(first.text).toEqual(message);
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
