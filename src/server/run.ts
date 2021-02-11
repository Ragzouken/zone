import * as express from 'express';
import * as expressWs from 'express-ws';
import * as request from 'request';
import { promises as fs } from 'fs';
import { host } from './server';
import FileSync = require('lowdb/adapters/FileSync');
import path = require('path');
import { YoutubeService } from './youtube';

process.on('uncaughtException', (err) => console.log('uncaught exception:', err, err.stack));
process.on('unhandledRejection', (err) => console.log('uncaught reject:', err));

async function run() {
    process.title = "zone server";

    const app = express();
    const xws = expressWs(app);
    const port = process.env.PORT || 4000;
    const server = app.listen(port, () => console.log(`listening on http://localhost:${port}...`));
    server.on('error', (error) => console.log('server error', error));

    const dataPath = process.env.ZONE_DATA_PATH || '.data/db.json';
    fs.mkdir(path.dirname(dataPath)).catch(() => {});
    const adapter = new FileSync(dataPath, { serialize: JSON.stringify, deserialize: JSON.parse });

    const yts = new YoutubeService();

    const { save, sendAll } = host(xws, adapter, yts, {
        joinPassword: process.env.JOIN_PASSWORD,
        authPassword: process.env.AUTH_PASSWORD || 'riverdale',
        libraryOrigin: process.env.LIBRARY_ORIGIN,
        youtubeOrigin: process.env.YOUTUBE_ORIGIN,
        youtubePassword: process.env.YOUTUBE_PASSWORD,
    });

    // trust glitch's proxy to give us socket ips
    app.set('trust proxy', true);
    app.use('/', express.static('public'));

    app.get('/youtube/:videoId', async (req, res) => {
        // desperation
        req.on('error', (e) => console.log('req:', e));
        res.on('error', (e) => console.log('res:', e));

        const videoId = req.params.videoId;
        const videoState = yts.getVideoState(videoId);

        if (videoState === 'ready') {
            res.sendFile(yts.getVideoPath(videoId), { root: '.' });
        } else if (videoState === 'queued') {
            try {
                const url = await yts.getVideoDownloadUrl(req.params.videoId);
                if (!url) {
                    res.status(503).send(`youtube error, no url`);
                    return;
                }
                const direct = request(url);

                // proxied request can die and needs to be killed
                direct.on('error', (e) => {
                    console.log('proxy died:', e.name, e.message);

                    direct.destroy();
                    res.destroy();
                });

                req.pipe(direct)
                    .pipe(res)
                    .on('error', (e) => console.log('pipe:', e));
            } catch (e) {
                res.status(503).send(`youtube error: ${e}`);
            }
        } else {
            res.status(403).send(`video not queued (${videoState})`);
        }
    });

    process.on('SIGINT', () => {
        console.log('exiting due to SIGINT');
        save();
        sendAll('status', { text: 'manual shutdown' });
        process.exit();
    });
}

run();
