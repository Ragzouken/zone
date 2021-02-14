import { Media } from '../zone';

export const TINY_MEDIA: Media = { mediaId: 'TINY_MEDIA', title: 'tiny', duration: 100, src: 'local/TINY_MEDIA' };
export const DAY_MEDIA: Media = { mediaId: 'DAY_MEDIA', title: 'day', duration: 24 * 60 * 60 * 1000, src: 'local/DAY_MEDIA' };

export const MEDIA: Media[] = [TINY_MEDIA, DAY_MEDIA];
