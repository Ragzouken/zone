import Playback from '../playback';
import { once } from 'events';
import { MEDIA, TINY_MEDIA, DAY_MEDIA } from './media.data';

it('plays the first item queued', () => {
    const playback = new Playback();
    MEDIA.forEach((media) => playback.queueMedia(media));
    expect(playback.currentItem?.media).toEqual(MEDIA[0]);
});

it('removes the playing item from the queue', () => {
    const playback = new Playback();
    MEDIA.forEach((media) => playback.queueMedia(media));
    expect(playback.queue.map((item) => item.media)).toEqual(MEDIA.slice(1));
});

test('loading copied state', () => {
    const playback = new Playback();
    const other = new Playback();
    MEDIA.forEach((media) => playback.queueMedia(media));
    other.loadState(playback.copyState());
    expect(other.currentItem).toEqual(playback.currentItem);
    expect(other.queue).toEqual(playback.queue);
});

it('can copy empty state', () => {
    const playback = new Playback();
    const other = new Playback();
    other.loadState(playback.copyState());
    expect(other.currentItem).toEqual(playback.currentItem);
    expect(other.queue).toEqual(playback.queue);
});

it('continues the queue when a video ends', async () => {
    const playback = new Playback();
    playback.queueMedia(TINY_MEDIA);
    playback.queueMedia(DAY_MEDIA);
    expect(playback.currentItem?.media).toBe(TINY_MEDIA);
    await once(playback, 'play');
    expect(playback.currentItem?.media).toBe(DAY_MEDIA);
});

it('stops when last item ends', async () => {
    const playback = new Playback();
    const stopped = once(playback, 'stop');
    playback.queueMedia(TINY_MEDIA);
    await stopped;
});

it('stops when last item skipped', async () => {
    const playback = new Playback();
    const stopped = once(playback, 'stop');
    playback.queueMedia(DAY_MEDIA);
    playback.skip();
    await stopped;
});

it('continues the queue when an item is skipped', async () => {
    const playback = new Playback();
    playback.queueMedia(TINY_MEDIA);
    MEDIA.forEach((video) => playback.queueMedia(video));
    expect(playback.currentItem?.media).toBe(TINY_MEDIA);
    playback.skip();
    expect(playback.currentItem?.media).toBe(MEDIA[0]);
});

test('queue proceeds normally after loading state', async () => {
    const playback = new Playback();
    const other = new Playback();
    playback.queueMedia(TINY_MEDIA);
    playback.queueMedia(DAY_MEDIA);
    other.loadState(playback.copyState());
    await once(other, 'play');
    expect(other.currentItem?.media).toBe(DAY_MEDIA);
});
