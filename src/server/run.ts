import * as express from 'express';
import { host } from './server';
import { exec } from 'child_process';

import FileSync = require('lowdb/adapters/Memory');

const dataPath = process.env.ZONE_DATA_PATH || '.data/db.json';
const adapter = new FileSync(dataPath);

const { server, app, save, sendAll } = host(adapter, {
    listenHandle: process.env.PORT || 8080,
    joinPassword: process.env.JOIN_PASSWORD,
    skipPassword: process.env.SKIP_PASSWORD,
});

// trust glitch's proxy to give us socket ips
app.set('trust proxy', true);
app.use('/', express.static('public'));
app.get('/update/:password', (req, res) => {
    if ((req.params.password || "") === process.env.UPDATE_PASSWORD) {
        res.sendStatus(200);
        exec('update-zone', () => {
            save();
            sendAll('status', { text: 'restarting server' });
            exec('restart-zone');
        });
    } else {
        res.sendStatus(401)
    }
})

process.on('SIGINT', () => {
    console.log('exiting due to SIGINT');
    save();
    sendAll('status', { text: 'manual shutdown' });
    process.exit();
});

server.on('listening', () => console.log('listening...'));
