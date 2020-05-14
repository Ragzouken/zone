import fs = require('fs');
import ytdl = require("ytdl-core");
import { performance } from 'perf_hooks';
import { once } from 'events';

async function download(videoId: string) {
    const info = await ytdl.getInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { quality: '18' });

    console.log('## start');
    const start = performance.now();
    const readable = ytdl.downloadFromInfo(info, { format });
    const writable = fs.createWriteStream(`media/${videoId}.mp4`);
    // readable.on('data', () => console.log(writable.writableLength));
    readable.pipe(writable);
    
    await once(readable, 'end');
    const time = (performance.now() - start) / 1000;
    console.log(`## done (${time}s)`);
}

download('SqIPDAsmSjg');
    