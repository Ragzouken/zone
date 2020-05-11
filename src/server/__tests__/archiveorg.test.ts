import { archiveOrgToMedia } from '../archiveorg';
import { ARCHIVE_PATH_TO_MEDIA } from '../../common/__tests__/media.data';

test.each(ARCHIVE_PATH_TO_MEDIA)('path gives expected media', async ({ path, media }) => {
    const actual = await archiveOrgToMedia(path);
    expect(actual).toEqual(media);
});
