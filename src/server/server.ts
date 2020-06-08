import * as WebSocket from 'ws';
import * as expressWs from 'express-ws';
import * as low from 'lowdb';

import * as youtube from './youtube';
import Playback from './playback';
import Messaging from '../common/messaging';
import { ZoneState, UserId, UserState, mediaEquals, Media, QueueItem } from '../common/zone';
import { nanoid } from 'nanoid';
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

    playbackStartDelay: number;
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

    playbackStartDelay: 3 * SECONDS,
};

const HALFHOUR = 30 * 60 * 60 * 1000;

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

    xws.app.get('/users', (req, res) => {
        const users = Array.from(zone.users.values());
        const names = users.map((user) => user.name).filter((name) => !!name);
        res.json(names);
    });

    xws.app.get('/youtube', (req, res) => {
        const query = req.query.q;
        if (!query || typeof query !== 'string') {
            res.status(400).send('bad query');
        } else {
            youtube.search(query).then(
                (results) => res.json(results),
                (reason) => res.status(500).send('search failed'),
            );
        }
    });

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
    const connections = new Map<UserId, Messaging>();;

    const zone = new ZoneState();
    const playback = new Playback(opts.playbackStartDelay);

    let eventMode = false;

    const localLibrary = new Map<string, Media>();

    playback.on('play', cacheYoutubes);
    playback.on('queue', cacheYoutubes);

    load();

    playback.on('queue', (item: QueueItem) => sendAll('queue', { items: [item] }));
    playback.on('play', (item: QueueItem) => sendAll('play', { item: sanitiseItem(item), time: playback.currentTime }));
    playback.on('stop', () => sendAll('play', {}));
    playback.on('unqueue', ({ itemId }) => sendAll('unqueue', { itemId }));

    playback.on('queue', save);
    playback.on('unqueue', save);
    playback.on('play', save);

    function sourceToVideoId(source: string) {
        return source.startsWith('youtube/') ? source.slice(8) : undefined;
    }

    setInterval(() => youtubeCache.deleteExpiredCachedVideos(), HALFHOUR);
    function cacheYoutubes() {
        const item = playback.currentItem;

        if (item && item.media.duration < HALFHOUR) {
            const videoId = sourceToVideoId(item.media.source);
            if (videoId) youtubeCache.renewCachedVideo(videoId);
        }

        playback.queue.slice(0, 3).forEach((item) => {
            if (item.media.duration < HALFHOUR) {
                const videoId = sourceToVideoId(item.media.source);
                if (videoId) youtubeCache.renewCachedVideo(videoId);
            }
        });
    }

    const skips = new Set<UserId>();
    playback.on('play', (item) => {
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
        revokeUserToken(user);
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
        zone.users.forEach((user) => {
            if (user.tags.includes('admin')) status(text, user);
        });
    }

    const authCommands = new Map<string, (admin: UserState, ...args: any[]) => void>();
    authCommands.set('skip', () => skip(`admin skipped ${playback.currentItem!.media.title}`));
    authCommands.set('mode', (admin, mode: string) => {
        eventMode = mode === 'event';
        status(`event mode: ${eventMode}`);
    });
    authCommands.set('dj-add', (admin, name: string) =>
        ifUser(name, (user) => {
            if (user.tags.includes('dj')) {
                status(`${user.name} is already a dj`, admin);
            } else {
                user.tags.push('dj');
                sendAll('user', { userId: user.userId, tags: user.tags });
                status('you are a dj', user);
                statusAuthed(`${user.name} is a dj`);
            }
        }),
    );
    authCommands.set('dj-del', (admin, name: string) =>
        ifUser(name, (user) => {
            if (!user.tags.includes('dj')) {
                status(`${user.name} isn't a dj`, admin);
            } else {
                user.tags.splice(user.tags.indexOf('dj'), 1);
                sendAll('user', { userId: user.userId, tags: user.tags });
                status('no longer a dj', user);
                statusAuthed(`${user.name} no longer a dj`);
            }
        }),
    );

    function tryQueueMedia2(user: UserState, media: Media, userIp: unknown) {
        if (eventMode && !user.tags.includes('dj')) {
            status('zone is currently in event mode, only djs may queue', user);
            return;
        }

        const existing = playback.queue.find((queued) => mediaEquals(queued.media, media))?.media;
        const count = playback.queue.filter((item) => item.info.ip === userIp).length;
        const dj = eventMode && user.tags.includes('dj');

        if (existing) {
            status(`'${existing.title}' is already queued`, user);
        } else if (!dj && count >= opts.perUserQueueLimit) {
            status(`you already have ${count} videos in the queue`, user);
        } else {
            playback.queueMedia(media, { userId: user.userId, ip: userIp });
        }
    }

    function bindMessagingToUser(user: UserState, messaging: Messaging, userIp: unknown) {
        function sendUser(type: string, message: any = {}) {
            sendOnly(type, message, user.userId);
        }

        const tryQueueMedia = (media: Media) => tryQueueMedia2(user, media, userIp);

        messaging.messages.on('heartbeat', () => sendUser('heartbeat'));

        messaging.messages.on('chat', (message: any) => {
            let { text } = message;
            text = text.substring(0, opts.chatLengthLimit);
            sendAll('chat', { text, userId: user.userId });
        });

        async function tryQueueLocalByPath(path: string) {
            const media = localLibrary.get(path);
            if (media) tryQueueMedia(media);
        }

        async function tryQueueYoutubeById(videoId: string) {
            tryQueueMedia(await youtube.media(videoId));
        }

        async function tryQueueBanger() {
            tryQueueMedia2(user, await youtube.banger(), userIp);
        }

        messaging.messages.on('youtube', (message: any) => tryQueueYoutubeById(message.videoId));
        messaging.messages.on('local', (message: any) => tryQueueLocalByPath(message.path));
        messaging.messages.on('banger', () => tryQueueBanger());

        messaging.messages.on('lucky', (message: any) => {
            youtube.search(message.query).then(async (results) => {
                tryQueueMedia(await youtube.media(results[0].videoId));
            });
        });

        messaging.messages.on('skip', (message: any) => {
            if (!playback.currentItem || playback.currentItem.media.source !== message.source) return;

            if (!eventMode) {
                voteSkip(message.source, user);
            } else if (user.tags.includes('dj')) {
                skip(`${user.name} skipped ${playback.currentItem!.media.title}`);
            } else {
                status(`can't skip during event mode`, user);
            }
        });

        messaging.messages.on('unqueue', ({ itemId }) => {
            const item = playback.queue.find((item) => item.itemId === itemId);
            if (!item) return;

            const dj = eventMode && user.tags.includes('dj');
            const own = item.info.userId === user.userId;
            const auth = user.tags.includes('admin');

            if (dj || own || auth) playback.unqueue(item);
        });

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

            if (user.tags.includes('admin')) {
                status('you are already authorised', user);
            } else {
                user.tags.push('admin');
                sendAll('user', { userId: user.userId, tags: user.tags });
                status('you are now authorised', user);
            }
        });

        messaging.messages.on('command', (message: SendCommand) => {
            if (!user.tags.includes('admin')) return;

            const { name, args } = message;
            const command = authCommands.get(name);
            if (command) {
                command(user, ...args);
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
