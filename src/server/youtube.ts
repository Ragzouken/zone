import * as ytdl from 'ytdl-core';
import ytsr = require('ytsr');
import * as ytpl from 'ytpl';

import { timeToSeconds } from '../common/utility';
import { Media, MediaMeta } from '../common/zone';
import { URL } from 'url';
import * as tmp from 'tmp';

tmp.setGracefulCleanup();

export type YoutubeVideo = MediaMeta & { videoId: string };

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
