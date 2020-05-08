import { EventEmitter, once } from 'events';
import { AddressInfo } from 'net';
import * as WebSocket from 'ws';
import Messaging from '../messaging';

export function timeout(emitter: EventEmitter, event: string, ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
        emitter.once(event, reject);
    });
}

export async function server(options: Partial<{}>, callback: (server: EchoServer) => Promise<void>) {
    const server = new EchoServer(options);
    try {
        await once(server.server, 'listening');
        await callback(server);
    } finally {
        server.dispose();
    }
}

export class EchoServer {
    public readonly server: WebSocket.Server;
    private readonly sockets: WebSocket[] = [];

    constructor(options?: {}) {
        this.server = new WebSocket.Server({ port: 0 });
        this.server.on('connection', (socket) => socket.on('message', socket.send));
    }

    public async socket() {
        const address = this.server.address() as AddressInfo;
        const socket = new WebSocket(`ws://localhost:${address.port}/zone`);
        this.sockets.push(socket);
        await once(socket, 'open');
        return socket;
    }

    public async messaging() {
        const messaging = new Messaging();
        messaging.setSocket(await this.socket());
        return messaging;
    }

    public dispose() {
        this.sockets.forEach((socket) => socket.close());
        this.server.close();
    }
}
