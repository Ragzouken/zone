import { EventEmitter, once } from 'events';
import { AddressInfo } from 'net';
import * as WebSocket from 'ws';
import Messaging from '../messaging';
import { Server } from 'http';

import * as express from 'express';
import * as expressWs from 'express-ws';

import * as Memory from 'lowdb/adapters/Memory';
import { host, HostOptions } from '../../server/server';
import ZoneClient, { ClientOptions } from '../../common/client';
import Playback from '../../server/playback';
import { Media } from '../zone';
import { DAY_MEDIA, TINY_MEDIA } from './media.data';
import { YoutubeService } from '../../server/youtube';

export const TEST_CLIENT_OPTIONS: Partial<ClientOptions> = {
    quickResponseTimeout: 50,
    slowResponseTimeout: 2000,
    joinName: 'baby yoda',
};

export function timeout(emitter: EventEmitter, event: string, ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
        emitter.once(event, reject);
    });
}

export async function echoServer(options: Partial<{}>, callback: (server: EchoServer) => Promise<void>) {
    const server = new EchoServer(options);
    try {
        await once(server.server, 'listening');
        await callback(server);
    } finally {
        server.dispose();
    }
}

export async function zoneServer(options: Partial<HostOptions>, callback: (server: ZoneServer) => Promise<void>) {
    const server = new ZoneServer(options);
    server.hosting.localLibrary.set('DAY_MEDIA', DAY_MEDIA);
    server.hosting.localLibrary.set('TINY_MEDIA', TINY_MEDIA);
    try {
        await once(server.hosting.server, 'listening');
        await callback(server);
    } finally {
        server.dispose();
    }
}

export class ZoneServer {
    public hosting: { server: Server; playback: Playback; localLibrary: Map<string, Media> };
    private readonly sockets: WebSocket[] = [];

    public get host() {
        const address = this.hosting.server.address() as AddressInfo;
        return `localhost:${address.port}`;
    }

    constructor(options?: Partial<HostOptions>) {
        const xws = expressWs(express());
        const server = xws.app.listen(0);
        this.hosting = { ...host(xws, new Memory(''), new YoutubeService(), options), server };
    }

    public async socket() {
        const socket = new WebSocket(`ws://${this.host}/zone`);
        this.sockets.push(socket);
        await once(socket, 'open');
        return socket;
    }

    public async client(options: Partial<ClientOptions> = {}) {
        options = Object.assign({ urlRoot: 'http://' + this.host }, TEST_CLIENT_OPTIONS, options);
        const client = new ZoneClient(options);
        client.messaging.setSocket(await this.socket());
        return client;
    }

    public dispose() {
        this.sockets.forEach((socket) => socket.close());
        this.hosting.server.close();
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
