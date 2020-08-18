import * as youtube from '../youtube';
import { YOUTUBE_MEDIA } from '../../common/__tests__/media.data';

test('search', async () => {
    await youtube.search("let's daba daba");
});

test('banger', async () => {
    await youtube.banger();
});

test.each(YOUTUBE_MEDIA)('media', async ({ videoId, ...expected }) => {
    const media = await youtube.media(videoId);
    expect(media).toEqual(expected);
});

test.each(YOUTUBE_MEDIA)('direct', async ({ videoId }) => {
    await youtube.direct(videoId);
});
