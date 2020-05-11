import * as express from 'express';
import * as expressWs from 'express-ws';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { host } from './server';
import { exec } from 'child_process';
import FileSync = require('lowdb/adapters/FileSync');

const app = express();
let server: http.Server | https.Server;
let redirectServer: http.Server;

const secure = process.env.CERT_PATH && process.env.KEY_PATH;

if (secure) {
    const key = fs.readFileSync(process.env.KEY_PATH!);
    const cert = fs.readFileSync(process.env.CERT_PATH!);
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
server.listen(process.env.PORT || 4000, () => console.log('listening...'));

const dataPath = process.env.ZONE_DATA_PATH || '.data/db.json';
const adapter = new FileSync(dataPath);

const { save, sendAll, authCommands } = host(xws, adapter, {
    joinPassword: process.env.JOIN_PASSWORD,
    authPassword: process.env.AUTH_PASSWORD,
});

function update() {
    exec('update-zone', () => {
        save();
        sendAll('status', { text: 'restarting server' });
        exec('restart-zone');
    });
}

authCommands.set('update', update);

// trust glitch's proxy to give us socket ips
app.set('trust proxy', true);
app.use('/', express.static('public'));
app.get('/update/:password', (req, res) => {
    if ((req.params.password || '') === process.env.UPDATE_PASSWORD) {
        res.sendStatus(200);
        update();
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
