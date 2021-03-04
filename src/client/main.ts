import * as blitsy from 'blitsy';
import { secondsToTime, fakedownToTag, eventToElementPixel, withPixels, escapeHtml, hslToRgb, rgb2hex } from './utility';
import { sleep } from '../common/utility';
import { ChatPanel } from './chat';

import ZoneClient from '../common/client';
import { Player } from './player';
import { Media, UserState } from '../common/zone';
import { HTMLUI } from './html-ui';
import { createContext2D } from 'blitsy';
import { menusFromDataAttributes, indexByDataAttribute } from './menus';
import { SceneRenderer, avatarImage } from './scene';
import { icons } from './text';
import fetch from 'node-fetch';

window.addEventListener('load', () => load());

export const client = new ZoneClient({ createSocket: socket });
export const htmlui = new HTMLUI();

const avatarTiles = new Map<string | undefined, CanvasRenderingContext2D>();
avatarTiles.set(undefined, avatarImage);
   
const colorCount = 16;
const colors: string[] = [];
for (let i = 0; i < colorCount; ++i) {
    const color = rgb2hex(hslToRgb(i / colorCount, 1, .65) as any);
    colors.push(color);
}

function getUserColor(user: UserState) {
    const i = parseInt(user.userId, 10) % colors.length;
    const color = colors[i];
    return color;
}

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

function notify(title: string, body: string, tag: string) {
    if ('Notification' in window && Notification.permission === 'granted' && !document.hasFocus()) {
        const notification = new Notification(title, { body, tag, renotify: true, icon: './avatar.png' });
    }
}

function parseFakedown(text: string) {
    text = fakedownToTag(text, '##', 'shk');
    text = fakedownToTag(text, '~~', 'wvy');
    text = fakedownToTag(text, '==', 'rbw');
    return text;
}

const chat = new ChatPanel();

function getLocalUser() {
    if (!client.localUserId) {
        // chat.log("{clr=#FF0000}ERROR: no localUserId");
    } else {
        return client.zone.getUser(client.localUserId!);
    }
}

function moveTo(x: number, y: number, z: number) {
    const user = getLocalUser()!;
    x = Math.max(Math.min(15, x), 0);
    y = 0;
    z = Math.max(Math.min(15, z), 0);
    user.position = [x, y, z];
    client.move(user.position);
}

const avatarSlots = new Map<string, CanvasRenderingContext2D>();
const avatarToggles = new Map<string, CanvasRenderingContext2D>();
let activeAvatarSlot = '';

function getInitialAvatar() {
    return localStorage.getItem(localStorage.getItem('avatar-slot-active') || '')
        || localStorage.getItem('avatar');
}

const emoteToggles = new Map<string, Element>();
const getEmote = (emote: string) => emoteToggles.get(emote)?.classList.contains('active');

let localName = localStorage.getItem('name') || '';

function rename(name: string) {
    localStorage.setItem('name', name);
    localName = name;
    client.rename(name);
}

function socket(ticket: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const secure = window.location.protocol.startsWith('https');
        const protocol = secure ? 'wss' : 'ws';
        const socket = new WebSocket(`${protocol}://${window.location.host}/zone/${ticket}`);
        socket.addEventListener('open', () => resolve(socket));
        socket.addEventListener('error', reject);
    });
}

async function connect(): Promise<void> {
    const joined = !!client.localUserId;
    const existing = client.localUser;

    const name = localName;
    const avatar = getInitialAvatar() || undefined;

    try {
        await client.join({ name, avatar });
    } catch (e) {
        console.log("RECONNECT", e);
        await sleep(500);
        return connect();
    }

    // reload page after 2 hours of idling
    detectIdle(2 * 60 * 60 * 1000).then(() => {
        client.messaging.close();
        location.reload();
    });

    chat.log('{clr=#00FF00}*** connected ***');
    if (!joined) listHelp();
    listUsers();

    if (existing) {
        if (existing.position) moveTo(existing.position[0], existing.position[1], existing.position[2]);
        if (existing.emotes) client.emotes(['wvy', 'shk', 'rbw', 'spn'].filter(getEmote));
    }
}

