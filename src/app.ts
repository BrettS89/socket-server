//@ts-nocheck
import path from 'path';
import favicon from 'serve-favicon';
import compress from 'compression';
import helmet from 'helmet';
import cors from 'cors';

import feathers from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import express from '@feathersjs/express';
import socketio from '@feathersjs/socketio';


import { Application } from './declarations';
import logger from './logger';
import middleware from './middleware';
import services from './services';
import appHooks from './app.hooks';
import channels from './channels';
import { HookContext as FeathersHookContext } from '@feathersjs/feathers';
// Don't remove this comment. It's needed to format import lines nicely.

const app: Application = express(feathers());
export type HookContext<T = any> = { app: Application } & FeathersHookContext<T>;

// Load app configuration
app.configure(configuration());
// Enable security, CORS, compression, favicon and body parsing
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(compress());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
// Host the public folder
app.use('/', express.static(app.get('public')));

// Set up Plugins and providers
app.configure(express.rest());

const sockets: Record<string, any> = {};
// const userIdToSockets: Record<string, any> = {};

app.configure(socketio(io => {

  io.on('connection', socket => {
    const userId = socket.handshake.query.id
    const socketId = socket.conn.id;

    socket.userId = userId

    const found = sockets[userId]?.find((s: SocketIO.Socket) => s?.conn?.id === socketId);

    if (found) {
      return;
    }

    sockets[userId] = Array.isArray(sockets[userId])
      ? [...sockets[userId], socket]
      : [socket];

    console.log(sockets)

    socket.conn.on('close', () => {
      const foundSockets = sockets[socket.userId];
      const filteredSockets = foundSockets.filter((s: SocketIO.Socket) => s.conn.id !== socket.conn.id);

      sockets[socket.userId] = filteredSockets;

      if (!sockets[socket.userId].length) {
        delete sockets[socket.userId]
      }

      socket.removeAllListeners();

      console.log(sockets);
    })
  })

}));

// Configure other middleware (see `middleware/index.ts`)
app.configure(middleware);
// Set up our services (see `services/index.ts`)
app.configure(services);
// Set up event channels (see channels.ts)
// app.configure(channels);

// Configure a middleware for 404s and the error handler
app.use(express.notFound());
app.use(express.errorHandler({ logger } as any));

app.hooks(appHooks);

export default app;
