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

    /*
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
    */
});

describe('join server', () => {
    test('assigns id', async () => {
        await zoneServer({}, async (server) => {
            const client = await server.client();
            await client.join();

            expect(client.localUserId).not.toBeUndefined();
        });
    });

    it('sends user list', async () => {
        await zoneServer({}, async (server) => {
            const name = "baby yoda";
            const client1 = await server.client();
            const client2 = await server.client();
            await client1.join({ name });

            const waitUsers = client2.expect('users');
            await client2.join();
            const { users } = await waitUsers;

            expect(users[0]).toMatchObject({ name });
        });
    });

    test('server sends name on join', async () => {
        await zoneServer({}, async (server) => {
            const name = 'baby yoda 2';
            const client1 = await server.client();
            const client2 = await server.client();

            await client1.join();
            const waiter = client1.expect('user');
            await client2.join({ name });
            const message = await waiter;

            expect(message.name).toEqual(name);
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

        await client1.join();
        await client2.join();

        const waiter = client2.expect('leave');
        await client1.messaging.close();
        const { userId: leftId } = await waiter;

        expect(client1.localUserId).toEqual(leftId);
    });
});
