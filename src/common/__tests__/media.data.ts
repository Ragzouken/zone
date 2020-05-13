import { YoutubeVideo } from '../../server/youtube';
import { Media } from '../zone';

export const TINY_MEDIA: Media = { title: 'tiny', duration: 100, sources: ['TINY_MEDIA'] };
export const DAY_MEDIA: Media = { title: 'day', duration: 24 * 60 * 60 * 1000, sources: ['DAY_MEDIA'] };

export const MEDIA: Media[] = [TINY_MEDIA, DAY_MEDIA];

type YoutubeTest = Media & { videoId: string };

export const YOUTUBE_MEDIA: YoutubeTest[] = [
    { videoId: '2GjyNgQ4Dos', sources: ['youtube:2GjyNgQ4Dos'], title: 'dobby pussy indulgence', duration: 20000 },
    {
        videoId: '5dA5ynP-j-I',
        sources: ['youtube:5dA5ynP-j-I'],
        title: 'Tetris (CD-i) Music - Level 9',
        duration: 245000,
    },
];

export const FAKE_YOUTUBE_VIDEO: YoutubeVideo = { videoId: '', title: 'fake video', duration: 1000 };

export const THREADS_ARCHIVE_VIDEO: Media = {
    title: 'Threads 1984',
    duration: 6749600,
    sources: ['proxy:https://archive.org/download/threads_201712/threads.mp4', 'archive:threads_201712/threads.mp4'],
};

export const PRISONER_ARCHIVE_VIDEO: Media = {
    title: 'The Prisoner 01 Arrival',
    duration: 2935410,
    sources: [
        'proxy:https://archive.org/download/The_Prisoner/ThePrisoner01Arrival.mp4',
        'archive:The_Prisoner/ThePrisoner01Arrival.mp4',
    ],
};

export const BAD_DURATION_ARCHIVE_MUSIC: Media = {
    title: 'Ike Stubblefield',
    duration: 498000,
    sources: [
        'proxy:https://archive.org/download/blr2020-05-01/bobby2020-05-01d01t01.mp3',
        'archive:blr2020-05-01/bobby2020-05-01d01t01.mp3',
    ],
};

export const ARCHIVE_PATH_TO_MEDIA = [
    { path: 'blr2020-05-01/bobby2020-05-01d01t01.mp3', media: BAD_DURATION_ARCHIVE_MUSIC },
    { path: 'The_Prisoner/ThePrisoner01Arrival.mp4', media: PRISONER_ARCHIVE_VIDEO },
    { path: 'threads_201712/threads.mp4', media: THREADS_ARCHIVE_VIDEO },
    { path: 'threads_201712', media: THREADS_ARCHIVE_VIDEO },
];
