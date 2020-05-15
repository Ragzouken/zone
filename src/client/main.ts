import * as blitsy from 'blitsy';
import {
    num2hex,
    rgb2num,
    recolor,
    hslToRgb,
    secondsToTime,
    fakedownToTag,
    eventToElementPixel,
    withPixels,
} from './utility';
import { sleep, randomInt, clamp } from '../common/utility';
import { scriptToPages, PageRenderer, getPageHeight } from './text';
import { loadYoutube, YoutubePlayer } from './youtube';
import { ChatPanel, animatePage } from './chat';
import { UserId } from '../common/zone';

import ZoneClient from '../common/client';
import { YoutubeVideo } from '../server/youtube';
import { init } from './three-test';

window.addEventListener('load', () => load());

export const client = new ZoneClient();

const avatarImage = blitsy.decodeAsciiTexture(
    `
___XX___
___XX___
___XX___
__XXXX__
_XXXXXX_
X_XXXX_X
__X__X__
__X__X__
`,
    'X',
);

const floorTile = blitsy.decodeAsciiTexture(
    `
________
_X_X_X_X
________
__X_____
________
X_X_X_X_
________
_____X__
`,
    'X',
);

const brickTile = blitsy.decodeAsciiTexture(
    `
###_####
###_####
###_####
________
#######_
#######_
#######_
________
`,
    '#',
);

recolor(floorTile);
recolor(brickTile);

const roomBackground = blitsy.createContext2D(128, 128);
drawRoomBackground(roomBackground);

function drawRoomBackground(room: CanvasRenderingContext2D) {
    room.fillStyle = '#001533';
    room.fillRect(0, 0, 128, 128);

    for (let x = 0; x < 16; ++x) {
        for (let y = 0; y < 10; ++y) {
            room.drawImage(brickTile.canvas, x * 8, y * 8);
        }
        for (let y = 10; y < 16; ++y) {
            room.drawImage(floorTile.canvas, x * 8, y * 8);
        }
    }
}

const avatarTiles = new Map<string | undefined, CanvasRenderingContext2D>();
avatarTiles.set(undefined, avatarImage);

function decodeBase64(data: string) {
    const texture: blitsy.TextureData = {
        _type: 'texture',
        format: 'M1',
        width: 8,
        height: 8,
        data,
    };
    return blitsy.decodeTexture(texture);
}

function getTile(base64: string | undefined): CanvasRenderingContext2D {
    if (!base64) return avatarImage;
    let tile = avatarTiles.get(base64);
    if (!tile) {
        try {
            tile = decodeBase64(base64);
            avatarTiles.set(base64, tile);
        } catch (e) {
            console.log('fucked up avatar', base64);
        }
    }
    return tile || avatarImage;
}

const recolorBuffer = blitsy.createContext2D(8, 8);

function recolored(tile: CanvasRenderingContext2D, color: number) {
    recolorBuffer.clearRect(0, 0, 8, 8);
    recolorBuffer.fillStyle = num2hex(color);
    recolorBuffer.fillRect(0, 0, 8, 8);
    recolorBuffer.globalCompositeOperation = 'destination-in';
    recolorBuffer.drawImage(tile.canvas, 0, 0);
    recolorBuffer.globalCompositeOperation = 'source-over';
    return recolorBuffer;
}

function notify(title: string, body: string, tag: string) {
    if ('Notification' in window && Notification.permission === 'granted' && !document.hasFocus()) {
        const notification = new Notification(title, { body, tag, renotify: true, icon: './avatar.png' });
    }
}

const font = blitsy.decodeFont(blitsy.fonts['ascii-small']);
const layout = { font, lineWidth: 240, lineCount: 9999 };

function parseFakedown(text: string) {
    text = fakedownToTag(text, '##', 'shk');
    text = fakedownToTag(text, '~~', 'wvy');
    text = fakedownToTag(text, '==', 'rbw');
    return text;
}

const chat = new ChatPanel();

function getLocalUser() {
    return client.localUserId ? client.zone.getUser(client.localUserId) : undefined;
}

let localName = localStorage.getItem('name') || '';

