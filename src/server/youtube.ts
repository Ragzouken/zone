import { performance } from 'perf_hooks';
import * as ytdl from 'ytdl-core';
import { fetchDom, timeToSeconds } from './utility';
import { Media, MediaMeta } from '../common/zone';
import { createWriteStream } from 'fs';
import * as tmp from 'tmp';

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

const downloading = new Set<string>();
const downloaded = new Map<string, string>();
tmp.setGracefulCleanup();

export function ensureDownloading(videoId: string) {
    const existing = downloaded.get(videoId);
    if (existing) return existing;
    if (downloading.has(videoId)) return undefined;
    downloading.add(videoId);

    info(videoId).then((info) => {
        const format = ytdl.chooseFormat(info.formats, { quality: '18' });
        const options = {
            discardDescriptor: true,
            mode: 0o644, 
            prefix: `youtube-${videoId}-`, 
            postfix: '.mp4',
        };

        tmp.file(options, (err, path) => {
            const writable = createWriteStream(path);
            const readable = ytdl.downloadFromInfo(info, { format });
            writable.on('close', () => downloaded.set(videoId, path));
            readable.pipe(writable);
        });
    });
    
    return undefined;
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
