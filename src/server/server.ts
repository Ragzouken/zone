import * as express from 'express';
import * as expressWs from 'express-ws';
import * as WebSocket from 'ws';
import * as low from 'lowdb';

import Youtube from './youtube';
import Playback, { PlayableMedia, QueueItem, PlayableSource } from './playback';
import Messaging from './messaging';
import { ZoneState, UserId, UserState } from './zone';
import { nanoid } from 'nanoid';
import { archiveOrgToPlayable } from './archiveorg';
import { objEqual, copy } from './utility';
import { MESSAGE_SCHEMAS } from './protocol';

const SECONDS = 1000;

export type HostOptions = {
    listenHandle: any;
    pingInterval: number;
    saveInterval: number;
    userTimeout: number;
    nameLengthLimit: number;
    chatLengthLimit: number;

    perUserQueueLimit: number;
    voteSkipThreshold: number;
    errorSkipThreshold: number;

    joinPassword?: string;
    skipPassword?: string;

    playbackPaddingTime: number;
};

export const DEFAULT_OPTIONS: HostOptions = {
    listenHandle: 0,
    pingInterval: 10 * SECONDS,
    saveInterval: 30 * SECONDS,
    userTimeout: 5 * SECONDS,
    nameLengthLimit: 16,
    chatLengthLimit: 160,

    perUserQueueLimit: 3,
    voteSkipThreshold: 0.6,
    errorSkipThreshold: 0.4,

    playbackPaddingTime: 1 * SECONDS,
};

