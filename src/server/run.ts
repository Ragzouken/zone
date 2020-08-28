import * as express from 'express';
import * as expressWs from 'express-ws';
import * as http from 'http';
import * as https from 'https';
import * as request from 'request';
import * as glob from 'glob';
import { promises as fs, mkdir, writeFile } from 'fs';
import { basename, extname, parse, join } from 'path';
import { host } from './server';
import { exec } from 'child_process';
import FileSync = require('lowdb/adapters/FileSync');
import { Media } from '../common/zone';
import path = require('path');
import { YoutubeService, search } from './youtube';
import * as expressFileUpload from 'express-fileupload';
import { isArray } from 'util';
import { nanoid } from 'nanoid';
import { F_OK } from 'constants';

import ffprobe = require('ffprobe');
import ffprobeStatic = require('ffprobe-static');

process.on('uncaughtException', (err) => console.log('uncaught exception:', err, err.stack));
process.on('unhandledRejection', (err) => console.log('uncaught reject:', err));

async function run() {
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

    function update() {
        exec('zone-update', () => {
            save();
            sendAll('status', { text: 'restarting server' });
            exec('zone-restart');
        });
    }

    function relisten() {
        if (server.listening) server.close(console.log);
        server.listen(process.env.PORT || 4000, () => console.log('listening...'));
    }

    authCommands.set('update', update);
    authCommands.set('refresh-videos', refreshLocalVideos);
    authCommands.set('relisten', relisten);

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

    app.get('/youtube', (req, res) => {
        const query = req.query.q;
        if (!query || typeof query !== 'string') {
            res.status(400).send('bad query');
        } else {
            search(query).then(
                (results) => res.json(results),
                (reason) => res.status(500).send('search failed'),
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

    app.use('/uploads', express.static('uploads'));
    app.post('/upload', async (req, res) => {
        if (!process.env.UPLOAD_PASSWORD || req.body.password !== process.env.UPLOAD_PASSWORD) {
            res.status(400).send('WRONG PASSWORD');
        } else if (req.files && req.files.file) {
            if (isArray(req.files.file)) {
                res.status(400).send('ONE FILE ONLY PLEASE');
            } else {
                try {
                    const shortcut: string = req.body.shortcut;
                    const title: string = req.body.title;
                    const type = extname(req.files.file.name);
                    const id = nanoid();
                    const filepath = path.join('uploads', id + type);

                    await fs.mkdir('uploads').catch(() => {});
                    await req.files.file.mv(filepath);

                    const media = {
                        title,
                        duration: (await getDurationInSeconds(filepath)) * 1000,
                        source: filepath,
                        shortcut,
                    };

                    localLibrary.set(shortcut, media);
                    writeFile(path.join('uploads', id + '.json'), JSON.stringify(media), () => {});

                    res.status(201).send(`THANKS, play with /local ${shortcut}`);
                } catch (e) {
                    console.log('UPLOAD ERROR', e);
                    res.status(500).send('UPLOAD ERROR, ASK CANDLE');
                }
            }
        } else {
            res.status(400).send('NO FILE?');
        }
    });

    process.on('SIGINT', () => {
        console.log('exiting due to SIGINT');
        save();
        sendAll('status', { text: 'manual shutdown' });
        process.exit();
    });

    const durationCommand =
        'ffprobe -v error -select_streams a:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1';

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

            if (!media.subtitle) {
                fs.access(subtitlePath, F_OK).then(
                    () => (media.subtitle = subtitlePath),
                    () => {},
                );
            }

            localLibrary.set(media.shortcut || parsed.name, media);
        } catch (e) {
            console.log(`LOCAL FAILED "${path}": ${e}`);
        }
    }

    function refreshLocalVideos() {
        localLibrary.clear();
        glob('media/**/*.mp4', (error, matches) => matches.forEach(addLocal));
        glob('media/**/*.mp3', (error, matches) => matches.forEach(addLocal));
        glob('uploads/**/*.mp3', (error, matches) => matches.forEach(addLocal));
        glob('uploads/**/*.mp4', (error, matches) => matches.forEach(addLocal));
    }

    refreshLocalVideos();
}

run();
