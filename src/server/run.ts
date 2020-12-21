import * as express from 'express';
import * as expressWs from 'express-ws';
import * as http from 'http';
import * as https from 'https';
import * as request from 'request';
import * as glob from 'glob';
import { promises as fs } from 'fs';
import { parse, join } from 'path';
import { host } from './server';
import { exec } from 'child_process';
import FileSync = require('lowdb/adapters/FileSync');
import { Media } from '../common/zone';
import path = require('path');
import { YoutubeService, search } from './youtube';
import * as expressFileUpload from 'express-fileupload';
import { F_OK } from 'constants';

import ffprobe = require('ffprobe');
import ffprobeStatic = require('ffprobe-static');

process.on('uncaughtException', (err) => console.log('uncaught exception:', err, err.stack));
process.on('unhandledRejection', (err) => console.log('uncaught reject:', err));

async function run() {
    process.title = "zone server";

    const app = express();
    let server: http.Server | https.Server;
    let redirectServer: http.Server;

    const secure = process.env.CERT_PATH && process.env.KEY_PATH;

    if (secure) {
        const key = await fs.readFile(process.env.KEY_PATH!);
        const cert = await fs.readFile(process.env.CERT_PATH!);
        server = https.createServer({ key, cert }, app);

        const redirectApp = express();
        redirectServer = http.createServer(redirectApp);
        redirectServer.listen(80, () => console.log('listening for http...'));
        redirectApp.get('*', (req, res) => {
            res.redirect(301, `https://${req.headers.host}${req.url}`);
        });
    } else {
        server = http.createServer(app);
    }

    const xws = expressWs(app, server);
    relisten();
    server.on('error', (error) => console.log('server error', error));

    const dataPath = process.env.ZONE_DATA_PATH || '.data/db.json';
    fs.mkdir(path.dirname(dataPath)).catch(() => {});
    const adapter = new FileSync(dataPath, { serialize: JSON.stringify, deserialize: JSON.parse });

    const yts = new YoutubeService();

    const { save, sendAll, authCommands, localLibrary } = host(xws, adapter, yts, {
        joinPassword: process.env.JOIN_PASSWORD,
        authPassword: process.env.AUTH_PASSWORD || 'riverdale',
    });

    authCommands.set('refresh-videos', refreshLocalVideos);

    app.use(
        expressFileUpload({
            abortOnLimit: true,
            uriDecodeFileNames: true,
            limits: { fileSize: 16 * 1024 * 1024 },
        }),
    );

    // trust glitch's proxy to give us socket ips
    app.set('trust proxy', true);
    app.use('/', express.static('public'));
    app.use('/media', express.static('media'));

    function splitTitle(title: string) {
        return title.split(/-\s/).map((title) => title.trim().toLowerCase());
    }

    function mediaSearchRank(media: Media, fragments: string[]) {
        if (!media.shortcut) return 0;
        const searchable = media.shortcut.replace('-', ' ').toLowerCase() + media.title.toLowerCase();
        const counts = fragments.map((fragment) => searchable.includes(fragment) ? 1+0 : 0);
        const count = counts.reduce((a, b) => a + b);
        return count;
    }

    async function localSearch(query: string) {
        const fragments = splitTitle(query);
        const medias = Array.from(localLibrary.values());
        const results = medias.map((media) => ({ media, rank: mediaSearchRank(media, fragments) }));
        const matches = results.filter((result) => result.rank > 0);
        matches.sort((a, b) => b.rank - a.rank);
        return matches.map((match) => match.media);
    }

    app.get('/local', (req, res) => {
        const query = req.query.q;
        if (!query || typeof query !== 'string') {
            res.status(400).send('bad query');
        } else {
            localSearch(query).then(
                (results) => res.json(results),
                (reason) => res.status(500).send(`search failed ${reason}`),
            );
        }
    });

    app.get('/youtube', (req, res) => {
        const query = req.query.q;
        if (!query || typeof query !== 'string') {
            res.status(400).send('bad query');
        } else {
            search(query).then(
                (results) => res.json(results),
                (reason) => res.status(500).send(`search failed ${reason}`),
            );
        }
    });
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

    async function getDurationInSeconds(file: string): Promise<number> {
        const info = await ffprobe(file, { path: ffprobeStatic.path });
        return info.streams[0].duration;
    }

    async function addLocal(path: string) {
        try {
            const parsed = parse(path);
            const mediaPath = join(parsed.dir, parsed.name + '.json');
            const subtitlePath = join(parsed.dir, parsed.name + '.vtt');

            let media: Media;

            try {
                media = await fs.readFile(mediaPath, 'UTF8').then((data) => JSON.parse(data as string) as Media);
            } catch (e) {
                const duration = (await getDurationInSeconds(path)) * 1000;
                media = { title: parsed.name, duration, source: path };
            }

            media.shortcut = media.shortcut || parsed.name;

            if (!media.subtitle) {
                fs.access(subtitlePath, F_OK).then(
                    () => (media.subtitle = subtitlePath),
                    () => {},
                );
            }

            localLibrary.set(media.shortcut, media);
        } catch (e) {
            console.log(`LOCAL FAILED "${path}": ${e}`);
        }
    }

    function refreshLocalVideos() {
        localLibrary.clear();
        glob('media/**/*.{mp4,mp3}', (error, matches) => matches.forEach(addLocal));
    }

    refreshLocalVideos();
}

run();