export function host(adapter: low.AdapterSync, options: Partial<HostOptions> = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    const db = low(adapter);
    db.defaults({
        playback: { current: undefined, queue: [], time: 0 },
        youtube: { videos: [] },
    }).write();

    const xws = expressWs(express());
    const app = xws.app;

    // this zone's websocket endpoint
    app.ws('/zone', (websocket, req) => waitJoin(websocket, req.ip));

    const server = app.listen(opts.listenHandle);

    function ping() {
        xws.getWss().clients.forEach((websocket) => {
            try {
                websocket.ping();
            } catch (e) {
                console.log("couldn't ping", e);
            }
        });
    }

    setInterval(ping, opts.pingInterval);
    setInterval(save, opts.saveInterval);

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
    const connections = new Map<UserId, Messaging>();

    const zone = new ZoneState();
    const playback = new Playback();
    playback.paddingTime = opts.playbackPaddingTime;

    const youtube = new Youtube();

    load();

    playback.on('queue', (item: QueueItem) => sendAll('queue', { items: [item] }));
    playback.on('play', (item: QueueItem) => sendAll('play', { item: sanitiseItem(item) }));
    playback.on('stop', () => sendAll('play', {}));

    playback.on('queue', save);
    playback.on('play', save);

    const skips = new Set<UserId>();
    const errors = new Set<UserId>();
    playback.on('play', () => {
        errors.clear();
        skips.clear();
    });

    function load() {
        playback.loadState(db.get('playback').value());
        youtube.loadState(db.get('youtube').value());
    }

    function save() {
        db.set('playback', playback.copyState()).write();
        db.set('youtube', youtube.copyState()).write();
    }

    const userToConnections = new Map<UserState, Set<Messaging>>();
    function addConnectionToUser(user: UserState, messaging: Messaging) {
        const connections = userToConnections.get(user) || new Set<Messaging>();
        connections.add(messaging);
        userToConnections.set(user, connections);
    }

    function removeConnectionFromUser(user: UserState, messaging: Messaging) {
        userToConnections.get(user)?.delete(messaging);
    }

    function isUserConnectionless(user: UserState) {
        const connections = userToConnections.get(user);
        const connectionless = !connections || connections.size === 0;
        return connectionless;
    }

    function killUser(user: UserState) {
        if (zone.users.has(user.userId)) sendAll('leave', { userId: user.userId });
        zone.users.delete(user.userId);
        connections.delete(user.userId);
        userToConnections.delete(user);
        revokeUserToken(user);
    }

    function voteError(source: PlayableSource, user: UserState) {
        if (!playback.currentItem || !objEqual(source, playback.currentItem.media.source)) return;

        errors.add(user.userId);
        if (errors.size >= Math.floor(zone.users.size * opts.errorSkipThreshold)) {
            skip(`skipping unplayable video ${playback.currentItem.media.details.title}`);
        }
    }

    function voteSkip(source: PlayableSource, user: UserState, password?: string) {
        if (!playback.currentItem || !objEqual(source, playback.currentItem.media.source)) return;

        if (opts.skipPassword && password === opts.skipPassword) {
            playback.skip();
        } else {
            skips.add(user.userId);
            const current = skips.size;
            const target = Math.ceil(zone.users.size * opts.voteSkipThreshold);
            if (current >= target) {
                skip(`voted to skip ${playback.currentItem.media.details.title}`);
            } else {
                sendAll('status', { text: `${current} of ${target} votes to skip` });
            }
        }
    }

    function skip(message?: string) {
        if (message) sendAll('status', { text: message });
        playback.skip();
    }

    function waitJoin(websocket: WebSocket, userIp: unknown) {
        const messaging = new Messaging(websocket);

        messaging.setHandler('join', (message) => {
            messaging.setHandler('join', () => {});

            const resume = message.token && tokenToUser.has(message.token);
            const authorised = resume || !opts.joinPassword || message.password === opts.joinPassword;

            if (!authorised) {
                messaging.send('reject', { text: 'rejected: password required' });
                websocket.close(4000);
                return;
            }

            const token = resume ? message.token : nanoid();
            const user = resume ? tokenToUser.get(token)! : zone.getUser(++lastUserId as UserId);

            addUserToken(user, token);
            addConnectionToUser(user, messaging);

            bindMessagingToUser(user, messaging, userIp);
            connections.set(user.userId, messaging);

            websocket.on('close', (code: number) => {
                removeConnectionFromUser(user, messaging);
                const cleanExit = code === 1000 || code === 1001;

                if (cleanExit) {
                    killUser(user);
                } else {
                    setTimeout(() => {
                        if (isUserConnectionless(user)) killUser(user);
                    }, opts.userTimeout);
                }
            });

            if (resume) {
                // console.log('resume user', user.userId, userIp);
            } else {
                // console.log('new user', user.userId, userIp);
            }

            sendAllState(user);
            sendOnly('assign', { userId: user.userId, token }, user.userId);
            if (!resume) setUserName(user, message.name);
        });
    }

    function sanitiseItem(item: QueueItem) {
        const sanitised = copy(item);
        delete sanitised.info.ip;
        return sanitised;
    }

    function sendCurrent(user: UserState) {
        if (playback.currentItem) {
            const item = sanitiseItem(playback.currentItem);
            sendOnly('play', { item, time: playback.currentTime }, user.userId);
        } else {
            sendOnly('play', {}, user.userId);
        }
    }

    function sendAllState(user: UserState) {
        const users = Array.from(zone.users.values());
        sendOnly('users', { users }, user.userId);
        sendOnly('queue', { items: playback.queue }, user.userId);
        sendCurrent(user);
    }

    function setUserName(user: UserState, name: string) {
        user.name = name.substring(0, opts.nameLengthLimit);
        sendAll('name', { name: user.name, userId: user.userId });
    }

    function bindMessagingToUser(user: UserState, messaging: Messaging, userIp: unknown) {
        messaging.setHandler('heartbeat', () => {
            sendOnly('heartbeat', {}, user.userId);
        });

        messaging.setHandler('chat', (message: any) => {
            let { text } = message;
            text = text.substring(0, opts.chatLengthLimit);
            sendAll('chat', { text, userId: user.userId });
        });

        messaging.setHandler('name', (message: any) => setUserName(user, message.name));

        messaging.setHandler('resync', () => sendCurrent(user));

        async function tryQueueMedia(media: PlayableMedia) {
            const existing = playback.queue.find((queued) => objEqual(queued.media.source, media.source))?.media;
            const count = playback.queue.filter((item) => item.info.ip === userIp).length;

            if (existing) {
                sendOnly('status', { text: `'${existing.details.title}' is already queued` }, user.userId);
            } else if (count >= opts.perUserQueueLimit) {
                sendOnly('status', { text: `you already have ${count} videos in the queue` }, user.userId);
            } else {
                playback.queueMedia(media, { userId: user.userId, ip: userIp });
            }
        }

        async function tryQueueArchiveByPath(path: string) {
            tryQueueMedia(await archiveOrgToPlayable(path));
        }

        async function tryQueueYoutubeById(videoId: string) {
            tryQueueMedia(await youtube.details(videoId));
        }

        messaging.setHandler('youtube', (message: any) => tryQueueYoutubeById(message.videoId));
        messaging.setHandler('archive', (message: any) => tryQueueArchiveByPath(message.path));

        messaging.setHandler('search', (message: any) => {
            youtube.search(message.query).then((results) => {
                if (message.lucky) tryQueueMedia(results[0]);
                else sendOnly('search', { results }, user.userId);
            });
        });

        messaging.setHandler('error', (message: any) => voteError(message.source, user));
        messaging.setHandler('skip', (message: any) => voteSkip(message.source, user, message.password));

        function setSchemaHandler(type: string, handler: (message: any) => void) {
            messaging.setHandler(type, ({ type, ...message }) => {
                const { value, error } = MESSAGE_SCHEMAS.get(type)!.validate(message);
                if (error) {
                    sendOnly('reject', { text: error.details[0].message }, user.userId);
                } else {
                    handler(value);
                }
            });
        }

        setSchemaHandler('avatar', (message: any) => {
            user.avatar = message.data;
            sendAll('avatar', { ...message, userId: user.userId });
        });

        setSchemaHandler('move', (message: any) => {
            user.position = message.position;
            sendAll('move', { ...message, userId: user.userId });
        });

        setSchemaHandler('emotes', (message: any) => {
            user.emotes = message.emotes;
            sendAll('emotes', { ...message, userId: user.userId });
        });
    }

    function sendAll(type: string, message: any) {
        connections.forEach((connection) => connection.send(type, message));
    }

    function sendOnly(type: string, message: any, userId: UserId) {
        connections.get(userId)!.send(type, message);
    }

    return { server, zone, playback, app, save, sendAll };
}
