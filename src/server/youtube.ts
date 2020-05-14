import { performance } from 'perf_hooks';
import * as ytdl from 'ytdl-core';
import { fetchDom, timeToSeconds } from './utility';
import { Media, MediaMeta } from '../common/zone';
import { createWriteStream } from 'fs';
import { once } from 'events';
import { killCacheFile, getCacheFile } from './cache';

export type YoutubeVideo = MediaMeta & { videoId: string };

const TIMEOUT = 30 * 60 * 1000;
const infoCache = new Map<string, { info: ytdl.videoInfo; expires: number }>();

async function getCachedInfo(videoId: string) {
    const entry = infoCache.get(videoId);

    if (entry && entry.expires > performance.now()) {
        return entry.info;
    } else {
        infoCache.delete(videoId);
        const info = await ytdl.getInfo(videoId);
        const expires = performance.now() + TIMEOUT;
        infoCache.set(videoId, { info, expires });
        return info;
    }
}

export async function info(videoID: string) {
    return getCachedInfo(videoID);
}

export async function direct(videoId: string): Promise<string> {
    const info = await getCachedInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { quality: '18' });
    return format.url;
}

export async function media(videoId: string): Promise<Media> {
    const { title, length_seconds } = await getCachedInfo(videoId);
    const duration = parseInt(length_seconds, 10) * 1000;
    const source = 'youtube/' + videoId;

    return { title, duration, source };
}

export async function search(query: string): Promise<YoutubeVideo[]> {
    const dom = await fetchDom(`https://www.youtube.com/results?search_query=${query}`);
    const results: YoutubeVideo[] = [];
    const videos = dom.querySelectorAll('.yt-lockup-dismissable');
    videos.forEach((video) => {
        const time = video.querySelector('.video-time');
        if (!time) return;

        const duration = timeToSeconds(time.innerHTML) * 1000;

        const link = video.querySelector('.yt-uix-tile-link');
        if (!link) return;

        const title = link.getAttribute('title');
        const url = link.getAttribute('href');
        if (!title || !url) return;

        const videoId = url.split('?v=')[1];

        results.push({ videoId, title, duration });
    });

    return results;
}

type CachedVideo = {
    videoId: string,
    path: string,
    expires: number,
};

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
        const existing = this.cached.get(videoId);
        const download = this.downloads.get(videoId);

        const videoInfo = await info(videoId);
        const duration = parseFloat(videoInfo.length_seconds) * 1000;
        const timeout = Math.max(duration * 2, 15 * 60 * 60 * 1000);
        
        if (existing) {
            existing.expires = performance.now() + timeout;
        } else if (!download) {
            const download = this.downloadToCache(videoId);
            this.downloads.set(videoId, download);
            download.then((path) => {
                const expires = performance.now() + timeout;
                this.cached.set(videoId, { videoId, path, expires })
                this.downloads.delete(videoId);
            });
        }

        this.deleteExpiredCachedVideos();
    }
    
    private async deleteExpiredCachedVideos() {
        const now = performance.now();
        const expired = Array.from(this.cached.values()).filter((item) => item.expires < now);
        
        expired.forEach((item) => {
            this.cached.delete(item.videoId);
            killCacheFile(item.path);
        })
    }

    private async downloadToCache(videoId: string) {
        const videoInfo = await info(videoId);
        const format = ytdl.chooseFormat(videoInfo.formats, { quality: '18' });
        const path = await getCacheFile(`youtube-${videoId}`, '.mp4');

        const writable = createWriteStream(path);
        const readable = ytdl.downloadFromInfo(videoInfo, { format });
        readable.pipe(writable);

        await once(writable, 'close');

        return path;
    }
}
