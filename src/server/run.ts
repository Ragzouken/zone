import * as express from 'express';
import { host } from './server';
import FileSync = require('lowdb/adapters/Memory');

const { server, app } = host(new FileSync('.data/db.json'), {
    listenHandle: process.env.PORT || 8080,
    joinPassword: process.env.JOIN_PASSWORD,
    skipPassword: process.env.SKIP_PASSWORD,
    rebootPassword: process.env.REBOOT_PASSWORD,
});

// trust glitch's proxy to give us socket ips
app.set('trust proxy', true);
app.use('/', express.static('public'));
server.on('listening', () => console.log('listening...'));