function rename(name: string) {
    localStorage.setItem('name', name);
    localName = name;
    client.rename(name);
}

function socket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const secure = window.location.protocol.startsWith('https');
        const protocol = secure ? 'wss://' : 'ws://';
        const socket = new WebSocket(protocol + zoneURL);
        socket.addEventListener('open', () => resolve(socket));
        socket.addEventListener('error', reject);
    });
}

let joinPassword: string | undefined;

async function connect(): Promise<void> {
    const joined = !!client.localUserId;

    try {
        client.messaging.setSocket(await socket());
    } catch (e) {
        return connect();
    }

    try {
        await client.join({ name: localName, password: joinPassword });
    } catch (e) {
        chat.status('enter server password with /password)');
        return;
    }

    chat.log('{clr=#00FF00}*** connected ***');
    if (!joined) listHelp();
    listUsers();
}

function listUsers() {
    const named = Array.from(client.zone.users.values()).filter((user) => !!user.name);

    if (named.length === 0) {
        chat.status('no other users');
    } else {
        const names = named.map((user) => user.name);
        const line = names.join('{clr=#FF00FF}, {clr=#FF0000}');
        chat.status(`${names.length} users: {clr=#FF0000}${line}`);
    }
}

const help = [
    'press tab: toggle typing/controls',
    'press q: toggle queue',
    'press 1/2/3: toggle emotes',
    '/youtube url',
    '/search search terms',
    '/lucky search terms',
    '/skip',
    '/avatar',
    '/users',
    '/name',
    '/notify',
    '/volume 100',
    '/resync',
].join('\n');

function listHelp() {
    chat.log('{clr=#FFFF00}? /help\n' + help);
}

function textToYoutubeVideoId(text: string) {
    text = text.trim();
    if (text.length === 11) return text;
    return new URL(text).searchParams.get('v');
}

let youtubePlayer: YoutubePlayer | undefined;
async function getYoutubePlayer() {
    if (!youtubePlayer) {
        const insert = document.getElementById('insert')!;
        const container = document.createElement('div');
        container.id = "youtube";
        container.classList.add('player');
        insert.appendChild(container);

        youtubePlayer = await loadYoutube('youtube', 448, 252);
        youtubePlayer.volume = parseInt(localStorage.getItem('volume') || '100', 10);
        youtubePlayer.on('error', () => client.unplayable('youtube:' + youtubePlayer!.video));
    }

    return youtubePlayer;
}

