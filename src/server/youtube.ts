import * as ytdl from 'ytdl-core';
import { fetchDom, timeToSeconds } from './utility';
import { Media, MediaMeta } from '../common/zone';

export type YoutubeVideo = MediaMeta & { videoId: string };

export async function media(videoId: string): Promise<Media> {
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
