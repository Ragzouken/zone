import * as ytdl from 'ytdl-core';
import * as ytsr from 'ytsr';
import * as ytpl from 'ytpl';

import { EventEmitter } from 'events';
import { createWriteStream, mkdir, unlink, writeFile, readFile } from 'fs';
import path = require('path');
import * as glob from 'glob';
import { Media, MediaMeta } from '../common/zone';
import { timeToSeconds } from '../common/utility';
import { performance } from 'perf_hooks';

const INFO_LIFESPAN = 8 * 60 * 60 * 1000;

export type YoutubeVideo = MediaMeta & { videoId: string };

export async function search(query: string): Promise<YoutubeVideo[]> {
    const results = await ytsr(query, { limit: 15 });
    const videos = results.items.filter((item) => item.type === 'video' && !(item as any).live).slice(0, 5);
    return videos.map((item) => {
        const videoId = ytdl.getVideoID(item.link);
        const duration = timeToSeconds(item.duration) * 1000;
        const title = item.title;
        const thumbnail = item.thumbnail;

        return { videoId, title, duration, thumbnail };
    });
}

export type VideoStatus = 'broken' | 'available' | 'queued' | 'ready';

export interface YoutubeServiceOptions {
    downloadPath: string;
    downloadOptions: ytdl.downloadOptions;
}

export const DEFAULT_OPTIONS: YoutubeServiceOptions = {
    downloadPath: 'youtube',
    downloadOptions: {
        quality: 'lowest',
        filter: (f) => f.hasAudio && f.hasVideo && f.container === 'mp4',
    },
};

export class YoutubeService extends EventEmitter {
    private downloadBroken = new Set<string>();
    private downloadInfos = new Map<string, Promise<ytdl.videoInfo>>();
    private downloadPaths = new Map<string, string>();
    private downloadQueue: string[] = [];

    private downloadInfoExpiries = new Map<string, number>();

    private downloading?: string;

    private readonly options: YoutubeServiceOptions;

    constructor(options: Partial<YoutubeServiceOptions> = {}) {
        super();
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        setInterval(() => this.update(), 100);

        this.findExistingVideos();
    }

    async getVideoDownloadUrl(videoId: string): Promise<string | undefined> {
        const videoInfo = await this.getVideoInfo(videoId);
        if (!videoInfo) return undefined;
        const format = this.chooseFormat(videoInfo);
        return format?.url;
    }

    getVideoPath(videoId: string): string {
        return this.downloadPaths.get(videoId) || 'error';
    }

    private findExistingVideos() {
        const pattern = path.join(this.options.downloadPath, '*.json');
        glob(pattern, (error, matches) =>
            matches.forEach((file) => {
                readFile(file, 'UTF8', (error, data) => {
                    const videoId = path.basename(file, path.extname(file));
                    const media = JSON.parse(data) as Media;
                    console.log(`FOUND ${videoId}`);
                    this.provideVideo(videoId, media.source);
                });
            }),
        );
    }

    private update() {
        if (!this.downloading && this.downloadQueue.length > 0) {
            const next = this.downloadQueue.shift()!;
            console.log(`NEXT: ${next}`);
            this.downloadVideo(next);
        }
    }

    getVideoState(videoId: string): VideoStatus {
        if (this.downloadPaths.has(videoId)) return 'ready';
        if (this.downloadQueue.includes(videoId) || this.downloading === videoId) return 'queued';
        if (this.downloadBroken.has(videoId)) return 'broken';
        return 'available';
    }

    async getVideoValid(videoId: string): Promise<boolean> {
        const videoInfo = await this.getVideoInfo(videoId);
        return videoInfo !== undefined && this.chooseFormat(videoInfo) !== undefined;
    }

    async getVideoMedia(videoId: string): Promise<Media | undefined> {
        const videoInfo = await this.getVideoInfo(videoId);
        if (!videoInfo) return undefined;

        const format = this.chooseFormat(videoInfo);
        if (!format) return undefined;

        const duration = parseInt(videoInfo.videoDetails.lengthSeconds, 10) * 1000;
        const source = 'youtube/' + videoId;

        return { title: videoInfo.videoDetails.title, duration, source };
    }

