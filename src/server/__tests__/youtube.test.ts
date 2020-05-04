import Youtube, { getTitleDirect } from '../youtube';
import { YOUTUBE_VIDEOS, FAKE_YOUTUBE_VIDEO } from './media.data';

test.each(YOUTUBE_VIDEOS)('getTitleDirect', async (knownVideo) => {
    const title = await getTitleDirect(knownVideo.source.videoId);
    expect(title).toEqual(knownVideo.details.title);
});

test.each(YOUTUBE_VIDEOS)('youtube.details', async (knownVideo) => {
    const youtube = new Youtube();
    const details = await youtube.details(knownVideo.source.videoId);
    expect(details).toEqual(knownVideo);
});

it('throws exception for unobtainable details', async () => {
    const youtube = new Youtube();
    const check = youtube.details('really fake video id');
    await expect(check).rejects.toThrow(Error);
});

it('loads copied state', async () => {
    const youtube1 = new Youtube();
    const youtube2 = new Youtube();

    const video = YOUTUBE_VIDEOS[0];
    youtube1.addVideo(video);
    youtube2.loadState(youtube1.copyState());
    expect(await youtube2.details(video.source.videoId)).toEqual(video);
});

it('can copy empty state', async () => {
    const youtube1 = new Youtube();
    const youtube2 = new Youtube();
    youtube2.addVideo(FAKE_YOUTUBE_VIDEO);
    youtube2.loadState(youtube1.copyState());
    const check = youtube2.details(FAKE_YOUTUBE_VIDEO.source.videoId);
    await expect(check).rejects.toThrow(Error);
});

it('remembers queried videos', async () => {
    const youtube = new Youtube();
    for (const video of YOUTUBE_VIDEOS) await youtube.details(video.source.videoId);
    expect(youtube.copyState().videos.length).toBeGreaterThanOrEqual(YOUTUBE_VIDEOS.length);
});