export async function load() {
    const videoPlayer = document.createElement('video');
    const zoneLogo = document.createElement('img');
    zoneLogo.src = 'zone-logo.png';

    const joinName = document.querySelector('#join-name') as HTMLInputElement;
    const chatInput = document.querySelector('#chat-input') as HTMLInputElement;

    videoPlayer.width = 448;
    videoPlayer.height = 252;

    function setVolume(volume: number) {
        if (youtubePlayer) youtubePlayer.volume = volume;
        videoPlayer.volume = volume / 100;
        localStorage.setItem('volume', volume.toString());
    }

    setVolume(parseInt(localStorage.getItem('volume') || '100', 10));

    joinName.value = localName;

    let currentPlayStart: number | undefined;
    function getCurrentPlayTime() {
        if (!currentPlayStart) return 0;
        return performance.now() - currentPlayStart;
    }

    function getUsername(userId: UserId) {
        return client.zone.getUser(userId).name || userId;
    }

    let showQueue = false;

    client.on('disconnect', async ({ clean }) => {
        if (clean) return;
        await sleep(100);
        await connect();
    });

    client.on('queue', ({ item }) => {
        const { title, duration } = item.media;
        const username = getUsername(item.info.userId ?? 'server');
        const time = secondsToTime(duration / 1000);
        chat.log(`{clr=#00FFFF}+ ${title} (${time}) added by {clr=#FF0000}${username}`);
    });

    let retryTimeout = performance.now();

    videoPlayer.addEventListener('waiting', async () => {
        if (performance.now() < retryTimeout) return;
        retryTimeout = performance.now() + 100;
        console.log('auto resync');
        await client.resync();
    });

    client.on('play', async ({ message }) => {
        if (!message.item) {
            youtubePlayer?.stop();
            videoPlayer.pause();
            videoPlayer.src = '';
            return;
        }
        const { title, duration, source } = message.item.media;
        chat.log(`{clr=#00FFFF}> ${title} (${secondsToTime(duration / 1000)})`);

        const time = message.time || 0;
        currentPlayStart = performance.now() - time;

        const success = await attemptLoadVideo(source, getCurrentPlayTime() / 1000);
        if (!success && source.startsWith('youtube/')) {
            const videoId = source.slice(8);
            (await getYoutubePlayer()).playVideoById(videoId, getCurrentPlayTime() / 1000);
        }
    });

    async function attemptLoadVideo(source: string, seconds: number): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(false), 2000);
            retryTimeout = performance.now() + 100;
            videoPlayer.src = source;
            videoPlayer.currentTime = seconds;
            videoPlayer.play();
            videoPlayer.addEventListener('loadedmetadata', () => resolve(true), { once: true });
        });
    }

    client.on('join', (event) => chat.status(`{clr=#FF0000}${event.user.name} {clr=#FF00FF}joined`));
    client.on('leave', (event) => chat.status(`{clr=#FF0000}${event.user.name}{clr=#FF00FF} left`));
    client.on('status', (event) => chat.status(event.text));

    client.on('avatar', ({ local, data }) => {
        if (local) localStorage.setItem('avatar', data);
    });
    client.on('chat', (message) => {
        const { user, text } = message;
        chat.log(`{clr=#FF0000}${user.name}:{-clr} ${text}`);
        if (!message.local) {
            notify(user.name || 'anonymous', text, 'chat');
        }
    });
    client.on('rename', (message) => {
        if (message.local) {
            chat.status(`you are {clr=#FF0000}${message.user.name}`);
        } else {
            chat.status(`{clr=#FF0000}${message.previous}{clr=#FF00FF} is now {clr=#FF0000}${message.user.name}`);
        }
    });

    setInterval(() => client.heartbeat(), 30 * 1000);

    function move(dx: number, dy: number) {
        const user = getLocalUser()!;

        if (user.position) {
            user.position[0] = clamp(0, 15, user.position[0] + dx);
            user.position[1] = clamp(0, 15, user.position[1] + dy);
        } else {
            user.position = [randomInt(0, 15), 15];
        }

        client.move(user.position);

        if (!user.avatar) {
            // send saved avatar
            const data = localStorage.getItem('avatar');
            if (data) client.avatar(data);
        }
    }

    function playFromSearchResult(args: string) {
        const index = parseInt(args, 10) - 1;

        if (isNaN(index)) chat.status(`did not understand '${args}' as a number`);
        else if (!lastSearchResults || index < 0 || index >= lastSearchResults.length)
            chat.status(`there is no #${index + 1} search result`);
        else client.youtube(lastSearchResults[index].videoId);
    }

    const avatarPanel = document.querySelector('#avatar-panel') as HTMLElement;
    const avatarPaint = document.querySelector('#avatar-paint') as HTMLCanvasElement;
    const avatarUpdate = document.querySelector('#avatar-update') as HTMLButtonElement;
    const avatarCancel = document.querySelector('#avatar-cancel') as HTMLButtonElement;
    const avatarContext = avatarPaint.getContext('2d')!;

    function openAvatarEditor() {
        const avatar = getTile(getLocalUser()!.avatar) || avatarImage;
        avatarContext.clearRect(0, 0, 8, 8);
        avatarContext.drawImage(avatar.canvas, 0, 0);
        avatarPanel.hidden = false;
    }

    avatarPaint.addEventListener('pointerdown', (event) => {
        const scaling = 8 / avatarPaint.clientWidth;
        const [cx, cy] = eventToElementPixel(event, avatarPaint);
        const [px, py] = [Math.floor(cx * scaling), Math.floor(cy * scaling)];
        withPixels(avatarContext, (pixels) => {
            pixels[py * 8 + px] = 0xffffffff - pixels[py * 8 + px];
        });
    });

    avatarUpdate.addEventListener('click', () => {
        client.avatar(blitsy.encodeTexture(avatarContext, 'M1').data);
    });
    avatarCancel.addEventListener('click', () => (avatarPanel.hidden = true));

    let lastSearchResults: YoutubeVideo[] = [];

    const chatCommands = new Map<string, (args: string) => void>();
    chatCommands.set('search', async (query) => {
        ({ results: lastSearchResults } = await client.search(query));
        const lines = lastSearchResults
            .slice(0, 5)
            .map(({ title, duration }, i) => `${i + 1}. ${title} (${secondsToTime(duration / 1000)})`);
        chat.log('{clr=#FFFF00}? queue Search result with /result n\n{clr=#00FFFF}' + lines.join('\n'));
    });
    chatCommands.set('youtube', (args) => {
        const videoId = textToYoutubeVideoId(args)!;
        client.youtube(videoId).catch(() => chat.status("couldn't queue video :("));
    });
    chatCommands.set('local', (path) => client.local(path));
    chatCommands.set('skip', () => client.skip());
    chatCommands.set('password', (args) => (joinPassword = args));
    chatCommands.set('users', () => listUsers());
    chatCommands.set('help', () => listHelp());
    chatCommands.set('result', playFromSearchResult);
    chatCommands.set('lucky', (query) => client.lucky(query));
    chatCommands.set('avatar', (data) => {
        if (data.trim().length === 0) {
            openAvatarEditor();
        } else {
            client.avatar(data);
        }
    });
    chatCommands.set('avatar2', (args) => {
        const ascii = args.replace(/\s+/g, '\n');
        const avatar = blitsy.decodeAsciiTexture(ascii, '1');
        const data = blitsy.encodeTexture(avatar, 'M1').data;
        client.avatar(data);
    });
    chatCommands.set('volume', (args) => setVolume(parseInt(args.trim(), 10)));
    chatCommands.set('resync', () => client.resync());
    chatCommands.set('notify', async () => {
        const permission = await Notification.requestPermission();
        chat.status(`notifications ${permission}`);
    });
    chatCommands.set('name', rename);
    chatCommands.set('archive', (path) => client.messaging.send('archive', { path }));

    chatCommands.set('auth', (password) => client.auth(password));
    chatCommands.set('admin', (args) => {
        const i = args.indexOf(' ');

        if (i >= 0) {
            const name = args.substring(0, i);
            const json = `[${args.substring(i + 1)}]`;
            client.command(name, JSON.parse(json));
        } else {
            client.command(args);
        }
    });

    function toggleEmote(emote: string) {
        const emotes = getLocalUser()!.emotes;
        if (emotes.includes(emote)) client.emotes(emotes.filter((e: string) => e !== emote));
        else client.emotes(emotes.concat([emote]));
    }

    const gameKeys = new Map<string, () => void>();
    gameKeys.set('Tab', () => chatInput.focus());
    gameKeys.set('1', () => toggleEmote('wvy'));
    gameKeys.set('2', () => toggleEmote('shk'));
    gameKeys.set('3', () => toggleEmote('rbw'));
    gameKeys.set('q', () => (showQueue = !showQueue));
    gameKeys.set('ArrowLeft', () => move(-1, 0));
    gameKeys.set('ArrowRight', () => move(1, 0));
    gameKeys.set('ArrowDown', () => move(0, 1));
    gameKeys.set('ArrowUp', () => move(0, -1));

    function sendChat() {
        const line = chatInput.value;
        const slash = line.match(/^\/(\w+)(.*)/);

        if (slash) {
            const command = chatCommands.get(slash[1]);
            if (command) {
                command(slash[2].trim());
            } else {
                chat.status(`no command /${slash[1]}`);
                listHelp();
            }
        } else if (line.length > 0) {
            client.chat(parseFakedown(line));
        }

        chatInput.value = '';
    }

    document.addEventListener('keydown', (event) => {
        const typing = document.activeElement!.tagName === 'INPUT';

        if (typing) {
            if (event.key === 'Tab' || event.key === 'Escape') {
                chatInput.blur();
                event.preventDefault();
            } else if (event.key === 'Enter') {
                sendChat();
            }
        } else if (!typing) {
            const func = gameKeys.get(event.key);
            if (func) {
                func();
                event.stopPropagation();
                event.preventDefault();
            }
        }
    });

    const chatContext = document.querySelector<HTMLCanvasElement>('#chat-canvas')!.getContext('2d')!;
    chatContext.imageSmoothingEnabled = false;

    const sceneContext = document.querySelector<HTMLCanvasElement>('#scene-canvas')!.getContext('2d')!;
    sceneContext.imageSmoothingEnabled = false;

    const pageRenderer = new PageRenderer(256, 256);

    function drawQueue() {
        const lines: string[] = [];
        const cols = 40;
        function line(title: string, seconds: number) {
            const time = secondsToTime(seconds);
            const limit = cols - time.length;
            const cut = title.length < limit ? title.padEnd(limit, ' ') : title.slice(0, limit - 4) + '... ';
            lines.push(cut + time);
        }

        let remaining = 0;

        if (client.zone.lastPlayedItem) {
            if (videoPlayer.src && videoPlayer.currentTime > 0) {
                remaining = videoPlayer.duration - videoPlayer.currentTime;
            } else {
                const duration = client.zone.lastPlayedItem.media.duration;
                const elapsed = performance.now() - currentPlayStart!;
                remaining = Math.max(0, duration - elapsed) / 1000;
            }
        }

        if (client.zone.lastPlayedItem && remaining > 0) line(client.zone.lastPlayedItem.media.title, remaining);

        let total = remaining;

        if (showQueue) {
            client.zone.queue.forEach((item) => {
                line(item.media.title, item.media.duration / 1000);
                total += item.media.duration / 1000;
            });
            line('*** END ***', total);
            lines[lines.length - 1] = '{clr=#FF00FF}' + lines[lines.length - 1];
        }

        const queuePage = scriptToPages(lines.join('\n'), layout)[0];
        animatePage(queuePage);
        pageRenderer.renderPage(queuePage, 0, 0);

        const queueHeight = getPageHeight(queuePage, font);
        chatContext.fillRect(0, 0, 512, queueHeight * 2 + 16);
        chatContext.drawImage(pageRenderer.pageImage, 16, 16, 512, 512);
    }

    function redraw() {
        if (youtubePlayer) youtubePlayer.player.youtube.hidden = !youtubePlayer?.playing;

        chatContext.fillStyle = 'rgb(0, 0, 0)';
        chatContext.fillRect(0, 0, 512, 512);

        chat.render();
        chatContext.drawImage(chat.context.canvas, 0, 0, 512, 512);
        drawQueue();

        window.requestAnimationFrame(redraw);
    }

    redraw();

    setupEntrySplash();

    function connecting() {
        const socket = (client.messaging as any).socket;
        const state = socket ? socket.readyState : 0;

        return state !== WebSocket.OPEN;
    }

    function showLogo() {
        return !client.zone.lastPlayedItem || videoPlayer.src?.endsWith('.mp3');
    }

    init(
        document.getElementById('three-container')!, 
        videoPlayer, 
        brickTile.canvas, 
        floorTile.canvas,
        zoneLogo,
        client.zone,
        getTile,
        connecting,
        showLogo,
    )();
}

function setupEntrySplash() {
    const entrySplash = document.getElementById('entry-splash') as HTMLElement;
    const entryButton = document.getElementById('entry-button') as HTMLInputElement;
    const entryForm = document.getElementById('entry') as HTMLFormElement;
    entryButton.disabled = false;
    entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        entrySplash.hidden = true;
        enter();
    });
}

let zoneURL = '';
async function enter() {
    localName = (document.querySelector('#join-name') as HTMLInputElement).value;
    localStorage.setItem('name', localName);
    const urlparams = new URLSearchParams(window.location.search);
    zoneURL = urlparams.get('zone') || `${window.location.host}/zone`;
    await connect();
}
