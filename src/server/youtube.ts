import { performance } from 'perf_hooks';

import * as ytdl from 'ytdl-core';
import ytsr = require('ytsr');
import * as ytpl from 'ytpl';

import { timeToSeconds } from '../common/utility';
import { Media, MediaMeta } from '../common/zone';
import { createWriteStream } from 'fs';
import { once } from 'events';
import { URL } from 'url';
import { randomInt } from '../common/utility';
import * as tmp from 'tmp';
import { unlink } from 'fs';
import { BADNAME } from 'dns';
import { env } from 'process';

tmp.setGracefulCleanup();

async function getCacheFile(prefix: string, postfix: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            discardDescriptor: true,
            mode: 0o644,
            prefix,
            postfix,
        };

        tmp.file(options, (err, path, _, remove) => {
            if (err) reject(err);
            resolve(path);
        });
    });
}

export type YoutubeVideo = MediaMeta & { videoId: string };

const TIMEOUT = 30 * 60 * 1000;

const infoCache = new Map<string, { info: Promise<ytdl.videoInfo>; expires: number }>();

async function getCachedInfo(videoId: string) {
    const entry = infoCache.get(videoId);

    if (entry && entry.expires > performance.now()) {
        return await entry.info;
    } else {
        const attempt = ytdl.getInfo(videoId);
        infoCache.set(videoId, { info: attempt, expires: performance.now() + TIMEOUT });

        const info = await attempt;
        const valid = checkValid(info);

        if (!valid) {
            console.log(`NO FORMAT: ${videoId}`);
        }

        return info;
    }
}

export async function info(videoID: string) {
    return getCachedInfo(videoID);
}

export async function direct(videoId: string): Promise<string> {
    const info = await getCachedInfo(videoId);
    const format = getFormat(info);
    return format.url;
}

export async function media(videoId: string): Promise<Media> {
    const videoInfo = await getCachedInfo(videoId);
    const duration = parseInt(videoInfo.videoDetails.lengthSeconds, 10) * 1000;
    const source = 'youtube/' + videoId;

    if (!checkValid(videoInfo)) {
        throw Error(`NO FORMAT FOR ${videoId}`);
    }

    return { title: videoInfo.videoDetails.title, duration, source };
}

export async function search(query: string): Promise<YoutubeVideo[]> {
    const results = await ytsr(query, { limit: 15 });
    const videos = results.items.filter((item) => item.type === 'video' && !(item as any).live).slice(0, 5);
    return videos.map((item) => {
        const videoId = new URL(item.link).searchParams.get('v')!;
        const duration = timeToSeconds(item.duration) * 1000;
        const title = item.title;
        const thumbnail = item.thumbnail;

        return { videoId, title, duration, thumbnail };
    });
}

let BANGERS: Media[] = [];
const BANGER_PLAYLIST_ID = 'PLUkMc2z58ECZFcxvdwncKK1qDYZzVHrbB';
async function refreshBangers() {
    if (process.env.IGNORE_YOUTUBE_BANGERS) return;

    const results = await ytpl(BANGER_PLAYLIST_ID, { limit: Infinity });
    BANGERS = results.items.map((chosen) => {
        const videoId = new URL(chosen.url).searchParams.get('v')!;
        const duration = timeToSeconds(chosen.duration) * 1000;
        const source = 'youtube/' + videoId;

        return { title: chosen.title, duration, source };
    })
}

if (!process.env.IGNORE_YOUTUBE_BANGERS) {
    refreshBangers();
    setInterval(refreshBangers, 24 * 60 * 60 * 1000);
} else {
    console.log("IGNORING YOUTUBE BANGERS");
}

export async function banger(extra: Media[] = []): Promise<Media> {
    const options = [...BANGERS!, ...extra];
    return options[randomInt(0, options.length - 1)];
}

type CachedVideo = {
    videoId: string;
    path: string;
    expires: number;
};

export function checkValid(info: ytdl.videoInfo) {
    try {
        getFormat(info);
        return true;
    } catch (e) {
        console.log('no format from', info.formats.map((format) => format.itag));
        return false; 
    }
}

function getFormat(info: ytdl.videoInfo) {
    return ytdl.chooseFormat(info.formats, { quality: 'lowest', filter: f => f.hasAudio && f.hasVideo && f.container === 'mp4' });
}

export class YoutubeCache {
    private downloads = new Map<string, Promise<string>>();
    private cached = new Map<string, CachedVideo>();

    getPath(videoId: string) {
        return this.cached.get(videoId)?.path;
    }

    isCached(videoId: string) {
        return this.cached.has(videoId);
    }

    isPending(videoId: string) {
        return this.downloads.has(videoId);
    }

    async renewCachedVideo(videoId: string) {
        if (process.env.YOUTUBE_BROKE) {
            console.log('YOUTUBE DISABLED');
            return;
        }

        const videoInfo = await info(videoId);
        const duration = parseFloat(videoInfo.videoDetails.lengthSeconds) * 1000;
        const timeout = Math.max(duration * 2, 15 * 60 * 60 * 1000);

        const existing = this.cached.get(videoId);
        if (existing) {
            existing.expires = performance.now() + timeout;
        } else if (!this.downloads.has(videoId) && !checkValid(videoInfo)) {
            const download = this.downloadToCache(videoId);
            this.downloads.set(videoId, download);
            download.then((path) => {
                const expires = performance.now() + timeout;
                this.cached.set(videoId, { videoId, path, expires });
                this.downloads.delete(videoId);
            });
        }

        this.deleteExpiredCachedVideos();
    }

    async deleteExpiredCachedVideos() {
        const now = performance.now();
        const expired = Array.from(this.cached.values()).filter((item) => item.expires < now);

        expired.forEach((item) => {
            this.cached.delete(item.videoId);
            unlink(item.path, (err) => {
                if (err) console.log(err);
            });
        });
    }

    private async downloadToCache(videoId: string) {
        const videoInfo = await info(videoId);
        const format = getFormat(videoInfo);
        const path = await getCacheFile(`youtube-${videoId}`, '.mp4');

        const writable = createWriteStream(path);
        const readable = ytdl.downloadFromInfo(videoInfo, { format });
        readable.pipe(writable);

        await once(writable, 'close');

        return path;
    }
}
