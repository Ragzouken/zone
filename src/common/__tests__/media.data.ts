import { Media } from '../zone';

export const TINY_MEDIA: Media = { title: 'tiny', duration: 100, src: 'local/TINY_MEDIA' };
export const DAY_MEDIA: Media = { title: 'day', duration: 24 * 60 * 60 * 1000, src: 'local/DAY_MEDIA' };

export const MEDIA: Media[] = [TINY_MEDIA, DAY_MEDIA];