    queueVideoDownload(videoId: string) {
        this.downloadQueue.push(videoId);
    }

    deleteVideo(videoId: string) {
        if (this.downloadQueue.includes(videoId)) {
            console.log(`WON'T DELETE QUEUED ${videoId}`);
            return;
        } else if (this.downloading === videoId) {
            console.log(`WON'T DELETE DOWNLOADING ${videoId}`);
            return;
        }

        this.downloadPaths.delete(videoId);

        const videoPath = path.join(this.options.downloadPath, `${videoId}.mp4`);
        const mediaPath = path.join(this.options.downloadPath, `${videoId}.json`);
        unlink(videoPath, () => {});
        unlink(mediaPath, () => {});
    }

    private async getVideoInfo(videoId: string): Promise<ytdl.videoInfo | undefined> {
        const expiry = this.downloadInfoExpiries.get(videoId);

        if (expiry && expiry > performance.now()) {
            this.downloadInfoExpiries.delete(videoId);
            this.downloadInfos.delete(videoId);
        } else if (!expiry) {
            this.downloadInfoExpiries.set(videoId, performance.now() + INFO_LIFESPAN);
        }

        const promise = this.downloadInfos.get(videoId) || ytdl.getInfo(videoId);
        this.downloadInfos.set(videoId, promise);

        try {
            const info = await promise;
            return info;
        } catch (e) {
            console.log(`NO INFO ${videoId}: ${e}`);
            this.rejectVideo(videoId);
            return undefined;
        }
    }

    private chooseFormat(videoInfo: ytdl.videoInfo) {
        try {
            return ytdl.chooseFormat(videoInfo.formats, this.options.downloadOptions);
        } catch (e) {
            const names = videoInfo.formats.map((format) => format.itag).join(', ');
            console.log(`NO FORMAT FOR ${videoInfo.video_id} FROM ${names}`);
            return undefined;
        }
    }

    private async downloadVideo(videoId: string) {
        if (this.downloading) {
            console.log(`CONCURRENT DOWNLOAD ${videoId} while ${this.downloading}`);
            return;
        } else if (this.downloadPaths.has(videoId)) {
            console.log(`DOUBLE DOWNLOAD ${videoId}`);
            this.downloading = undefined;
            return;
        }

        this.downloading = videoId;

        const videoInfo = await this.getVideoInfo(videoId);
        if (!videoInfo) {
            this.downloading = undefined;
            this.rejectVideo(videoId);
            return;
        }

        const videoPath = path.join(this.options.downloadPath, `${videoId}.mp4`);
        const mediaPath = path.join(this.options.downloadPath, `${videoId}.json`);
        mkdir(path.dirname(videoPath), () => {});

        const media: Media = {
            title: videoInfo.videoDetails.title,
            duration: parseInt(videoInfo.videoDetails.lengthSeconds, 10) * 1000,
            source: videoPath,
        };

        const format = this.chooseFormat(videoInfo);
        if (!format) {
            this.downloading = undefined;
            this.rejectVideo(videoId);
            console.log(`NO FORMAT ${videoId}`);
            return;
        }

        const writable = createWriteStream(videoPath);
        const readable = ytdl.downloadFromInfo(videoInfo, { format });
        readable.pipe(writable);
        console.log(`DOWNLOADING ${videoId}`);

        const download = new Promise((resolve, reject) => {
            writable.on('error', reject);
            readable.on('error', reject);
            writable.on('close', resolve);
        });

        download.then(
            () => {
                this.downloading = undefined;
                this.provideVideo(videoId, videoPath);
                writeFile(mediaPath, JSON.stringify(media), () => {});
                console.log(`DOWNLOAD DONE ${videoId}: ${this.getVideoState(videoId)}`);
            },
            (error) => {
                this.downloading = undefined;
                this.rejectVideo(videoId);
                unlink(videoPath, () => {});
                unlink(mediaPath, () => {});
                console.log(`DOWNLOAD ERROR ${videoId}: ${error}`);
            },
        );
    }

    private provideVideo(videoId: string, path: string) {
        this.downloadBroken.delete(videoId);
        this.downloadPaths.set(videoId, path);
    }

    private rejectVideo(videoId: string) {
        this.downloadBroken.add(videoId);
    }
}