function listUsers() {
    const named = Array.from(client.zone.users.values()).filter((user) => !!user.name);

    if (named.length === 0) {
        chat.status('no other users');
    } else {
        const names = named.map((user) => `{clr=${getUserColor(user)}}${user.name}`);
        const line = names.join('{clr=#FF00FF}, ');
        chat.status(`${names.length} users: ${line}{-clr}`);
    }
}

const help = [
    'use the tabs on the bottom left to queue songs, chat to others, and change your appearance. click or arrow keys to move.',
].join('\n');

function listHelp() {
    chat.log('{clr=#FFFF00}' + help);
}

function textToYoutubeVideoId(text: string) {
    text = text.trim();
    if (text.length === 11) return text;
    return new URL(text).searchParams.get('v');
}

export async function load() {
    htmlui.addElementsInRoot(document.body);
    htmlui.hideAllWindows();

    function setActiveAvatarSlot(active: string) {
        activeAvatarSlot = active;
        
        avatarToggles.forEach((context, name) => {
            context.canvas.classList.toggle('active', name === active);
            if (name === active) {
                avatarContext.clearRect(0, 0, 8, 8);
                avatarContext.drawImage(context.canvas, 0, 0);
                client.avatar(blitsy.encodeTexture(context, 'M1').data).catch(() => {});
            }
        });

        localStorage.setItem('avatar-slot-active', activeAvatarSlot);
    }
    
    function setupAvatarSlots() {
        const toggles = indexByDataAttribute(document.body, "data-avatar-slot");
        toggles.forEach((element, name) => {
            const iconCanvas = element as HTMLCanvasElement;
            const iconContext = iconCanvas.getContext('2d')!;
            avatarToggles.set(name, iconContext);
            element.addEventListener('click', () => setActiveAvatarSlot(name));
    
            const context = createContext2D(8, 8);
            const existing = getTile(localStorage.getItem(name) || localStorage.getItem('avatar') || undefined);

            context.clearRect(0, 0, 8, 8);
            context.drawImage(existing.canvas, 0, 0);
            iconContext.clearRect(0, 0, 8, 8);
            iconContext.drawImage(existing.canvas, 0, 0);
            avatarSlots.set(name, context);
        });
    
        setActiveAvatarSlot(localStorage.getItem('avatar-slot-active') || 'a');
    }
    
    function saveToAvatarSlot(name: string, data: string) {
        const canvas = getTile(data).canvas;

        const slot = avatarSlots.get(name)!;
        slot.clearRect(0, 0, 8, 8);
        slot.drawImage(canvas, 0, 0);

        const toggle = avatarToggles.get(name)!;
        toggle.clearRect(0, 0, 8, 8);
        toggle.drawImage(canvas, 0, 0);
        
        localStorage.setItem(name, data);
        setActiveAvatarSlot(name);
    }

    function mobileHeightFix() {
        const vh = window.innerHeight / 100;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('resize', mobileHeightFix);
    mobileHeightFix();

    const popoutPanel = document.getElementById('popout-panel') as HTMLElement;
    const video = document.createElement('video');
    popoutPanel.appendChild(video);
    document.getElementById('popout-button')?.addEventListener('click', () => (popoutPanel.hidden = false));

    const openButton = document.getElementById('external-button') as HTMLButtonElement;
    openButton.addEventListener('click', () => {
        window.open(player.playingItem?.media.src);
    });

    const player = new Player(video);
    const zoneLogo = document.createElement('img');
    zoneLogo.src = 'zone-logo.png';
    const audioLogo = document.createElement('img');
    audioLogo.src = 'audio-logo.png';

    const joinName = document.querySelector('#join-name') as HTMLInputElement;
    const chatInput = document.querySelector('#chat-input') as HTMLInputElement;

    function setVolume(volume: number) {
        player.volume = volume / 100;
        localStorage.setItem('volume', volume.toString());
    }

    setVolume(parseInt(localStorage.getItem('volume') || '100', 10));

    joinName.value = localName;

    const menuPanel = document.getElementById('menu-panel')!;
    const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;

    const authRow = document.getElementById('auth-row')!;
    const authContent = document.getElementById('auth-content')!;

    volumeSlider.addEventListener('input', () => (player.volume = parseFloat(volumeSlider.value)));
    document.getElementById('menu-button')?.addEventListener('click', openMenu);

    function openMenu() {
        menuPanel.hidden = false;
        volumeSlider.value = player.volume.toString();
    }

    const userItemContainer = document.getElementById('user-items')!;
    const userSelect = document.getElementById('user-select') as HTMLSelectElement;

    function formatNameHTML(user: UserState) {
        const name = escapeHtml(user.name || '');
        const color = getUserColor(user);
        const clas = user.tags.includes('admin') ? 'user-admin'
                   : user.tags.includes('dj') ? 'user-dj'
                   : 'user-normal';

        return `<span class="${clas}" style="color: ${color}">${name}</span>`;
    }

    function formatNameChat(user: UserState, icon=true) {
        const color = getUserColor(user);
        const ico = icon ? ` {icon:${user.userId}}` : "";
        return `{clr=${color}}${user.name}${ico}{-clr}`;
    }

    const iconTest = createContext2D(8, 8);
    iconTest.fillStyle = '#ff00ff';
    iconTest.fillRect(0, 0, 8, 8);

    const userAvatars = new Map<UserState, CanvasRenderingContext2D>();

    function refreshUsers() {
        const users = Array.from(client.zone.users.values()).filter((user) => !!user.name);
        const names = users.map((user) => formatNameHTML(user));
        userItemContainer.innerHTML = `${names.length} people are zoning: ` + names.join(', <br>');

        userAvatars.clear();
        users.forEach((user) => {
            const context = createContext2D(8, 8);
            context.drawImage(getTile(user.avatar).canvas, 0, 0);
            userAvatars.set(user, context);
        });

        userAvatars.forEach((rendering, user) => {
            icons.set(user.userId, rendering.canvas);
        });

        userItemContainer.innerHTML = '';
        userSelect.innerHTML = '';
        users.forEach((user, index) => {
            const option = document.createElement('option');
            option.value = user.name || '';
            option.innerHTML = formatNameHTML(user);
            userSelect.appendChild(option);

            const element = document.createElement('div');
            const label = document.createElement('div');
            label.innerHTML = formatNameHTML(user);
            element.appendChild((userAvatars.get(user) || iconTest).canvas);
            element.appendChild(label);
            userItemContainer.appendChild(element);

            element.addEventListener('click', (event) => {
                event.stopPropagation();
                userSelect.selectedIndex = index;
            });
        });
        userSelect.value = '';

        const auth = !!getLocalUser()?.tags.includes('admin');
        authRow.hidden = auth;
        authContent.hidden = !auth;
    }

    document.getElementById('ban-ip-button')!.addEventListener('click', () => {
        client.command('ban', [userSelect.value]);
    });
    document.getElementById('add-dj-button')!.addEventListener('click', () => {
        client.command('dj-add', [userSelect.value]);
    });
    document.getElementById('del-dj-button')!.addEventListener('click', () => {
        client.command('dj-del', [userSelect.value]);
    });
    document.getElementById('despawn-button')!.addEventListener('click', () => {
        client.command('despawn', [userSelect.value]);
    });
    document.getElementById('event-mode-on')!.addEventListener('click', () => client.command('mode', ['event']));
    document.getElementById('event-mode-off')!.addEventListener('click', () => client.command('mode', ['']));

    const queueItemContainer = document.getElementById('queue-items')!;
    const queueItemTemplate = document.getElementById('queue-item-template')!;
    queueItemTemplate.parentElement!.removeChild(queueItemTemplate);

    const queueTitle = document.getElementById('queue-title')!;
    const currentItemContainer = document.getElementById('current-item')!;
    const currentItemTitle = document.getElementById('current-item-title')!;
    const currentItemTime = document.getElementById('current-item-time')!;

    function refreshCurrentItem() {
        const count = client.zone.queue.length + (player.hasItem ? 1 : 0);
        let total = player.remaining / 1000;
        client.zone.queue.forEach((item) => (total += item.media.duration / 1000));
        queueTitle.innerText = `playlist (${count} items, ${secondsToTime(total)})`;

        skipButton.disabled = false; // TODO: know when it's event mode
        currentItemContainer.hidden = !player.hasItem;
        currentItemTitle.innerHTML = escapeHtml(player.playingItem?.media.title || '');
        currentItemTime.innerHTML = secondsToTime(player.remaining / 1000);

        if (client.zone.lastPlayedItem?.info.userId) {
            const user = client.zone.getUser(client.zone.lastPlayedItem.info.userId);
            currentItemTitle.setAttribute('title', 'queued by ' + user.name);
        }
    }

    const queueElements: HTMLElement[] = [];

    function refreshQueue() {
        queueElements.forEach((item) => item.parentElement!.removeChild(item));
        queueElements.length = 0;

        const user = getLocalUser();
        client.zone.queue.forEach((item) => {
            const element = queueItemTemplate.cloneNode(true) as HTMLElement;
            const titleElement = element.querySelector('.queue-item-title')!;
            const timeElement = element.querySelector('.queue-item-time')!;
            const cancelButton = element.querySelector('.queue-item-cancel') as HTMLButtonElement;

            const cancellable = item.info.userId === user?.userId || user?.tags.includes('dj');
            titleElement.innerHTML = escapeHtml(item.media.title);
            if (item.info.userId) {
                const user = client.zone.getUser(item.info.userId);
                titleElement.setAttribute('title', 'queued by ' + user.name);
            }
            timeElement.innerHTML = secondsToTime(item.media.duration / 1000);
            cancelButton.disabled = !cancellable;
            cancelButton.addEventListener('click', () => client.unqueue(item));

            queueItemContainer.appendChild(element);
            queueElements.push(element);
        });

        refreshCurrentItem();
    }

    document.getElementById('auth-button')!.addEventListener('click', () => {
        const input = document.getElementById('auth-input') as HTMLInputElement;
        client.auth(input.value);
    });

    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchLibrary = document.getElementById('search-library') as HTMLOptionElement;
    const searchSubmit = document.getElementById('search-submit') as HTMLButtonElement;
    const searchResults = document.getElementById('search-results')!;

    searchInput.addEventListener('input', () => (searchSubmit.disabled = searchInput.value.length === 0));

    const searchResultTemplate = document.getElementById('search-result-template')!;
    searchResultTemplate.parentElement?.removeChild(searchResultTemplate);

    // player.on('subtitles', (lines) => lines.forEach((line) => chat.log(`{clr=#888888}${line}`)));

    fetch("/libraries").then((res) => res.json()).then((libraries: string[]) => {
        searchLibrary.innerHTML = "";
        libraries.forEach((library) => {
            const option = document.createElement("option");
            option.textContent = library;
            option.value = library;
            searchLibrary.appendChild(option);
        });
    });
    
    document.getElementById('search-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        event.stopPropagation();

        searchResults.innerText = 'searching...';
        client.searchLibrary(searchLibrary.value, searchInput.value).then((results) => {
            searchResults.innerHTML = '';
            results.forEach(({ title, duration, thumbnail, path }) => {
                const row = searchResultTemplate.cloneNode(true) as HTMLElement;
                row.addEventListener('click', () => {
                    client.queue(path!);
                    menu.open('playback/playlist');
                });

                const div = row.querySelector('div')!;
                const img = row.querySelector('img')!;

                div.innerHTML = escapeHtml(`${title} (${secondsToTime(duration / 1000)})`);
                img.src = thumbnail || '';
                searchResults.appendChild(row);
            });
        });
    });

    client.on('disconnect', async ({ clean }) => {
        if (clean) return;
        await sleep(1000);
        await connect();
    });

    client.on('join', refreshUsers);
    client.on('leave', refreshUsers);
    client.on('rename', refreshUsers);
    client.on('tags', refreshUsers);
    client.on('avatar', refreshUsers);
    client.on('users', refreshUsers);
    refreshUsers();

    client.on('queue', ({ item }) => {
        const { title, duration } = item.media;
        const user = item.info.userId ? client.zone.users.get(item.info.userId) : undefined;
        const username = user ? formatNameChat(user) : 'server';
        const time = secondsToTime(duration / 1000);
        if (item.info.banger) {
            chat.log(
                `{clr=#00FFFF}+ ${title} (${time}) rolled from {clr=#FF00FF}bangers{clr=#00FFFF} by ${username}`,
            );
        } else {
            chat.log(`{clr=#00FFFF}+ ${title} (${time}) added by ${username}`);
        }

        refreshQueue();
    });
    client.on('unqueue', ({ item }) => {
        // chat.log(`{clr=#008888}- ${item.media.title} unqueued`);
        refreshQueue();
    });

    client.on('play', async ({ message: { item, time } }) => {
        if (!item) {
            player.stopPlaying();
        } else {
            player.setPlaying(item, time || 0);

            const { title, duration } = item.media;
            chat.log(`{clr=#00FFFF}> ${title} (${secondsToTime(duration / 1000)})`);
        }
    });

    client.on('join', (event) => chat.status(`${formatNameChat(event.user)} {clr=#FF00FF}joined`));
    client.on('leave', (event) => chat.status(`${formatNameChat(event.user)}{clr=#FF00FF} left`));
    client.on('status', (event) => chat.status(event.text));

    client.on('avatar', ({ local, data }) => {
        if (local) localStorage.setItem('avatar', data);
    });

    function getUserColor(user: UserState) {
        const i = parseInt(user.userId, 10) % colors.length;
        const color = colors[i];
        return color;
    }

    client.on('chat', (message) => {
        const { user, text } = message;
        const name = formatNameChat(user, true);
        chat.log(`${name} ${text}`);
        if (!message.local) {
            notify(user.name || 'anonymous', text, 'chat');
        }
    });
    client.on('rename', (message) => {
        if (message.local) {
            chat.status(`you are ${formatNameChat(message.user)}`);
        } else {
            chat.status(`{clr=#FF0000}${message.previous}{clr=#FF00FF} is now {clr=#FF0000}${message.user.name}`);
        }
    });

    function move(dx: number, dz: number) {
        const user = getLocalUser()!;

        if (user.position) {
            const [px, py, pz] = user.position;
            moveTo(px + dx, py, pz + dz);

            // HACK: when moving, focus + blur chat canvas so that next tab press will take you to the chat input
            const el = chatInput.previousElementSibling as HTMLCanvasElement;
            el.tabIndex = 0;
            el.focus();
            el.blur();
            el.tabIndex = -1;
        }
    }

    async function playFromSearchResult(args: string) {
        const index = parseInt(args, 10) - 1;
        const results = lastSearchResults;

        if (isNaN(index)) chat.status(`did not understand '${args}' as a number`);
        else if (!results || index < 0 || index >= results.length)
            chat.status(`there is no #${index + 1} search result`);
        else return client.queue(results[index].path!);
    }

    document.getElementById('play-banger')?.addEventListener('click', () => client.banger());

    const menu = menusFromDataAttributes(document.documentElement);
    menu.on('show:avatar', openAvatarEditor);
    menu.on('show:playback/playlist', refreshQueue);
    menu.on('show:playback/search', () => {
        searchInput.value = '';
        searchInput.focus();
        searchResults.innerHTML = '';
    });

    const avatarPanel = document.querySelector('#avatar-panel') as HTMLElement;
    const avatarName = document.querySelector('#avatar-name') as HTMLInputElement;
    const avatarPaint = document.querySelector('#avatar-paint') as HTMLCanvasElement;
    const avatarUpdate = document.querySelector('#avatar-update') as HTMLButtonElement;
    const avatarContext = avatarPaint.getContext('2d')!;

    function openAvatarEditor() {
        avatarName.value = getLocalUser()?.name || '';
        /*
        const avatar = getTile(getLocalUser()!.avatar) || avatarImage;
        avatarContext.clearRect(0, 0, 8, 8);
        avatarContext.drawImage(avatar.canvas, 0, 0);
        */
    }

    let painting = false;
    let erase = false;

    function paint(px: number, py: number) {
        withPixels(avatarContext, (pixels) => (pixels[py * 8 + px] = erase ? 0 : 0xffffffff));
    }

    setupAvatarSlots();

    window.addEventListener('pointerup', (event) => {
        if (painting) {
            painting = false;
            event.preventDefault();
            event.stopPropagation();
        }
    });
    avatarPaint.addEventListener('pointerdown', (event) => {
        painting = true;

        const scaling = 8 / avatarPaint.clientWidth;
        const [cx, cy] = eventToElementPixel(event, avatarPaint);
        const [px, py] = [Math.floor(cx * scaling), Math.floor(cy * scaling)];

        withPixels(avatarContext, (pixels) => {
            erase = pixels[py * 8 + px] > 0;
        });

        paint(px, py);

        event.preventDefault();
        event.stopPropagation();
    });
    avatarPaint.addEventListener('pointermove', (event) => {
        if (painting) {
            const scaling = 8 / avatarPaint.clientWidth;
            const [cx, cy] = eventToElementPixel(event, avatarPaint);
            const [px, py] = [Math.floor(cx * scaling), Math.floor(cy * scaling)];
            paint(px, py);
        }
    });

    avatarUpdate.addEventListener('click', () => {
        if (avatarName.value !== getLocalUser()?.name) rename(avatarName.value);
        const data = blitsy.encodeTexture(avatarContext, 'M1').data;
        saveToAvatarSlot(activeAvatarSlot, data);
    });

    let lastSearchResults: Media[] = [];

    const skipButton = document.getElementById('skip-button') as HTMLButtonElement;
    skipButton.addEventListener('click', () => client.skip());
    document.getElementById('resync-button')?.addEventListener('click', () => player.forceRetry('reload button'));

    const quickResync = document.getElementById('resync-button2')!;
    quickResync.addEventListener('click', () => player.forceRetry('resync button'));
    quickResync.hidden = true;

    async function chatSearch(library: string, query?: string, tag?: string) {
        lastSearchResults = await client.searchLibrary(library, query, tag);
        const lines = lastSearchResults
            .slice(0, 5)
            .map(({ title, duration }, i) => `${i + 1}. ${title} (${secondsToTime(duration / 1000)})`);
        chat.log('{clr=#FFFF00}? queue Search result with /result n\n{clr=#00FFFF}' + lines.join('\n'));
    }

    const chatCommands = new Map<string, (args: string) => void | Promise<void>>();
    chatCommands.set('library', (query) => chatSearch("library", query));
    chatCommands.set('tagged', (tag) => chatSearch("library", undefined, tag));
    chatCommands.set('search', (query) => chatSearch("youtube", query));
    chatCommands.set('result', playFromSearchResult);
    chatCommands.set('s', chatCommands.get('search')!);
    chatCommands.set('r', chatCommands.get('result')!);
    chatCommands.set('youtube', async (args) => client.queue("youtube:" + textToYoutubeVideoId(args)!));
    chatCommands.set('skip', () => client.skip());
    chatCommands.set('banger', (tag) => client.banger(tag));
    chatCommands.set('users', () => listUsers());
    chatCommands.set('help', () => listHelp());
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
    chatCommands.set('resync', () => player.forceRetry('user request'));
    chatCommands.set('notify', async () => {
        const permission = await Notification.requestPermission();
        chat.status(`notifications ${permission}`);
    });
    chatCommands.set('name', rename);

    chatCommands.set('auth', async (password) => client.auth(password));
    chatCommands.set('admin', async (args) => {
        const i = args.indexOf(' ');

        if (i >= 0) {
            const name = args.substring(0, i);
            const json = `[${args.substring(i + 1)}]`;
            return client.command(name, JSON.parse(json));
        } else {
            return client.command(args);
        }
    });

    chatCommands.set('echo', (message) => client.echo(getLocalUser()!.position!, message));

    const toggleEmote = (emote: string) => setEmote(emote, !getEmote(emote));
    const setEmote = (emote: string, value: boolean) => {
        emoteToggles.get(emote)!.classList.toggle('active', value);
        client.emotes(['wvy', 'shk', 'rbw', 'spn'].filter(getEmote));
    };

    document.querySelectorAll('[data-emote-toggle]').forEach((element) => {
        const emote = element.getAttribute('data-emote-toggle');
        if (!emote) return;
        emoteToggles.set(emote, element);
        element.addEventListener('click', () => toggleEmote(emote));
    });

    const directions: [number, number][] = [
        [1, 0],
        [0, -1],
        [-1, 0],
        [0, 1],
    ];

    function moveVector(direction: number): [number, number] {
        return directions[direction % 4];
    }

    const gameKeys = new Map<string, () => void>();
    gameKeys.set('1', () => toggleEmote('wvy'));
    gameKeys.set('2', () => toggleEmote('shk'));
    gameKeys.set('3', () => toggleEmote('rbw'));
    gameKeys.set('4', () => toggleEmote('spn'));
    gameKeys.set('ArrowLeft', () => move(...moveVector(2)));
    gameKeys.set('ArrowRight', () => move(...moveVector(0)));
    gameKeys.set('ArrowDown', () => move(...moveVector(3)));
    gameKeys.set('ArrowUp', () => move(...moveVector(1)));

    function toggleMenuPath(path: string) {
        if (!menu.isVisible(path)) menu.open(path);
        else menu.closeChildren('');
    }

    gameKeys.set('u', () => toggleMenuPath('social/users'));
    gameKeys.set('s', () => toggleMenuPath('playback/search'));
    gameKeys.set('q', () => toggleMenuPath('playback/playlist'));
    gameKeys.set('w', () => toggleMenuPath('social'));
    gameKeys.set('e', () => toggleMenuPath('avatar'));

    function sendChat() {
        const line = chatInput.value;
        const slash = line.match(/^\/([^\s]+)\s*(.*)/);

        if (slash) {
            const command = chatCommands.get(slash[1]);
            if (command) {
                const promise = command(slash[2].trim());
                if (promise) promise.catch((error) => chat.status(`${line} failed: ${error.message}`));
            } else {
                chat.status(`no command /${slash[1]}`);
                listHelp();
            }
        } else if (line.length > 0) {
            client.chat(parseFakedown(line));
        }

        chatInput.value = '';
    }

    function isInputElement(element: Element | null): element is HTMLInputElement {
        return element?.tagName === 'INPUT';
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (isInputElement(document.activeElement)) document.activeElement.blur();

            event.preventDefault();
            menu.closeChildren('');
        }

        if (isInputElement(document.activeElement) && event.key !== 'Tab') {
            if (event.key === 'Enter') {
                sendChat();
            }
        } else {
            const func = gameKeys.get(event.key);
            if (func) {
                func();
                event.stopPropagation();
                event.preventDefault();
            }
        }
    });

    const chatContext2 = document.querySelector<HTMLCanvasElement>('#chat-canvas2')!.getContext('2d')!;
    chatContext2.imageSmoothingEnabled = false;

    function clearContext(context: CanvasRenderingContext2D) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }

    setupEntrySplash();

    function connecting() {
        const socket = (client.messaging as any).socket;
        const state = socket ? socket.readyState : 0;

        return state !== WebSocket.OPEN;
    }

    function getStatus() {
        return player.status !== 'playing' ? player.status : undefined;
    }

    const sceneRenderer = new SceneRenderer(client, client.zone, getTile, connecting, getStatus, player);
    const tooltip = document.getElementById('tooltip')!;
    tooltip.hidden = true;

    let mobile = false;
    window.addEventListener("resize", resizeChat);
    function resizeChat() {
        const height = chatContext2.canvas.clientHeight;
        chatContext2.canvas.height = height;
        chatContext2.imageSmoothingEnabled = false;
        chat.height = Math.ceil(height / 2);
        mobile = window.getComputedStyle(document.documentElement).getPropertyValue('--mobile').trim() === '1';
    }
    resizeChat();

    function redraw() {
        window.requestAnimationFrame(redraw);

        quickResync.hidden = !player.problem;

        refreshCurrentItem();
        clearContext(chatContext2);

        if (chat.height !== 0) {
            chat.render(!mobile);
            chatContext2.drawImage(chat.context.canvas, 0, 0, 512, chat.height * 2);
        }

        const logo = player.hasItem ? audioLogo : undefined;
        sceneRenderer.mediaElement = popoutPanel.hidden && player.hasVideo ? video : logo;

        sceneRenderer.render();
    }

    redraw();

    sceneRenderer.on('click', (event, [tx, tz]) => {
        const objectCoords = `${tx},0,${tz}`;

        const echoes = Array.from(client.zone.echoes)
            .map(([, echo]) => echo)
            .filter((echo) => echo.position!.join(',') === objectCoords);

        if (echoes.length > 0) {
            chat.log(`{clr=#808080}"${parseFakedown(echoes[0].text)}"`);
        } else if (tx >= 0 && tz >= 0 && tx < 16 && tz < 16) {
            moveTo(tx, 0, tz);
        }
    });

    sceneRenderer.on('hover', (event, [tx, tz]) => {
        const objectCoords = `${tx},0,${tz}`;

        const users = Array.from(client.zone.users.values()).filter(
            (user) => user.position?.join(',') === objectCoords,
        );
        const echoes = Array.from(client.zone.echoes)
            .map(([, echo]) => echo)
            .filter((echo) => echo.position!.join(',') === objectCoords);

        const names = [
            ...users.map((user) => formatNameHTML(user)),
            ...echoes.map((echo) => 'echo of ' + formatNameHTML(echo)),
        ];

        tooltip.hidden = names.length === 0;
        tooltip.innerHTML = names.join(', ');
        const [ttx, tty] = eventToElementPixel(event, tooltip.parentElement?.parentElement!);
        tooltip.style.left = ttx + 'px';
        tooltip.style.top = tty + 'px';
    });

    sceneRenderer.on('unhover', (event) => {
        tooltip.hidden = true;
    });
}

