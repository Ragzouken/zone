import * as express from 'express';
import * as expressWs from 'express-ws';
import * as http from 'http';
import * as https from 'https';
import * as request from 'request';
import * as youtube from './youtube';
import * as glob from 'glob';
import { promises as fs } from 'fs';
import { basename, extname, dirname } from 'path';
import { host } from './server';
import { exec } from 'child_process';
import FileSync = require('lowdb/adapters/FileSync');
import { Media } from '../common/zone';
import path = require('path');
import { Resolver } from 'dns';

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
    relisten();
    server.on('error', (error) => console.log('server error', error));

    setInterval(() => {
        server.getConnections((e, count) => console.log(`connections: ${count} / ${server.maxConnections}`));
    }, 5000);

    const dataPath = process.env.ZONE_DATA_PATH || '.data/db.json';
    fs.mkdir(path.dirname(dataPath)).catch(() => {});
    const adapter = new FileSync(dataPath, { serialize: JSON.stringify, deserialize: JSON.parse });

    const { save, sendAll, authCommands, localLibrary } = host(xws, adapter, {
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

    // trust glitch's proxy to give us socket ips
    app.set('trust proxy', true);
    app.use('/', express.static('public'));
    app.use('/media', express.static('media'));
    app.get('/youtube/:videoId', async (req, res) => {
        // desperation
        req.on('error', (e) => console.log("req:", e));
        res.on('error', (e) => console.log("res:", e));

        if (process.env.YOUTUBE_BROKE) {
            res.status(503).send('Youtube machine broke.');
            return;
        }

        try {
            const url = await youtube.direct(req.params.videoId);
            const direct = request(url);
            
            // proxied request can die and needs to be killed
            direct.on('error', (e) => {
                console.log("proxy died:", e.name, e.message);
                
                direct.destroy();
                res.destroy();
            });

            req.pipe(direct).pipe(res).on('error', (e) => console.log("pipe:", e));
        } catch (e) {
            res.status(503).send(`youtube error: ${e}`);
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

    function getDuration(file: string): Promise<number> {
        return new Promise((resolve, reject) => {
            exec(`${durationCommand} '${file.replace(/'/g, "'\\''")}'`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve(parseFloat(stdout) * 1000);
            });
        });
    }

    async function addLocal(path: string) {
        const title = basename(path, extname(path));
        try {
            const duration = await getDuration(path);
            const media: Media = { title, duration, source: path };
            localLibrary.set(title, media);
        } catch (e) {
            console.log(`LOCAL FAILED "${title}": ${e}`);
        }
    }

    function refreshLocalVideos() {
        localLibrary.clear();
        glob('media/**/*.mp4', (error, matches) => matches.forEach(addLocal));
        glob('media/**/*.mp3', (error, matches) => matches.forEach(addLocal));
    }

    refreshLocalVideos();
}

run();
