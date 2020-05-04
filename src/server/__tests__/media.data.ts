import { YoutubeVideo } from '../youtube';
import { PlayableMedia } from '../playback';
import { ArchiveSource } from '../archiveorg';

export const TINY_MEDIA: PlayableMedia = {
    source: { type: 'null' },
    details: { title: 'tiny', duration: 100 },
};

export const DAY_MEDIA: PlayableMedia = {
    source: { type: 'null' },
    details: { title: 'day', duration: 24 * 60 * 60 * 1000 },
};

export const MEDIA: PlayableMedia[] = [TINY_MEDIA, DAY_MEDIA];

export const YOUTUBE_VIDEOS: YoutubeVideo[] = [
    {
        source: { type: 'youtube', videoId: '5dA5ynP-j-I' },
        details: { title: 'Tetris (CD-i) Music - Level 9', duration: 246000 },
    },
    {
        source: { type: 'youtube', videoId: '2GjyNgQ4Dos' },
        details: { title: 'dobby pussy indulgence', duration: 20000 },
    },
];

export const FAKE_YOUTUBE_VIDEO: YoutubeVideo = {
    source: { type: 'youtube', videoId: '' },
    details: { title: 'fake video', duration: 1000 },
};

export const THREADS_ARCHIVE_VIDEO: PlayableMedia<ArchiveSource> = {
    details: { title: 'Threads 1984', duration: 6749600 },
    source: { type: 'archive', src: 'https://archive.org/download/threads_201712/threads.mp4' },
};

export const PRISONER_ARCHIVE_VIDEO: PlayableMedia<ArchiveSource> = {
    details: { title: 'The Prisoner 01 Arrival', duration: 2935410 },
    source: { type: 'archive', src: 'https://archive.org/download/The_Prisoner/ThePrisoner01Arrival.mp4' },
};

export const BAD_DURATION_ARCHIVE_MUSIC: PlayableMedia<ArchiveSource> = {
    details: { title: 'Ike Stubblefield', duration: 498000 },
    source: { type: 'archive', src: 'https://archive.org/download/blr2020-05-01/bobby2020-05-01d01t01.mp3' },
};

export const ARCHIVE_PATH_TO_MEDIA = [
    { path: 'blr2020-05-01/bobby2020-05-01d01t01.mp3', media: BAD_DURATION_ARCHIVE_MUSIC },
    { path: 'The_Prisoner/ThePrisoner01Arrival.mp4', media: PRISONER_ARCHIVE_VIDEO },
    { path: 'threads_201712/threads.mp4', media: THREADS_ARCHIVE_VIDEO },
    { path: 'threads_201712', media: THREADS_ARCHIVE_VIDEO },
];
