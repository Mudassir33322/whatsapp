import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { existsSync, mkdirSync, rmSync } from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import { 
  query, 
  saveChatMessage, 
  logProfileVisit 
} from './db';
import { setupSalonRoutes } from './salon-routes';
import { setupAdminRoutes } from './admin-routes';
import { handleIncomingMessage } from './bot';
import { setWASocket, startNotificationScheduler } from './notification-service';
import { startRecurringScheduler } from './server-recurring';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'salonlink-super-secret-key-change-in-prod';

// Logs directory
const logsDir = path.join(process.cwd(), 'logs');
if (!existsSync(logsDir)) { mkdirSync(logsDir, { recursive: true }); }
const logger = pino({ level: 'info' }, pino.destination(path.join(logsDir, 'error.txt')));

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const PORT = process.env.PORT || 3000;

  const sessions = new Map();
  const connectingSessions = new Set<string>();
  const reconnectAttempts = new Map<string, number>();
  const processedMessages = new Set<string>();

  app.use(express.json());

  // --- WhatsApp Logic --------------------------------------------------------
  async function connectToWhatsApp(sessionId: string) {
    if (connectingSessions.has(sessionId)) {
      console.log(`[WhatsApp] Connection already in progress for ${sessionId}`);
      return;
    }
    connectingSessions.add(sessionId);

    try {
      const authPath = path.join(process.cwd(), `auth-info-${sessionId}`);
      if (!existsSync(authPath)) { mkdirSync(authPath, { recursive: true }); }

      const oldSession = sessions.get(sessionId);
      if (oldSession?.socket) {
        try { oldSession.socket.end(undefined); } catch (_) {}
      }

      const { state, saveCreds } = await useMultiFileAuthState(authPath);
      const { version } = await fetchLatestBaileysVersion();

      console.log(`[WhatsApp] Connecting ${sessionId} (v${version.join('.')})`);

      const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000
      });

      sessions.set(sessionId, { socket: sock, status: 'CONNECTING' });
      if (sessionId === 'autozap-admin') setWASocket(sock);

      sock.ev.on('creds.update', saveCreds);
      
      sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;
        
        if (qr) {
          sessions.set(sessionId, { socket: sock, status: 'QR_READY', qr });
          io.emit('session-status', { sessionId, status: 'QR_READY', qr });
        }

        if (connection === 'open') {
          console.log(`[WhatsApp] ${sessionId} CONNECTED`);
          sessions.set(sessionId, { socket: sock, status: 'CONNECTED', user: sock.user?.id });
          io.emit('session-status', { sessionId, status: 'CONNECTED', user: sock.user?.id });
          connectingSessions.delete(sessionId);
          reconnectAttempts.delete(sessionId);
        }

        if (connection === 'close') {
          const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
          console.log(`[WhatsApp] ${sessionId} CLOSED (Code: ${code})`);
          
          connectingSessions.delete(sessionId);

          if (code === DisconnectReason.loggedOut) {
            try { rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
            sessions.delete(sessionId);
            io.emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Logged out' });
          } else {
            const attempts = reconnectAttempts.get(sessionId) || 0;
            if (attempts < 10) {
              reconnectAttempts.set(sessionId, attempts + 1);
              const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
              setTimeout(() => connectToWhatsApp(sessionId), delay);
            }
          }
        }
      });

      sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue;
          
          const msgId = msg.key.id;
          if (msgId && processedMessages.has(msgId)) continue;
          if (msgId) {
            processedMessages.add(msgId);
            if (processedMessages.size > 1000) {
              const firstVal = processedMessages.values().next().value;
              if (firstVal) processedMessages.delete(firstVal);
            }
          }

          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
          const sender = msg.key.remoteJid;
          if (!sender || !text) continue;

          // Save to Inbox
          await saveChatMessage({ sessionId, phone: sender, pushName: msg.pushName || undefined, text, fromMe: false });

          // Bot logic
          const botReply = async (to: string, t: string) => {
            await sock.sendMessage(to, { text: t });
            await saveChatMessage({ sessionId, phone: to, text: t, fromMe: true });
          };
          
          await handleIncomingMessage(botReply, null, null, null, sender, text, msg.pushName);
        }
      });

    } catch (e) {
      connectingSessions.delete(sessionId);
      console.error(`[WhatsApp] Failed to connect ${sessionId}:`, e);
    }
  }

  // --- Routes --------------------------------------------------------
  setupSalonRoutes(app);
  setupAdminRoutes(app, { sessions, connectToWhatsApp, connectingSessions, io });

  app.get('/api/health', (req, res) => res.json({ status: 'ok', sessions: sessions.size, uptime: process.uptime() }));

  // --- Socket.IO Handlers --------------------------------------------
  io.on('connection', (socket) => {
    const token = socket.handshake?.auth?.token;
    let isSuperAdmin = false;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        isSuperAdmin = decoded.role === 'super_admin';
      } catch {}
    }

    socket.on('join-session', (sid) => {
      socket.join(`session-${sid}`);
      const s = sessions.get(sid);
      if (s) socket.emit('session-status', { sessionId: sid, status: s.status, qr: s.qr, user: s.user });
    });

    socket.on('init-session', (sid) => {
      if (!isSuperAdmin) return;
      connectToWhatsApp(sid).catch(() => {});
    });

    socket.on('restart-session', (sid) => {
      if (!isSuperAdmin) return;
      const s = sessions.get(sid);
      if (s?.socket) { try { s.socket.end(undefined); } catch (_) {} }
      sessions.delete(sid);
      connectingSessions.delete(sid);
      const authPath = path.join(process.cwd(), `auth-info-${sid}`);
      try { rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
      io.emit('session-status', { sessionId: sid, status: 'DISCONNECTED', message: 'Restarting...' });
      setTimeout(() => connectToWhatsApp(sid), 1000);
    });
  });

  // Vite / Static
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist/index.html')));
  }

  httpServer.listen(PORT, () => {
    console.log(`🚀 Platform running on http://localhost:${PORT}`);
    connectToWhatsApp('autozap-admin').catch(() => {});
    startNotificationScheduler();
    startRecurringScheduler();
  });
}

startServer().catch(err => console.error('[Server Start Error]', err));
