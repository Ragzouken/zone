import * as WebSocket from 'ws';
import * as expressWs from 'express-ws';
import * as low from 'lowdb';

import * as youtube from './youtube';
import Playback, { QueueItem } from './playback';
import Messaging from '../common/messaging';
import { ZoneState, UserId, UserState, mediaEquals, Media } from '../common/zone';
import { nanoid } from 'nanoid';
import { archiveOrgToMedia } from './archiveorg';
import { copy } from '../common/utility';
import { MESSAGE_SCHEMAS } from './protocol';
import { JoinMessage, SendAuth, SendCommand } from '../common/client';

const SECONDS = 1000;

export type HostOptions = {
    pingInterval: number;
    saveInterval: number;
    userTimeout: number;
    nameLengthLimit: number;
    chatLengthLimit: number;

    perUserQueueLimit: number;
    voteSkipThreshold: number;
    errorSkipThreshold: number;

    joinPassword?: string;
    authPassword?: string;

    playbackPaddingTime: number;
};

export const DEFAULT_OPTIONS: HostOptions = {
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

export function host(xws: expressWs.Instance, adapter: low.AdapterSync, options: Partial<HostOptions> = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    const youtubeCache = new youtube.YoutubeCache();

    const db = low(adapter);
    db.defaults({
        playback: { current: undefined, queue: [], time: 0 },
        youtube: { videos: [] },
    }).write();

    // this zone's websocket endpoint
    xws.app.ws('/zone', (websocket, req) => waitJoin(websocket, req.ip));

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
    const authorised = new Set<UserState>();

    const zone = new ZoneState();
    const playback = new Playback();
    playback.paddingTime = opts.playbackPaddingTime;

    let eventMode = false;
    const djs = new Set<UserState>();

    const localLibrary = new Map<string, Media>();

    playback.on('play', cacheYoutubes);
    playback.on('queue', cacheYoutubes);

    load();

    playback.on('queue', (item: QueueItem) => sendAll('queue', { items: [item] }));
    playback.on('play', (item: QueueItem) => sendAll('play', { item: sanitiseItem(item) }));
    playback.on('stop', () => sendAll('play', {}));

    playback.on('queue', save);
    playback.on('play', save);

    function sourceToVideoId(source: string) {
        return source.startsWith('youtube/') ? source.slice(8) : undefined;
    }

    function cacheYoutubes() {
        const item = playback.currentItem;
        
        if (item) {
            const videoId = sourceToVideoId(item.media.source);
            if (videoId) youtubeCache.renewCachedVideo(videoId);
        }

        playback.queue.slice(0, 3).forEach((item) => {
            const videoId = sourceToVideoId(item.media.source);
            if (videoId) youtubeCache.renewCachedVideo(videoId);
        });
    }

    const skips = new Set<UserId>();
    const errors = new Set<UserId>();
    playback.on('play', (item) => {
        errors.clear();
        skips.clear();

        const videoId = sourceToVideoId(item.media.source);
        if (videoId) youtubeCache.renewCachedVideo(videoId);
    });

    function load() {
        playback.loadState(db.get('playback').value());
    }

    function save() {
        db.set('playback', playback.copyState()).write();
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
        authorised.delete(user);
        revokeUserToken(user);
    }

    function voteError(source: string, user: UserState) {
        if (!playback.currentItem || playback.currentItem.media.source !== source) return;

        errors.add(user.userId);
        if (errors.size >= Math.floor(zone.users.size * opts.errorSkipThreshold)) {
            skip(`skipping unplayable video ${playback.currentItem.media.title}`);
        }
    }

    function voteSkip(source: string, user: UserState) {
        if (!playback.currentItem || playback.currentItem.media.source !== source) return;

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

    function waitJoin(websocket: WebSocket, userIp: unknown) {
        const messaging = new Messaging();
        messaging.setSocket(websocket);
        messaging.on('error', () => {});
        messaging.messages.once('join', (message: JoinMessage) => {
            const resume = message.token && tokenToUser.has(message.token);
            const authorised = resume || !opts.joinPassword || message.password === opts.joinPassword;

            if (!authorised) {
                messaging.send('reject', { text: 'rejected: password required' });
                websocket.close(4000);
                return;
            }

            const token = resume ? message.token! : nanoid();
            const user = resume ? tokenToUser.get(token)! : zone.getUser((++lastUserId).toString() as UserId);
            user.name = message.name;

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
            if (!resume) sendAll('user', user);
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

    function ifUser(name: string, action: (user: UserState) => void) {
        const user = userByName(name);
        if (user) action(user);
    }

    function userByName(name: string) {
        return Array.from(zone.users.values()).find((user) => user.name === name);
    }

    function status(text: string, user?: UserState) {
        if (user) sendOnly('status', { text }, user.userId);
        else sendAll('status', { text });
    }

    function statusAuthed(text: string) {
        authorised.forEach((user) => status(text, user));
    }

    const authCommands = new Map<string, (...args: any[]) => void>();
    authCommands.set('skip', () => skip(`admin skipped ${playback.currentItem!.media.title}`));
    authCommands.set('mode', (mode: string) => {
        eventMode = mode === 'event';
        status(`event mode: ${eventMode}`);
    });
    authCommands.set('dj-add', (name: string) =>
        ifUser(name, (user) => {
            djs.add(user);
            status('you are a dj', user);
            statusAuthed(`${user.name} is a dj`);
        }),
    );
    authCommands.set('dj-del', (name: string) =>
        ifUser(name, (user) => {
            djs.delete(user);
            status('no longer a dj', user);
            statusAuthed(`${user.name} no longer a dj`);
        }),
    );

    function bindMessagingToUser(user: UserState, messaging: Messaging, userIp: unknown) {
        function sendUser(type: string, message: any = {}) {
            sendOnly(type, message, user.userId);
        }

        messaging.messages.on('heartbeat', () => sendUser('heartbeat'));

        messaging.messages.on('chat', (message: any) => {
            let { text } = message;
            text = text.substring(0, opts.chatLengthLimit);
            sendAll('chat', { text, userId: user.userId });
        });

        messaging.messages.on('resync', () => sendCurrent(user));

        async function tryQueueMedia(media: Media) {
            if (eventMode && !djs.has(user)) {
                status('zone is currently in event mode, only djs may queue', user);
                return;
            }

            const existing = playback.queue.find((queued) => mediaEquals(queued.media, media))?.media;
            const count = playback.queue.filter((item) => item.info.ip === userIp).length;

            if (existing) {
                status(`'${existing.title}' is already queued`, user);
            } else if (count >= opts.perUserQueueLimit) {
                status(`you already have ${count} videos in the queue`, user);
            } else {
                playback.queueMedia(media, { userId: user.userId, ip: userIp });
            }
        }

        async function tryQueueLocalByPath(path: string) {
            const media = localLibrary.get(path);
            if (media) tryQueueMedia(media);
        }

        async function tryQueueArchiveByPath(path: string) {
            tryQueueMedia(await archiveOrgToMedia(path));
        }

        async function tryQueueYoutubeById(videoId: string) {
            tryQueueMedia(await youtube.media(videoId));
        }

        messaging.messages.on('youtube', (message: any) => tryQueueYoutubeById(message.videoId));
        messaging.messages.on('archive', (message: any) => tryQueueArchiveByPath(message.path));
        messaging.messages.on('local', (message: any) => tryQueueLocalByPath(message.path));

        messaging.messages.on('search', (message: any) => {
            youtube.search(message.query).then(async (results) => {
                if (message.lucky) tryQueueMedia(await youtube.media(results[0].videoId));
                else sendUser('search', { results });
            });
        });

        messaging.messages.on('error', (message: any) => voteError(message.source, user));
        messaging.messages.on('skip', (message: any) => voteSkip(message.source, user));

        messaging.messages.on('user', (changes: Partial<UserState>) => {
            const { value, error } = MESSAGE_SCHEMAS.get('user')!.validate(changes);

            if (error) {
                sendUser('reject', { text: error.details[0].message });
            } else {
                Object.assign(user, value);
                sendAll('user', { ...value, userId: user.userId });
            }
        });

        messaging.messages.on('auth', (message: SendAuth) => {
            if ((message.password || {}) !== opts.authPassword) return;

            authorised.add(user);
            status('you are now authorised', user);
        });

        messaging.messages.on('command', (message: SendCommand) => {
            if (!authorised.has(user)) return;

            const { name, args } = message;
            const command = authCommands.get(name);
            if (command) {
                command(...args);
            } else {
                status(`no command "${name}"`, user);
            }
        });
    }

    function sendAll(type: string, message: any) {
        connections.forEach((connection) => connection.send(type, message));
    }

    function sendOnly(type: string, message: any, userId: UserId) {
        connections.get(userId)!.send(type, message);
    }

    return { zone, playback, save, sendAll, authCommands, localLibrary, youtubeCache };
}
