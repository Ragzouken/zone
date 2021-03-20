import * as expressWs from 'express-ws';
import * as low from 'lowdb';

import Playback from './playback';
import { ZoneState, UserId, UserState, Media, QueueItem, UserEcho } from './zone';
import { nanoid } from 'nanoid';
import { json, NextFunction, Request, Response } from 'express';
import { Library, libraryToQueueableMedia } from './libraries';
import { URL } from 'url';
import Joi = require('joi');
import WebSocket = require('ws');

const SECONDS = 1000;

declare global {
    namespace Express {
        interface Request {
            user?: UserState;
            ticket?: Ticket;
        }
    }
}

export type Ticket = { name: string, avatar: string, token: string, userId: string };

export type HostOptions = {
    pingInterval: number;
    nameLengthLimit: number;
    chatLengthLimit: number;

    perUserQueueLimit: number;
    voteSkipThreshold: number;

    authPassword?: string;

    queueCheckInterval: number;
    libraries: Map<string, Library>;
};

export const DEFAULT_OPTIONS: HostOptions = {
    pingInterval: 10 * SECONDS,
    nameLengthLimit: 16,
    chatLengthLimit: 160,

    perUserQueueLimit: 3,
    voteSkipThreshold: 0.6,

    queueCheckInterval: 5 * SECONDS,
    libraries: new Map(),
};

const bans = new Map<unknown, Ban>();

interface Ban {
    ip: unknown;
    bannee: string;
    banner: string;
    reason?: string;
    date: string;
}

