import { Media } from '../zone';

export const TINY_MEDIA: Media = { title: 'tiny', duration: 100, source: 'local/TINY_MEDIA' };
export const DAY_MEDIA: Media = { title: 'day', duration: 24 * 60 * 60 * 1000, source: 'local/DAY_MEDIA' };

export const MEDIA: Media[] = [TINY_MEDIA, DAY_MEDIA];

type YoutubeTest = Media & { videoId: string };

export const YOUTUBE_MEDIA: YoutubeTest[] = [
    { videoId: '2GjyNgQ4Dos', source: 'youtube/2GjyNgQ4Dos', title: 'dobby pussy indulgence', duration: 20000 },
    {
        videoId: '5dA5ynP-j-I',
        source: 'youtube/5dA5ynP-j-I',
        title: 'Tetris (CD-i) Music - Level 9',
        duration: 245000,
    },
];
