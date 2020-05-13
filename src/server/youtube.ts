import * as ytdl from 'ytdl-core';
import { fetchDom, timeToSeconds } from './utility';
import { Media, MediaMeta } from '../common/zone';

export type YoutubeVideo = MediaMeta & { videoId: string };

export type YoutubeState = {
    videos: YoutubeVideo[];
};

export default class Youtube {
    private cache = new Map<string, YoutubeVideo>();

    public copyState(): YoutubeState {
        return {
            videos: Array.from(this.cache.values()),
        };
    }

    public loadState(state: YoutubeState) {
        this.cache.clear();
        state.videos.forEach((video) => this.addVideo(video));
    }

    public addVideo(video: YoutubeVideo) {
        this.cache.set(video.videoId, video);
    }

    public async search(query: string): Promise<YoutubeVideo[]> {
        const results = await search(query);
        results.forEach((video: YoutubeVideo) => this.addVideo(video));
        return results;
    }

    public async details(videoId: string): Promise<YoutubeVideo> {
        let details = this.cache.get(videoId);
        if (details) return details;

        try {
            details = await getDetailsYtdl(videoId);
        } catch (e) {}

        if (!details) throw new Error(`Couldn't determine details of ${videoId}`);

        this.addVideo(details);
        return details;
    }

    public async media(videoId: string): Promise<Media> {
        return getMediaYtdl(videoId);
    }
}

export async function getMediaYtdl(videoId: string) {
    const info = await ytdl.getInfo(videoId);
    const sources = ['youtube:' + videoId];

    try {
        const url = ytdl.chooseFormat(info.formats, { quality: '18' }).url;
        sources.unshift('./proxy/' + encodeURIComponent(url));
    } catch (e) {}

    const media: Media = {
        title: info.title,
        duration: parseInt(info.length_seconds, 10) * 1000,
        sources,
    };
    return media;
}

export async function getDetailsYtdl(videoId: string) {
    const info = await ytdl.getBasicInfo(videoId);
    const video: YoutubeVideo = {
        videoId,
        title: info.title,
        duration: parseInt(info.length_seconds, 10) * 1000,
    };
    return video;
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
