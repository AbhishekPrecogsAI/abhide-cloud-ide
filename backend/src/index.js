import 'dotenv/config';
import http from 'node:http';
import { createRequire } from 'node:module';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import fileRoutes from './routes/files.js';
import Project from './models/Project.js';

// y-websocket's server helper is CJS
const require = createRequire(import.meta.url);
const { setupWSConnection } = require('y-websocket/bin/utils');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ---- Realtime collaboration ----
// /yjs/<projectId> — shared CRDT doc (code + chat)
// /rtc/<projectId> — WebRTC voice signaling relay
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (conn, req) => setupWSConnection(conn, req));

const rtcWss = new WebSocketServer({ noServer: true });
const rtcRooms = new Map(); // projectId -> Map(peerId -> { ws, user })

rtcWss.on('connection', (ws, projectId) => {
  const id = crypto.randomUUID();
  if (!rtcRooms.has(projectId)) rtcRooms.set(projectId, new Map());
  const room = rtcRooms.get(projectId);

  const sendTo = (peerId, msg) => {
    const p = room.get(peerId);
    if (p?.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
  };
  const broadcast = (msg, except) => {
    room.forEach((p, pid) => {
      if (pid !== except && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
    });
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'join') {
      // tell the newcomer who's here, then announce them
      const peers = [...room.entries()].map(([pid, p]) => ({ id: pid, user: p.user }));
      room.set(id, { ws, user: msg.user });
      ws.send(JSON.stringify({ type: 'peers', id, peers }));
      broadcast({ type: 'peer-joined', id, user: msg.user }, id);
    } else if (msg.type === 'signal' && msg.to) {
      sendTo(msg.to, { type: 'signal', from: id, data: msg.data });
    }
  });

  ws.on('close', () => {
    if (room.delete(id)) broadcast({ type: 'peer-left', id });
    if (room.size === 0) rtcRooms.delete(projectId);
  });
});

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const m = url.pathname.match(/^\/(yjs|rtc)\/([a-f0-9]{24})$/i);
    if (!m) return socket.destroy();
    const [, kind, projectId] = m;

    // Auth: valid JWT + project membership (owner or collaborator)
    const token = url.searchParams.get('token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const project = await Project.findOne({
      _id: projectId,
      $or: [{ owner: decoded.id }, { collaborators: decoded.id }],
    }).select('_id');
    if (!project) return socket.destroy();

    if (kind === 'yjs') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      rtcWss.handleUpgrade(req, socket, head, (ws) => rtcWss.emit('connection', ws, projectId));
    }
  } catch {
    socket.destroy();
  }
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB connected');
    server.listen(PORT, () =>
      console.log(`✓ Server (HTTP + WS) running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error('✗ Failed to start:', err.message);
    process.exit(1);
  }
}

start();
