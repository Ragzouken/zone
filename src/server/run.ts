import * as express from 'express';
import * as expressWs from 'express-ws';
import * as http from 'http';
import * as https from 'https';
import * as request from 'request';
import * as youtube from './youtube';
import * as glob from 'glob';
import { promises as fs } from 'fs';
import { basename, extname } from 'path';
import { host } from './server';
import { exec } from 'child_process';
import FileSync = require('lowdb/adapters/FileSync');
import { Media } from '../common/zone';
import ytdl = require('ytdl-core');

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
            res.redirect(`https://${req.headers.host}${req.url}`);
        });
    } else {
        server = http.createServer(app);
    }

    const xws = expressWs(app, server);
    server.setTimeout(10 * 60 * 1000); // might be the video cutting...
    server.listen(process.env.PORT || 4000, () => console.log('listening...'));
    server.on('error', (error) => console.log('server error', error));

    const dataPath = process.env.ZONE_DATA_PATH || '.data/db.json';
    const adapter = new FileSync(dataPath);

    const { save, sendAll, authCommands, localLibrary } = host(xws, adapter, {
        joinPassword: process.env.JOIN_PASSWORD,
        authPassword: process.env.AUTH_PASSWORD,
    });

    function update() {
        exec('zone-update', () => {
            save();
            sendAll('status', { text: 'restarting server' });
            exec('zone-restart');
        });
    }

    authCommands.set('update', update);
    authCommands.set('refresh-videos', refreshLocalVideos);

    // trust glitch's proxy to give us socket ips
    app.set('trust proxy', true);
    app.use('/', express.static('public'));
    app.use('/media', express.static('media'));
    app.get('/youtube/:videoId', (req, res) => {
        const videoId = req.params.videoId;
        const path = youtube.ensureDownloading(videoId);

        if (path) {
            res.sendFile(path);
        } else {
            youtube.direct(videoId).then(
                (url) => req.pipe(request(url)).pipe(res),
                () => res.status(503),
            );
        } 
    });

    app.get(/^\/archive\/(.+)/, (req, res) => {
        const url = `https://archive.org/download/${req.params[0]}`;
        req.pipe(request(url)).pipe(res);
    });

    process.on('SIGINT', () => {
        console.log('exiting due to SIGINT');
        save();
        sendAll('status', { text: 'manual shutdown' });
        process.exit();
    });

    const durationCommand =
        'ffprobe -v error -select_streams a:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1';

    function getDuration(file: string): Promise<number> {
        return new Promise((resolve, reject) => {
            exec(`${durationCommand} "${file}"`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve(parseFloat(stdout) * 1000);
            });
        });
    }

    function refreshLocalVideos() {
        localLibrary.clear();
        glob('media/**/*.mp4', (error, matches) => {
            matches.forEach(async (path) => {
                const title = basename(path, extname(path));
                const duration = await getDuration(path);
                const media: Media = { title, duration, source: path };
                localLibrary.set(title, media);
            });
        });
        glob('media/**/*.mp3', (error, matches) => {
            matches.forEach(async (path) => {
                const title = basename(path, extname(path));
                const duration = await getDuration(path);
                const media: Media = { title, duration, source: path };
                localLibrary.set(title, media);
            });
        });
    }

    refreshLocalVideos();
}

run();
