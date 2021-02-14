import * as express from 'express';
import * as expressWs from 'express-ws';
import { promises as fs } from 'fs';
import { host } from './server';
import FileSync = require('lowdb/adapters/FileSync');
import path = require('path');
import { Library } from './libraries';

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

    const libraries: Map<string, Library> = new Map();
    if (process.env.LIBRARY_ENDPOINT) libraries.set("library", new Library(process.env.LIBRARY_ENDPOINT));
    if (process.env.YOUTUBE_ENDPOINT) libraries.set("youtube", new Library(process.env.YOUTUBE_ENDPOINT, process.env.YOUTUBE_AUTHORIZATION));

    const { save, sendAll } = host(xws, adapter, {
        authPassword: process.env.AUTH_PASSWORD || 'riverdale',
        libraries,
    });

    // trust glitch's proxy to give us socket ips
    app.set('trust proxy', true);
    app.use('/', express.static('public'));

    process.on('SIGINT', () => {
        console.log('exiting due to SIGINT');
        save();
        sendAll('status', { text: 'manual shutdown' });
        process.exit();
    });
}

run();