export function host(
    xws: expressWs.Instance,
    adapter: low.AdapterSync,
    options: Partial<HostOptions> = {},
) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    const db = low(adapter);
    db.defaults({
        playback: { current: undefined, queue: [], time: 0 },
        bans: [],
        echoes: [],
    }).write();

    function pingAll() {
        xws.getWss().clients.forEach((ws) => ws.ping(undefined, undefined, () => {}));
    }

    setInterval(pingAll, opts.pingInterval);
    setInterval(checkQueue, opts.queueCheckInterval);

    async function checkQueue() {
        const checks = playback.queue.map(async (item) => {
            const library = opts.libraries.get(item.media.library || "");

            if (library) {
                const mediaStatus = await library.getStatus(item.media.mediaId);
                
                if (mediaStatus === 'failed') {
                    playback.unqueue(item);
                    console.log("FAILED", library.prefix, item.media.mediaId, mediaStatus);
                    status(`failed to load "${item.media.title}" (${mediaStatus})`);
                } else if (mediaStatus === 'none') {
                    library.request(item.media.mediaId);
                }
            }
        });
        return Promise.all(checks);
    }

    function addUserToken(user: UserState, token: string) {
        tokenToUser.set(token, user);
        userToToken.set(user, token);
    }

    function revokeUserToken(user: UserState) {
        const token = userToToken.get(user);
        if (token) tokenToUser.delete(token);
        userToToken.delete(user);
    }

    let lastUserId = 0;
    const tokenToUser = new Map<string, UserState>();
    const userToToken = new Map<UserState, string>();
    const userToIp = new Map<UserState, unknown>();
    const sockets = new Map<UserId, WebSocket>();

    const zone = new ZoneState();
    const playback = new Playback(opts.libraries);

    let eventMode = false;

    function requireNotBanned(
        request: Request,
        response: Response,
        next: NextFunction,
    ) {
        if (bans.has(request.ip)) {
            response.status(403).send("you are banned");
        } else {
            next();
        }
    }

    function requireUserToken(
        request: Request, 
        response: Response, 
        next: NextFunction,
    ) {
        const auth = request.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.substr(7) : "";
        request.user = tokenToUser.get(token);

        if (request.user) {
            next();
        } else {
            response.status(401).send("invalid user");
        }
    }

    const tickets = new Map<string, Ticket>();

    xws.app.use(json());
    xws.app.use(requireNotBanned);
    xws.app.post('/zone/join', (request, response) => {
        const { name, avatar } = request.body;
        const ticket = nanoid();
        const token = nanoid();
        const userId = (++lastUserId).toString();
        tickets.set(ticket, { name, avatar, token, userId });
        setTimeout(() => tickets.delete(ticket), 60 * SECONDS);
        response.json({ ticket, token, userId });
    });

    xws.app.param('ticket', (request, response, next, id) => {
        request.ticket = tickets.get(id);
        
        if (request.ticket) {
            tickets.delete(id);
            next();
        } else {
            response.status(404).send();
        }
    });

    xws.app.ws('/zone/:ticket', async (websocket, request) => {        
        const { name, avatar, token, userId } = request.ticket!;

        const user = zone.addUser(userId);
        user.name = name;
        user.avatar = avatar;

        sendAll('user', user);

        addUserToken(user, token);
        userToIp.set(user, request.ip);

        bindSocketToUser(user, websocket);

        websocket.on('error', (error) => killUser(user));
        websocket.on('close', (code: number) => killUser(user));

        const users = Array.from(zone.users.values());
        sendOnly('users', { users }, user.userId);
        sendOnly('queue', { items: playback.queue }, user.userId);
        sendOnly('play', { item: playback.currentItem, time: playback.currentTime }, user.userId);
        sendOnly('echoes', { added: Array.from(zone.echoes).map(([, echo]) => echo) }, user.userId);
        sendOnly("ready", {}, user.userId);
    });

    xws.app.get('/users', (req, res) => {
        const users = Array.from(zone.users.values());
        const names = users.map(({ name, avatar, userId }) => ({ name, avatar, userId }));
        res.json(names);
    });

    xws.app.get('/queue', (request, response) => response.json(playback.queue));
    xws.app.post('/queue', requireUserToken, async (request, response) => {
        try {
            const media = await pathToMedia(request.body.path);
            tryQueueMedia(request.user!, media);
            response.status(202).send();
        } catch (error) {
            response.status(400).send(error.message);
        }
    });

    xws.app.post('/queue/banger', requireUserToken, async (request, response) => {
        if (!opts.libraries.has("library")) {
            response.status(501).send();
        } else {
            const banger = await libraryTagToBanger(request.body.tag);
        
            if (banger) {
                try {
                    tryQueueMedia(request.user!, banger, true);
                    response.status(202).send();
                } catch (error) {
                    response.status(403).send(error.message);
                }
            } else {
                response.status(503).send("no matching bangers");
            }
        }
    });

    xws.app.post('/queue/skip', requireUserToken, async (request, response) => {
        const user = request.user!;
        const itemId = request.body.itemId;

        if (!playback.currentItem || playback.currentItem.itemId !== itemId) {
            response.status(404).send(`queue item ${itemId} is not playing`);
        } else if (!eventMode) {
            voteSkip(itemId, user);
            response.status(202).send();
        } else if (user.tags.includes('dj')) {
            skip(`${user.name} skipped ${playback.currentItem!.media.title}`);
            response.status(204).send();
        } else {
            response.status(403).send("can't skip during event mode");
        }
    });

    xws.app.delete('/queue/:itemId', requireUserToken, async (request, response) => {
        const user = request.user!;
        const itemId = parseInt(request.params.itemId, 10);
        
        const item = playback.queue.find((item) => item.itemId === itemId);
        if (!item) {
            response.status(404).send();
        } else {
            const dj = eventMode && user.tags.includes('dj');
            const own = item.info.userId === user.userId;
            const auth = user.tags.includes('admin');
    
            if (dj || own || auth) {
                playback.unqueue(item);
                response.status(204).send();
            } else {
                response.status(403).send();
            }
        }
    });

    xws.app.post('/echoes', requireUserToken, (request, response) => {
        const user = request.user!;
        const { text, position } = request.body;

        const admin = !!zone.echoes.get(position)?.tags.includes('admin');
        const valid = !admin || user.tags.includes('admin');

        if (!valid) {
            response.status(403).send("can't remove admin echo");
        } else if (text.length > 0) {
            const echo = { ...user, position, text: text.slice(0, 512) };
            zone.echoes.set(position, echo);
            sendAll('echoes', { added: [echo] });
            response.status(201).send();
        } else {
            zone.echoes.delete(position);
            sendAll('echoes', { removed: [position] });
            response.status(201).send();
        }
    });

    xws.app.post('/admin/authorize', requireUserToken, async (request, response) => {
        const user = request.user!;

        if (!opts.authPassword) {
            response.status(501).send();
        } else if (request.body.password !== opts.authPassword) {
            response.status(403).send();
        } else {
            if (user.tags.includes('admin')) {
                status('you are already authorised', user);
                response.status(200).send();
            } else {
                user.tags.push('admin');
                sendAll('user', { userId: user.userId, tags: user.tags });
                status('you are now authorised', user);
                response.status(200).send();
            }
        }
    });

    xws.app.post('/admin/command', requireUserToken, async (request, response) => {
        const user = request.user!;

        if (!user.tags.includes('admin')) {
            response.status(403).send("you are not authorized");
        } else {
            const { name, args } = request.body;
            const command = authCommands.get(name);
            if (command) {
                try {
                    await command(user, ...args);
                    response.status(202).send();
                } catch (error) {
                    response.status(503).send(error);
                }
            } else {
                response.status(501).send(`no command "${name}"`);
            }
        }
    });

    load();

    xws.app.get('/libraries', async (request, response) => response.json(Array.from(opts.libraries.keys())));
    xws.app.get('/libraries/:prefix', async (request, response) => {
        const prefix = request.params.prefix;
        const library = opts.libraries.get(prefix);
        const query = new URL(request.url, "http://localhost").search;

        if (library) {
            response.json(await library.search(query));
        } else {
            response.status(404).send(`no library "${prefix}"`);
        }
    });

    async function pathToMedia(path: string) {
        const parts = path.split(":");
        const prefix = parts.shift()!;
        const mediaId = parts.join(":");
        const library = opts.libraries.get(prefix);

        if (library) {
            return libraryToQueueableMedia(library, mediaId);
        } else {
            throw new Error(`no library "${prefix}"`);
        }
    }

    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    async function libraryTagToBanger(tag: string | undefined) {
        const EIGHT_MINUTES = 8 * 60 * SECONDS;
        const library = await opts.libraries.get("library")!.search(tag ? "?tag=" + tag : "");
        const extras = library.filter((media: any) => media.duration <= EIGHT_MINUTES);
        const banger = extras[randomInt(0, extras.length - 1)];

        return banger;
    }

    playback.on('queue', (item: QueueItem) => sendAll('queue', { items: [item] }));
    playback.on('play', (item: QueueItem) => sendAll('play', { item, time: playback.currentTime }));
    playback.on('stop', () => sendAll('play', {}));
    playback.on('unqueue', ({ itemId }) => sendAll('unqueue', { itemId }));
    playback.on('failed', (item: QueueItem) => skip("video failed to load"));

    const skips = new Set<UserId>();
    playback.on('play', async (item) => skips.clear());

    function load() {
        playback.loadState(db.get('playback').value());

        const banlist = db.get('bans').value() as Ban[];
        banlist.forEach((ban) => bans.set(ban.ip, ban));

        zone.echoes.clear();
        const echoes = db.get('echoes').value() as UserEcho[];
        echoes.forEach((echo) => zone.echoes.set(echo.position!, echo));
    }

    function save() {
        db.set('playback', playback.copyState()).write();
        db.set('bans', Array.from(bans.values())).write();
        db.set(
            'echoes',
            Array.from(zone.echoes).map(([, echo]) => echo),
        ).write();
    }

    function killUser(user: UserState) {
        sockets.get(user.userId)?.close(4001);
        sockets.delete(user.userId);
        revokeUserToken(user);

        if (zone.users.delete(user.userId)) {
            sendAll('leave', { userId: user.userId });
        }
    }

    function voteSkip(itemId: number, user: UserState) {
        if (!playback.currentItem || playback.currentItem.itemId !== itemId) return;

        skips.add(user.userId);
        const current = skips.size;
        const target = Math.ceil(zone.users.size * opts.voteSkipThreshold);
        if (current >= target) {
            skip(`voted to skip ${playback.currentItem.media.title}`);
        } else {
            status(`${current} of ${target} votes to skip`);
        }
    }

    function skip(message?: string) {
        if (message) status(message);
        playback.skip();
    }

    function ifUser(name: string): Promise<UserState> {
        return new Promise((resolve, reject) => {
            const users = Array.from(zone.users.values());
            const user = users.find((user) => user.name === name);
            if (user) resolve(user);
            else reject(`no user "${name}"`);
        });
    }

    function status(text: string, user?: UserState) {
        if (user) sendOnly('status', { text }, user.userId);
        else sendAll('status', { text });
    }

    function statusAuthed(text: string) {
        zone.users.forEach((user) => {
            if (user.tags.includes('admin')) status(text, user);
        });
    }
    
    function tryQueueMedia(user: UserState, media: Media, banger = false) {
        if (eventMode && !user.tags.includes('dj')) {
            throw new Error('only djs may queue during event mode');
        }

        const userIp = userToIp.get(user);
        const existing = playback.queue.find((queued) => queued.media.src === media.src)?.media;
        const count = playback.queue.filter((item) => item.info.ip === userIp).length;
        const dj = eventMode && user.tags.includes('dj');

        if (existing) {
            throw new Error(`'${existing.title}' is already queued`);
        } else if (!dj && count >= opts.perUserQueueLimit) {
            throw new Error(`you already have ${count} videos in the queue`);
        } else {
            playback.queueMedia(media, { userId: user.userId, ip: userIp, banger });
        }
    }

    const USER_SCHEMA = Joi.object({
        name: Joi.string().min(1).max(32),
        avatar: Joi.string().base64(),
        emotes: Joi.array().items(Joi.string().valid('shk', 'wvy', 'rbw', 'spn')),
        position: Joi.array().ordered(Joi.number().required(), Joi.number().required(), Joi.number().required()),
    });

    const messageHandlers = new Map<string, (sender: UserState, message: any) => void>();

    messageHandlers.set('chat', (sender, chat) => {
        const text = chat.text.substring(0, opts.chatLengthLimit);
        sendAll('chat', { text, userId: sender.userId });
    });

    messageHandlers.set('user', (sender, changes: Partial<UserState>) => {
        const { value, error } = USER_SCHEMA.validate(changes);

        if (error) {
            sendOnly('reject', { text: error.details[0].message }, sender.userId);
        } else {
            Object.assign(sender, value);
            sendAll('user', { ...value, userId: sender.userId });
        }
    });

    function bindSocketToUser(user: UserState, socket: WebSocket) {
        sockets.set(user.userId, socket);

        socket.on("message", (data: string) => {
            const { type, ...message } = JSON.parse(data);
            const handler = messageHandlers.get(type)!;
            handler(user, message);
        });
    }

    function sendMessage(websocket: WebSocket, type: string, message: any) {
        websocket.send(JSON.stringify({ type, ...message }), () => {});
    }

    function sendAll(type: string, message: any) {
        sockets.forEach((connection) => sendMessage(connection, type, message));
    }

    function sendOnly(type: string, message: any, userId: UserId) {
        sendMessage(sockets.get(userId)!, type, message);
    }

    const authCommands = new Map<string, (admin: UserState, ...args: any[]) => void>();
    authCommands.set('ban', (admin, name: string, reason?: string) =>
        ifUser(name).then((user) => {
            const ban: Ban = {
                ip: userToIp.get(user)!,
                bannee: user.name!,
                banner: admin.name!,
                reason,
                date: JSON.stringify(new Date()),
            };
            bans.set(ban.ip, ban);
            status(`${user.name} is banned`);
            killUser(user);
        })
    );
    authCommands.set('skip', () => skip(`admin skipped ${playback.currentItem!.media.title}`));
    authCommands.set('mode', (admin, mode: string) => {
        eventMode = mode === 'event';
        status(`event mode: ${eventMode}`);
    });
    authCommands.set('dj-add', (admin, name: string) =>
        ifUser(name).then((user) => {
            if (user.tags.includes('dj')) {
                status(`${user.name} is already a dj`, admin);
            } else {
                user.tags.push('dj');
                sendAll('user', { userId: user.userId, tags: user.tags });
                status('you are a dj', user);
                statusAuthed(`${user.name} is a dj`);
            }
        })
    );
    authCommands.set('dj-del', (admin, name: string) =>
        ifUser(name).then((user) => {
            if (!user.tags.includes('dj')) {
                status(`${user.name} isn't a dj`, admin);
            } else {
                user.tags.splice(user.tags.indexOf('dj'), 1);
                sendAll('user', { userId: user.userId, tags: user.tags });
                status('no longer a dj', user);
                statusAuthed(`${user.name} no longer a dj`);
            }
        })
    );
    authCommands.set('despawn', (admin, name: string) => 
        ifUser(name).then((user) => {
            if (!user.position) {
                status(`${user.name} isn't spawned`, admin);
            } else {
                user.position = undefined;
                sendAll('user', { userId: user.userId, position: null });
                status('you were despawned by an admin', user);
                statusAuthed(`${user.name} has been despawned`);
            }
        })
    );

    return { save, sendAll, zone, playback };
}
