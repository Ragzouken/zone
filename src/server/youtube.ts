import { fetchDom, timeToSeconds } from './utility';
import { PlayableMedia } from './playback';

export type YoutubeSource = { type: 'youtube'; videoId: string };
export type YoutubeVideo = PlayableMedia<YoutubeSource>;

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
        this.cache.set(video.source.videoId, video);
    }

    public async search(query: string): Promise<YoutubeVideo[]> {
        const results = await search(query);
        results.forEach((video: YoutubeVideo) => this.addVideo(video));
        return results;
    }

    public async details(videoId: string): Promise<YoutubeVideo> {
        let details = this.cache.get(videoId);
        if (details) return details;

        for (const strategy of SEARCH_STRATEGIES) {
            try {
                const query = await strategy(videoId);
                await this.search(query);
                details = this.cache.get(videoId);
                if (details) break;
            } catch (e) {
                console.log(`strategy exception`, e);
            }
        }

        if (!details) throw new Error(`Couldn't determine details of ${videoId}`);

        this.addVideo(details);
        return details;
    }
}

type SearchStrategy = (videoId: string) => Promise<string>;
const SEARCH_STRATEGIES: SearchStrategy[] = [
    async (videoId) => `"${videoId}"`,
    async (videoId) => `"v=${videoId}"`,
    async (videoId) => `"${await getTitleDirect(videoId)}"`,
];

export async function getTitleDirect(videoId: string) {
    const dom = await fetchDom(`https://www.youtube.com/watch?v=${videoId}`);
    const title = dom.querySelectorAll('meta').filter((element) => element.getAttribute('property') === 'og:title')[0];
    return title.getAttribute('content');
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

        results.push({
            source: { type: 'youtube', videoId },
            details: { title, duration },
        });
    });

    return results;
}
