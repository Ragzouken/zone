import { echoServer, timeout } from './utilities';
import { once } from 'events';

describe('messaging', () => {
    it('emits close event when closed', async () => {
        await echoServer({}, async (server) => {
            const messaging = await server.messaging();
            const waiter = once(messaging, 'close');
            await messaging.close();
            await waiter;
        });
    });

    it('emits only one close event', async () => {
        await echoServer({}, async (server) => {
            const messaging = await server.messaging();

            const waiter1 = once(messaging, 'close');
            await messaging.close();
            await waiter1;

            const waiter2 = timeout(messaging, 'close', 100);
            await messaging.close();
            await waiter2;
        });
    });

    it('does not emit close when replacing open socket', async () => {
        await echoServer({}, async (server) => {
            const socket = await server.socket();
            const messaging = await server.messaging();

            const noclose = timeout(messaging, 'close', 100);
            messaging.setSocket(socket);
            await noclose;
        });
    });

    it('emits second close event when second socket closed', async () => {
        await echoServer({}, async (server) => {
            const socket = await server.socket();
            const messaging = await server.messaging();

            const waiter1 = once(messaging, 'close');
            await messaging.close();
            await waiter1;

            messaging.setSocket(socket);

            const waiter2 = once(messaging, 'close');
            await messaging.close();
            await waiter2;
        });
    });

    it('emits error when sending after close', async () => {
        await echoServer({}, async (server) => {
            const messaging = await server.messaging();
            await messaging.close(3000);

            const error = once(messaging, 'error');
            messaging.send('test', {});
            await error;
        });
    });

    it('echoes after reconnect', async () => {
        await echoServer({}, async (server) => {
            const socket = await server.socket();
            const messaging = await server.messaging();
            messaging.on('close', () => messaging.setSocket(socket));

            await messaging.close(3000);
            const waiter = once(messaging.messages, 'test');
            messaging.send('test', {});
            await waiter;
        });
    });
});