function createAvatarElement(avatar: string) {
    const context = createContext2D(8, 8);
    context.drawImage(getTile(avatar).canvas, 0, 0);
    return context.canvas;
}

function setupEntrySplash() {
    const zone = document.getElementById('zone') as HTMLElement;
    const nameInput = document.querySelector('#join-name') as HTMLInputElement;
    const entrySplash = document.getElementById('entry-splash') as HTMLElement;
    const entryUsers = document.getElementById('entry-users') as HTMLParagraphElement;
    const entryButton = document.getElementById('entry-button') as HTMLInputElement;
    const entryForm = document.getElementById('entry') as HTMLFormElement;

    function refreshUsers(users: { name?: string; avatar?: string, userId: string }[]) {
        entryUsers.innerHTML = '';
        users.forEach((user) => {
            const element = document.createElement('div');
            const label = document.createElement('div');
            const hex = getUserColor(user as any);
            label.innerHTML = `<span style="color: ${hex}">` + escapeHtml(user.name || 'anonymous') + "</span>";
            element.appendChild(createAvatarElement(user.avatar || 'GBgYPH69JCQ='));
            element.appendChild(label);
            entryUsers.appendChild(element);
        });
    }

    function updateEntryUsers() {
        if (entrySplash.hidden) return;

        fetch('./users')
            .then((res) => res.json())
            .then((users: { name?: string; avatar?: string, userId: string }[]) => {
                if (users.length === 0) {
                    entryUsers.innerHTML = 'zone is currenty empty';
                } else {
                    refreshUsers(users);
                }
            });
    }
    updateEntryUsers();
    setInterval(updateEntryUsers, 5000);

    entryButton.disabled = !entryForm.checkValidity();
    nameInput.addEventListener('input', () => (entryButton.disabled = !entryForm.checkValidity()));
    zone.hidden = true;

    entryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        (document.getElementById('entry-sound') as HTMLAudioElement).play();
        entrySplash.hidden = true;
        zone.hidden = false;
        window.dispatchEvent(new Event('resize')); // trigger a resize to update renderer
        localName = nameInput.value;
        localStorage.setItem('name', localName);
        await connect();
    });
}

async function detectIdle(limit: number) {
    return new Promise((resolve, reject) => {
        let t = 0;
        window.addEventListener('pointermove', resetTimer);
        window.addEventListener('keydown', resetTimer);

        function resetTimer() {
            clearTimeout(t);
            t = window.setTimeout(resolve, limit);
        }
    });
}
