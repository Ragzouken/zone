import * as express from 'express';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { host } from './server';
import { exec } from 'child_process';

import FileSync = require('lowdb/adapters/FileSync');

const dataPath = process.env.ZONE_DATA_PATH || '.data/db.json';
const adapter = new FileSync(dataPath);

const { app, save, sendAll } = host(adapter, {
    joinPassword: process.env.JOIN_PASSWORD,
    skipPassword: process.env.SKIP_PASSWORD,
});

// trust glitch's proxy to give us socket ips
app.set('trust proxy', true);
app.use('/', express.static('public'));
app.get('/update/:password', (req, res) => {
    if ((req.params.password || '') === process.env.UPDATE_PASSWORD) {
        res.sendStatus(200);
        exec('update-zone', () => {
            save();
            sendAll('status', { text: 'restarting server' });
            exec('restart-zone');
        });
    } else {
        res.sendStatus(401);
    }
});

process.on('SIGINT', () => {
    console.log('exiting due to SIGINT');
    save();
    sendAll('status', { text: 'manual shutdown' });
    process.exit();
});

let server: http.Server | https.Server;
const secure = process.env.CERT_PATH && process.env.KEY_PATH;

if (secure) {
    const key = fs.readFileSync(process.env.KEY_PATH!);
    const cert = fs.readFileSync(process.env.CERT_PATH!);
    server = https.createServer({ key, cert }, app);
} else {
    server = http.createServer(app);
}

server.listen(process.env.PORT || 4000, () => console.log('listening...'));
