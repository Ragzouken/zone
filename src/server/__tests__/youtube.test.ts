import Youtube, { getTitleDirect } from '../youtube';
import { YOUTUBE_MEDIA, FAKE_YOUTUBE_VIDEO } from '../../common/__tests__/media.data';

test.each(YOUTUBE_MEDIA)('getTitleDirect', async (knownVideo) => {
    const title = await getTitleDirect(knownVideo.sources[0].split(':')[1]);
    expect(title).toEqual(knownVideo.title);
});

test.each(YOUTUBE_MEDIA)('youtube.details', async ({ title, duration, videoId }) => {
    const youtube = new Youtube();
    const details = await youtube.details(videoId);
    expect(details).toEqual({ title, duration, videoId });
});

it('throws exception for unobtainable details', async () => {
    const youtube = new Youtube();
    const check = youtube.details('really fake video id');
    await expect(check).rejects.toThrow(Error);
});

it('loads copied state', async () => {
    const youtube1 = new Youtube();
    const youtube2 = new Youtube();

    const video = YOUTUBE_MEDIA[0];
    youtube1.addVideo(video);
    youtube2.loadState(youtube1.copyState());
    expect(await youtube2.details(video.videoId)).toEqual(video);
});

it('can copy empty state', async () => {
    const youtube1 = new Youtube();
    const youtube2 = new Youtube();
    youtube2.addVideo(FAKE_YOUTUBE_VIDEO);
    youtube2.loadState(youtube1.copyState());
    const check = youtube2.details(FAKE_YOUTUBE_VIDEO.videoId);
    await expect(check).rejects.toThrow(Error);
});

it('remembers queried videos', async () => {
    const youtube = new Youtube();
    for (const video of YOUTUBE_MEDIA) await youtube.details(video.videoId);
    expect(youtube.copyState().videos.length).toBeGreaterThanOrEqual(YOUTUBE_MEDIA.length);
});
