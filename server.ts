import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { existsSync, mkdirSync, rmSync, readFileSync, truncateSync, statSync } from 'fs';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import {
  query,
  pool,
  saveChatMessage
} from './db';
import { setupSalonRoutes } from './salon-routes';
import { setupAdminRoutes } from './admin-routes';
import { setupCustomerRoutes } from './customer-routes';
import { setupExportRoutes } from './export-routes';
import { handleIncomingMessage } from './bot';
import { setWASocket, setWAConnected, isWAConnected, startNotificationScheduler, removeSessionSocket } from './notification-service';
import { startRecurringScheduler } from './server-recurring';
import { verifyAccessToken } from './auth-helper';
import { initTokenRevocation } from './token-revocation';
import { parseId } from './middleware';

dotenv.config();

// Logs directory
const logsDir = path.join(process.cwd(), 'logs');
if (!existsSync(logsDir)) { mkdirSync(logsDir, { recursive: true }); }
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!existsSync(uploadsDir)) { mkdirSync(uploadsDir, { recursive: true }); }
const logFile = path.join(logsDir, 'error.txt');
try { const sz = statSync(logFile).size; if (sz > 5 * 1024 * 1024) { truncateSync(logFile, 0); console.log('[Server] Log file truncated (>5MB)'); } } catch (_) {}
const isDev = process.env.NODE_ENV !== 'production';
const logger = isDev
  ? pino({ level: 'warn' }, pino.destination(logFile))
  : pino({ level: 'error' }); // Production: no file I/O, errors only

function hasSavedCredsNow(authPath: string): boolean {
  try {
    const credsPath = path.join(authPath, 'creds.json');
    if (existsSync(credsPath)) {
      const data = JSON.parse(readFileSync(credsPath, 'utf-8'));
      return !!(data?.registered || data?.me?.id);
    }
  } catch {}
  return false;
}

function isSessionStale(sessions: Map<string, any>, sessionId: string): boolean {
  const s = sessions.get(sessionId);
  if (!s) return true;
  if (s.status === 'LOGGED_OUT') return true;
  return false;
}

async function startServer() {
  const app = express();
  // Security headers (relaxed for Vite dev mode)
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  }));

  // Global rate limit — 200 requests per minute per IP (backpressure against floods)
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
  });
  app.use('/api/', globalLimiter);

  // Stricter limiter for auth/OTP/booking endpoints (prevents brute-force and abuse
  // that could otherwise take the server down under heavy concurrent load).
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login/OTP attempts. Please try again in 1 minute.' }
  });
  app.use('/api/customer/auth/', authLimiter);
  app.use('/api/salon/auth/login', authLimiter);
  app.use('/api/admin/login', authLimiter);
  app.use('/api/public/', rateLimit({
    windowMs: 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
  }));

  // ─── Overload / load-shedding guard ────────────────────────────────
  // Samples event-loop lag. If the server is severely overloaded (e.g. 100k
  // concurrent requests on a single process), we shed non-essential load fast
  // with 503 instead of letting the event loop spiral into a crash.
  let lastLoopSample = process.hrtime.bigint();
  let lagMs = 0;
  setInterval(() => {
    const now = process.hrtime.bigint();
    const delta = Number(now - lastLoopSample) / 1e6;
    lastLoopSample = now;
    lagMs = delta;
  }, 1000);
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only shed load when the loop is critically backed up (>2s behind).
    if (lagMs > 2000 && req.method === 'GET' && !req.path.startsWith('/api/health')) {
      return res.status(503).json({ error: 'Server is currently overloaded. Please try again later.' });
    }
    next();
  });

  const httpServer = createServer(app);
  let resolvedCors: string | string[] | false = process.env.CORS_ORIGIN || '*';
  if (process.env.NODE_ENV === 'production') {
    if (process.env.CORS_ORIGIN) {
      resolvedCors = process.env.CORS_ORIGIN.split(',').map(s => s.trim());
    } else {
      resolvedCors = false;
    }
  }
  const io = new Server(httpServer, {
    cors: { origin: resolvedCors },
    maxHttpBufferSize: 1 * 1024 * 1024
  });
  const PORT = process.env.PORT || 3001;

  interface SessionEntry {
    socket: any;
    status: string;
    qr?: string | null;
    user?: string;
    lastActivity?: number;
  }
  const sessions = new Map<string, SessionEntry>();
  const connectingSessions = new Set<string>();
  const reconnectAttempts = new Map<string, number>();
  const reconnectLocks = new Set<string>();
  const processedMessages = new Set<string>();
  const processedMessageTimestamps = new Map<string, number>();
  const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const noCredsCooldowns = new Map<string, number>();

  function isInNoCredsCooldown(sessionId: string): boolean {
    const lastAttempt = noCredsCooldowns.get(sessionId);
    if (!lastAttempt) return false;
    if (Date.now() - lastAttempt > 15000) {
      noCredsCooldowns.delete(sessionId);
      return false;
    }
    return true;
  }

// Periodic cleanup of stale reconnect maps (every 30 min)
  setInterval(() => {
    for (const [sid] of Array.from(reconnectAttempts)) {
      if (!sessions.has(sid)) reconnectAttempts.delete(sid);
    }
    for (const [sid, timer] of Array.from(reconnectTimers)) {
      if (!sessions.has(sid)) {
        clearTimeout(timer);
        reconnectTimers.delete(sid);
      }
    }
    for (const [sid] of Array.from(noCredsCooldowns)) {
      if (!sessions.has(sid)) noCredsCooldowns.delete(sid);
    }
    // Clean up stale & ERROR state sessions (keep DISCONNECTED for reconnect)
    const now = Date.now();
    for (const [sid, sock] of Array.from(sessions)) {
      try {
        const isStale = sock.status === 'ERROR' || sock.status === 'LOGGED_OUT';
        const isTimestampOld = sock.lastActivity && (now - sock.lastActivity > 60 * 60 * 1000);
        if (isStale || isTimestampOld) {
          const hasReconnectAttempts = reconnectAttempts.has(sid);
          if (!hasReconnectAttempts) {
            cleanupSession(sid);
            sessions.delete(sid);
            connectingSessions.delete(sid);
            reconnectAttempts.delete(sid);
          }
        }
      } catch { sessions.delete(sid); }
    }
    // Trim processedMessages: remove entries older than 2 minutes (was 5)
    const cutoff = Date.now() - 2 * 60 * 1000;
    for (const [id, time] of Array.from(processedMessageTimestamps)) {
      if (time < cutoff) {
        processedMessages.delete(id);
        processedMessageTimestamps.delete(id);
      }
    }
    // Trim if too large - just delete oldest 50% in O(n) instead of sort
    if (processedMessages.size > 3000) {
      let deleted = 0;
      const target = Math.floor(processedMessages.size / 2);
      for (const [id, time] of Array.from(processedMessageTimestamps)) {
        if (deleted >= target) break;
        processedMessages.delete(id);
        processedMessageTimestamps.delete(id);
        deleted++;
      }
}
  }, 5 * 60 * 1000);

app.use(compression());
app.use(express.json({ limit: '512kb' }));
   app.use(express.urlencoded({ extended: true, limit: '512kb' }));
    // Request logging middleware (dev only) — skip static files
    if (process.env.NODE_ENV !== 'production') {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (req.path.startsWith('/@') || req.path.startsWith('/node_modules') || req.path === '/favicon.ico') return next();
        const start = Date.now();
        res.on('finish', () => {
          const ms = Date.now() - start;
          if (ms > 1000) console.log(`[SLOW] ${req.method} ${req.path} -> ${res.statusCode} (${ms}ms)`);
        });
        next();
      });
    }
    // Request timeout — only for API routes, not static assets.
   // Explicit timer so uploads/long handlers are hard-aborted (prevents a
   // single slow request from pinning a worker under heavy concurrent load).
   app.use('/api/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
     const isUpload = req.path.includes('/upload') || req.path.includes('/media');
     const limit = isUpload ? 60000 : 30000;
     let aborted = false;
     const timer = setTimeout(() => {
       if (aborted || res.writableEnded) return;
       aborted = true;
       try { req.destroy(); } catch (_) {}
       if (!res.headersSent) {
         res.status(408).json({ error: 'Request timeout. Please try again.' });
       }
     }, limit);
     res.on('finish', () => { aborted = true; clearTimeout(timer); });
     res.on('close', () => { aborted = true; clearTimeout(timer); });
     next();
   });

  // ─── DB Migration: Add assigned_admin_id to salons ────────────────
  (async () => {
    if (process.env.USE_SQLITE === 'true') return; // SQLite already has this column
    try {
      const dbName = process.env.DB_NAME || 'autozap_platform';
      const check = await query(
        "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'salons' AND COLUMN_NAME = 'assigned_admin_id'",
        [dbName]
      );
      if (check[0]?.cnt === 0) {
        await query("ALTER TABLE salons ADD COLUMN assigned_admin_id INT NULL AFTER area_id, ADD FOREIGN KEY (assigned_admin_id) REFERENCES admins(id) ON DELETE SET NULL");
        console.log('[Migration] Added assigned_admin_id column to salons table');
      }
    } catch (e) {
      console.warn('[Migration] Could not add assigned_admin_id:', e);
    }
  })();

  function cleanupSession(sessionId: string) {
    const timer = reconnectTimers.get(sessionId);
    if (timer) { clearTimeout(timer); reconnectTimers.delete(sessionId); }
    reconnectLocks.delete(sessionId);
    reconnectAttempts.delete(sessionId);
    noCredsCooldowns.delete(sessionId);
    const s = sessions.get(sessionId);
    if (s?.socket) {
      try { s.socket.ev.removeAllListeners('connection.update'); } catch (_) {}
      try { s.socket.ev.removeAllListeners('creds.update'); } catch (_) {}
      try { s.socket.ev.removeAllListeners('messages.upsert'); } catch (_) {}
      try { if (s.socket.ws?.close) s.socket.ws.close(); } catch (_) {}
    }
    connectingSessions.delete(sessionId);
    removeSessionSocket(sessionId);
  }

// --- WhatsApp Logic --------------------------------------------------------
  async function connectToWhatsApp(sessionId: string) {
    if (connectingSessions.has(sessionId)) {
      console.log(`[WhatsApp] Connection already in progress for ${sessionId}`);
      return;
    }

    const dataDir = process.env.DATA_DIR || process.cwd();
    const authPath = path.join(dataDir, `auth-info-${sessionId}`);
    if (!existsSync(authPath)) { mkdirSync(authPath, { recursive: true }); }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const hasSavedCreds = !!(state.creds?.registered || state.creds?.me?.id);
    console.log(`[WhatsApp] Connecting ${sessionId} hasSavedCreds=${hasSavedCreds}`);

    // Guard: if no saved creds and we recently attempted (cooldown), block auto-reconnect loops.
    // This prevents Socket.IO join-session / init-session from hammering connectToWhatsApp
    // when the close handler has already decided there are no creds.
    if (!hasSavedCreds && isInNoCredsCooldown(sessionId)) {
      console.log(`[WhatsApp] ${sessionId} no saved creds + cooldown active — blocking connection`);
      connectingSessions.delete(sessionId);
      sessions.set(sessionId, { socket: null, status: 'ERROR', qr: null, lastActivity: Date.now() });
      io.to(`session-${sessionId}`).emit('session-status', {
        sessionId, status: 'ERROR', message: 'Connection failed. Tap "Generate Live QR" to retry.'
      });
      return;
    }

    connectingSessions.add(sessionId);

    try {
      // Put session in map early so joiners always get a status
      const hadSocket = !!(sessions.get(sessionId)?.socket);
      if (hadSocket) cleanupSession(sessionId);
      sessions.set(sessionId, { socket: null, status: 'CONNECTING' });

      const sock = makeWASocket({
        browser: Browsers.ubuntu('Chrome'),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        connectTimeoutMs: 180000,
        keepAliveIntervalMs: 15000,
        emitOwnEvents: true,
        generateHighQualityLinkPreview: false,
        qrTimeout: 180000,
      });

      sessions.set(sessionId, { socket: sock, status: 'CONNECTING' });
      setWASocket(sock, sessionId);

      sock.ev.on('creds.update', saveCreds);
      
      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, qr, lastDisconnect } = update;
          const session = sessions.get(sessionId);
          if (!session) return;

          if (qr && !isSessionStale(sessions, sessionId)) {
            sessions.set(sessionId, { ...session, socket: sock, status: 'QR_READY', qr });
            console.log(`[WhatsApp] ${sessionId} QR generated (hasSavedCreds=${hasSavedCreds})`);
            io.to(`session-${sessionId}`).emit('session-status', { sessionId, status: 'QR_READY', qr });
          }

          if (connection === 'open') {
            console.log(`[WhatsApp] ${sessionId} CONNECTED`);
            sessions.set(sessionId, { socket: sock, status: 'CONNECTED', user: sock.user?.id, lastActivity: Date.now() });
            io.to(`session-${sessionId}`).emit('session-status', { sessionId, status: 'CONNECTED', user: sock.user?.id });
            connectingSessions.delete(sessionId);
            reconnectAttempts.delete(sessionId);
            reconnectLocks.delete(sessionId);
            const t = reconnectTimers.get(sessionId);
            if (t) { clearTimeout(t); reconnectTimers.delete(sessionId); }
            if (sessionId === 'autozap-admin') setWAConnected(true);
            await query(
              'INSERT INTO whatsapp_sessions (session_id, name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = ?',
              [sessionId, sessionId, 'connected', 'connected']
            ).catch(() => {});
          }

          if (connection === 'close') {
            const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
            console.log(`[WhatsApp] ${sessionId} CLOSED (Code: ${code})${code === 515 ? ' — Stream Error (WhatsApp rejecting)' : ''}`);

            if (isSessionStale(sessions, sessionId)) {
              console.log(`[WhatsApp] ${sessionId} is stale, skipping reconnect`);
              connectingSessions.delete(sessionId);
              return;
            }

            if (sessionId === 'autozap-admin') setWAConnected(false);

            if (code === DisconnectReason.loggedOut) {
              console.log(`[WhatsApp] ${sessionId} Logged out — clearing auth`);
              try { rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
              sessions.delete(sessionId);
              reconnectAttempts.delete(sessionId);
              reconnectLocks.delete(sessionId);
              noCredsCooldowns.delete(sessionId);
              const t = reconnectTimers.get(sessionId);
              if (t) { clearTimeout(t); reconnectTimers.delete(sessionId); }
              io.to(`session-${sessionId}`).emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Logged out' });
              connectingSessions.delete(sessionId);
               // Auto reconnect with fresh QR after logout
               setTimeout(() => connectToWhatsApp(sessionId).catch(() => {}), 5000);
               return;
            } else if (!hasSavedCredsNow(authPath)) {
              console.log(`[WhatsApp] ${sessionId} no saved creds — waiting for user to scan QR`);
              sessions.set(sessionId, { socket: null, status: 'QR_READY', qr: null, lastActivity: Date.now() });
              io.to(`session-${sessionId}`).emit('session-status', {
                sessionId, status: 'DISCONNECTED', message: 'QR expired. Scan new QR from phone to reconnect.'
              });
              reconnectAttempts.delete(sessionId);
              reconnectLocks.delete(sessionId);
              noCredsCooldowns.delete(sessionId);
              const t = reconnectTimers.get(sessionId);
              if (t) { clearTimeout(t); reconnectTimers.delete(sessionId); }
              connectingSessions.delete(sessionId);
              // Don't auto-reconnect — wait for user to trigger fresh connection
            } else {
              if (reconnectLocks.has(sessionId)) {
                console.log(`[WhatsApp] ${sessionId} reconnect already in progress, skipping`);
                return;
              }
              reconnectLocks.add(sessionId);
              try {
                const attempts = reconnectAttempts.get(sessionId) || 0;
                const maxAttempts = 15;
                if (attempts >= maxAttempts) {
                  console.log(`[WhatsApp] ${sessionId} max reconnect attempts (${maxAttempts}) reached`);
                  const isStreamError = code === 515;
                  io.to(`session-${sessionId}`).emit('session-status', {
                    sessionId, status: 'ERROR', message: isStreamError
                      ? 'WhatsApp connection rejected (Error 515). Please go to WhatsApp > Linked Devices on your phone, remove old AutoZap sessions, then restart.'
                      : 'Max reconnect attempts reached. Please restart session.'
                  });
                  sessions.set(sessionId, { socket: null, status: 'ERROR', lastActivity: Date.now() });
                  reconnectLocks.delete(sessionId);
                  connectingSessions.delete(sessionId);
                  return;
                }
                reconnectAttempts.set(sessionId, attempts + 1);
                // Exponential backoff with jitter (cap at 30s)
                const delay = Math.min(1000 * Math.pow(1.5, attempts), 30000) + Math.floor(Math.random() * 2000);
                console.log(`[WhatsApp] ${sessionId} reconnecting in ${Math.round(delay)}ms (attempt ${attempts + 1})`);

                // Don't clear auth on timeout — only on actual logout
                // Show reconnecting status to client
                sessions.set(sessionId, { socket: sock, status: 'RECONNECTING', lastActivity: Date.now() });
                io.to(`session-${sessionId}`).emit('session-status', {
                  sessionId, status: 'RECONNECTING',
                  message: `Reconnecting (attempt ${attempts + 1})...`
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                connectingSessions.delete(sessionId);
                try {
                  await connectToWhatsApp(sessionId);
                } catch (err: any) {
                  console.error(`[WhatsApp] ${sessionId} reconnect failed:`, err?.message || err);
                } finally {
                  reconnectLocks.delete(sessionId);
                }
              } catch (e: any) {
                console.error(`[WhatsApp] ${sessionId} reconnect loop error:`, e?.message || e);
                reconnectLocks.delete(sessionId);
                connectingSessions.delete(sessionId);
              }
            }
          }
        } catch (e: any) {
          console.error(`[WhatsApp] ${sessionId} connection.update handler error:`, e?.message || e);
          io.to(`session-${sessionId}`).emit('session-status', {
            sessionId, status: 'ERROR', message: 'Connection update error'
          });
          reconnectLocks.delete(sessionId);
          connectingSessions.delete(sessionId);
        }
      });

      sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        try {
          for (const msg of m.messages) {
            if (!msg.message || msg.key.fromMe) continue;
            
            const msgId = msg.key.id;
            if (msgId) {
              // Atomic check-add to prevent TOCTOU race
              if (processedMessages.has(msgId)) continue;
              processedMessages.add(msgId);
              processedMessageTimestamps.set(msgId, Date.now());
            }

            const sender = msg.key.remoteJid;
            if (!sender) continue;

            // Extract text from various message types
            let text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            let messageType: string | null = null;

            if (!text) {
              if (msg.message.imageMessage) {
                messageType = 'image';
                text = msg.message.imageMessage.caption || '[Image]';
              } else if (msg.message.videoMessage) {
                messageType = 'video';
                text = msg.message.videoMessage.caption || '[Video]';
              } else if (msg.message.audioMessage) {
                messageType = msg.message.audioMessage.ptt ? 'voice' : 'audio';
                text = msg.message.audioMessage.ptt ? '[Voice]' : '[Audio]';
              } else if (msg.message.documentMessage) {
                messageType = 'document';
                text = msg.message.documentMessage.caption || `[Document: ${msg.message.documentMessage.fileName || ''}]`;
              } else if (msg.message.stickerMessage) {
                messageType = 'sticker';
                text = '[Sticker]';
              } else if (msg.message.contactMessage) {
                messageType = 'contact';
                text = `[Contact: ${msg.message.contactMessage.displayName || ''}]`;
              } else if (msg.message.locationMessage) {
                messageType = 'location';
                text = `[Location: ${msg.message.locationMessage.degreesLatitude || ''},${msg.message.locationMessage.degreesLongitude || ''}]`;
              } else {
                continue; // Unknown message type, skip
              }
            }

            await saveChatMessage({ sessionId, phone: sender, pushName: msg.pushName || undefined, text, fromMe: false });

            const msgPayload = { sessionId, sender, text, fromMe: false, pushName: msg.pushName || undefined, timestamp: Date.now() };
            const notifPayload = { type: 'visit', title: 'New WhatsApp Message', message: `${msg.pushName || 'Unknown'}: ${text.substring(0, 100)}`, sessionId, sender, timestamp: Date.now() };
            Promise.all([
              io.to(`session-${sessionId}`).emit('on-message', msgPayload),
              io.to('admin-room').emit('on-message', msgPayload),
              io.to('admin-room').emit('notification', notifPayload)
            ]);

            const botReply = async (to: string, t: string) => {
              await sock.sendMessage(to, { text: t });
              await saveChatMessage({ sessionId, phone: to, text: t, fromMe: true });
              io.to(`session-${sessionId}`).emit('on-message', {
                sessionId,
                sender: to,
                text: t,
                fromMe: true,
                timestamp: Date.now()
              });
            };

            const sendDoc = async (to: string, buffer: Buffer, filename: string, caption?: string) => {
              const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
              const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
              const mimetype = mimeMap[ext] || 'application/octet-stream';
              const isImage = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp';
              if (isImage) {
                await sock.sendMessage(to, { image: buffer, caption: caption || filename, mimetype });
              } else {
                await sock.sendMessage(to, { document: buffer, mimetype, fileName: filename, caption: caption || '' });
              }
              await saveChatMessage({ sessionId, phone: to, text: `[Image: ${filename}]`, fromMe: true });
              io.to(`session-${sessionId}`).emit('on-message', {
                sessionId,
                sender: to,
                text: `[Image: ${filename}]`,
                fromMe: true,
                timestamp: Date.now()
              });
            };
            
            // Skip bot processing if session is not connected (avoids "Technical error" from dead socket)
            const sessionStatus = sessions.get(sessionId)?.status;
            if (sessionStatus !== 'CONNECTED') {
              console.log(`[WhatsApp] ${sessionId} skipping bot — session ${sessionStatus}`);
            } else {
              await handleIncomingMessage(botReply, sendDoc, null, null, sender, text, msg.pushName);
            }
          }
    } catch (e) {
      console.error(`[WhatsApp] messages.upsert error for ${sessionId}:`, e);
      try { await query('INSERT INTO error_logs (source, message, created_at) VALUES (?, ?, NOW())', ['messages_upsert', (e as Error).message?.substring(0, 500) || 'Unknown']); } catch (_) {}
    }
  });

    } catch (e) {
      connectingSessions.delete(sessionId);
      sessions.set(sessionId, { socket: null, status: 'ERROR', lastActivity: Date.now() });
      console.error(`[WhatsApp] Failed to connect ${sessionId}:`, e);
      io.to(`session-${sessionId}`).emit('session-status', { sessionId, status: 'ERROR', message: 'Connection failed' });
    }
  }

  // --- Routes --------------------------------------------------------
  setupSalonRoutes(app, { sessions, connectToWhatsApp, connectingSessions, io, cleanupSession });
  setupAdminRoutes(app, { sessions, connectToWhatsApp, connectingSessions, io, cleanupSession });
  setupCustomerRoutes(app);
  setupExportRoutes(app);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', sessions: sessions.size, uptime: process.uptime() }));

  app.get('/api/db-health', async (req, res) => {
    try {
      const result = process.env.USE_SQLITE === 'true'
        ? pool.prepare('SELECT 1 as ok').get()
        : await query('SELECT 1 as ok');
      res.json({ status: 'ok', database: result ? 'connected' : 'error' });
    } catch (e: any) {
      console.error('[DB Health Error]', e?.message || e);
      res.status(500).json({ status: 'error', database: 'disconnected', error: e?.message || 'Unknown error' });
    }
  });

  app.get('/api/public/salons/:id', async (req, res) => {
    try {
      const salonId = parseId(req.params.id);
      if (salonId === null) return res.status(400).json({ error: 'Invalid salon ID' });
      const rows = await query(
        `SELECT s.*, c.name as city_name, ct.name as country_name, a.name as area_name
         FROM salons s
         LEFT JOIN cities c ON s.city_id = c.id
         LEFT JOIN countries ct ON s.country_id = ct.id
         LEFT JOIN areas a ON s.area_id = a.id
         WHERE s.id = ? AND s.status = 'active'`,
        [salonId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Salon not found' });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch salon' });
    }
  });

  app.get('/api/public/salons', async (req, res) => {
    try {
      const rows = await query(
        "SELECT id, name, address, description, cover_image_url as cover_image, logo_url as logo, rating FROM salons WHERE status = 'active' ORDER BY name"
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch salons' });
    }
  });

  // --- Socket.IO Handlers --------------------------------------------
  io.on('connection', (socket) => {
    const token = socket.handshake?.auth?.token;
    let userRole = '';
    let userSalonId: number | null = null;
    let adminId: number | null = null;
    let isAuthenticated = false;
    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        if (decoded) {
          isAuthenticated = true;
          userRole = decoded.role || '';
          userSalonId = decoded.salonId || null;
          adminId = decoded.id || null;
          console.log(`[Socket] Authenticated connection: role=${userRole}, salonId=${userSalonId}, adminId=${adminId}`);
        }
      } catch (e) {
        console.warn(`[Socket] Invalid token from ${socket.id}: ${(e as Error).message}`);
      }
    } else {
      console.warn(`[Socket] No token provided from ${socket.id}`);
    }

    // Admins join admin-room to receive admin-specific broadcasts
    if (userRole === 'super_admin' || userRole === 'admin') {
      socket.join('admin-room');
    }

    const canManageSession = (sid: string): boolean => {
      if (!isAuthenticated) {
        console.warn(`[Socket] Unauthenticated user tried to manage session ${sid}`);
        return false;
      }
      if (!sid || sid === 'null' || sid === 'undefined') {
        console.warn(`[Socket] Invalid session ID: ${sid}`);
        return false;
      }
      if (userRole === 'super_admin' || userRole === 'admin') return true;
      if (userSalonId && sid === `salon-${userSalonId}`) {
        console.log(`[Socket] Salon ${userSalonId} authorized for session ${sid}`);
        return true;
      }
      console.warn(`[Socket] User role=${userRole} salonId=${userSalonId} not authorized for session ${sid}`);
      return false;
    };

    socket.on('join-session', (sid) => {
      if (!canManageSession(sid)) {
        return socket.emit('session-status', { sessionId: sid, status: 'ERROR', message: 'Not authorized. Please log in again.' });
      }
      console.log(`[Socket] ${socket.id} joining session ${sid}`);
      socket.join(`session-${sid}`);
      const s = sessions.get(sid);
      if (s) {
        socket.emit('session-status', { sessionId: sid, status: s.status, qr: s.qr, user: s.user });
      } else {
        socket.emit('session-status', { sessionId: sid, status: 'CONNECTING', message: 'Starting session...' });
        connectToWhatsApp(sid).catch(() => {});
      }
    });

    socket.on('init-session', (sid) => {
      if (!canManageSession(sid)) {
        return socket.emit('session-status', { sessionId: sid, status: 'ERROR', message: 'Not authorized to init session' });
      }
      console.log(`[Socket] Initializing session ${sid}`);
      connectToWhatsApp(sid).catch(() => {});
    });

    socket.on('restart-session', (sid) => {
      if (!canManageSession(sid)) {
        return socket.emit('session-status', { sessionId: sid, status: 'ERROR', message: 'Not authorized to restart session' });
      }
      console.log(`[Socket] Restarting session ${sid}`);
      // Reset reconnect lock to allow fresh connection
      reconnectLocks.delete(sid);
      cleanupSession(sid);
      sessions.delete(sid);
      connectingSessions.delete(sid);
      reconnectAttempts.delete(sid);
      const t = reconnectTimers.get(sid);
      if (t) { clearTimeout(t); reconnectTimers.delete(sid); }
      const dataDir = process.env.DATA_DIR || process.cwd();
      const authPath = path.join(dataDir, `auth-info-${sid}`);
      try { rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
      io.to(`session-${sid}`).emit('session-status', { sessionId: sid, status: 'DISCONNECTED', message: 'Restarting...' });
      connectToWhatsApp(sid).catch(() => {});
    });

    socket.on('send-message', async (data) => {
      try {
        const { sessionId, to, text } = data;
        if (!sessionId || !to || !text) {
          return socket.emit('message-sent', { success: false, error: 'Missing required fields' });
        }
        if (!canManageSession(sessionId)) {
          socket.emit('message-sent', { success: false, error: 'Not authorized to send on this session' });
          return;
        }
        const session = sessions.get(sessionId);
        if (!session?.socket) {
          return socket.emit('message-sent', { success: false, error: 'Session not connected' });
        }
        await session.socket.sendMessage(to, { text });
        await saveChatMessage({ sessionId, phone: to, text, fromMe: true });
        socket.emit('message-sent', { success: true, to, text });
      } catch (e: any) {
        console.error('[Socket] send-message error:', e.message);
        socket.emit('message-sent', { success: false, error: e.message });
      }
    });

    socket.on('delete-session', async (sid) => {
      if (!canManageSession(sid)) {
        return socket.emit('session-status', { sessionId: sid, status: 'ERROR', message: 'Not authorized to delete session' });
      }
      console.log(`[Socket] Deleting session ${sid}`);
      reconnectLocks.delete(sid);
      cleanupSession(sid);
      sessions.delete(sid);
      connectingSessions.delete(sid);
      reconnectAttempts.delete(sid);
      const t = reconnectTimers.get(sid);
      if (t) { clearTimeout(t); reconnectTimers.delete(sid); }
      const dataDir = process.env.DATA_DIR || process.cwd();
      const authPath = path.join(dataDir, `auth-info-${sid}`);
      try { rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
      io.to(`session-${sid}`).emit('session-status', { sessionId: sid, status: 'DISCONNECTED', message: 'Session deleted' });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.id} disconnected (role=${userRole})`);
    });
  });

  // ─── Admin live stats broadcast (every 15s) ───────────────────────
  // Computes lightweight aggregated admin stats and emits them to the
  // admin-room. Each query is guarded so a single failure only skips one
  // tick and never crashes the server.
  const ADMIN_TODAY = process.env.USE_SQLITE === 'true' ? "date('now')" : 'CURDATE()';
  async function emitAdminStats() {
    try {
      const salonsRow = await query("SELECT COUNT(*) as c FROM salons WHERE status = 'active'");
      const customersRow = await query('SELECT COUNT(*) as c FROM customers');
      const apptRow = await query('SELECT COUNT(*) as c FROM appointments WHERE appointment_date = ' + ADMIN_TODAY);
      const revRow = await query('SELECT COALESCE(SUM(amount), 0) as r FROM revenue WHERE date = ' + ADMIN_TODAY);
      const recent = await query(
        `SELECT a.id, a.customer_name, a.appointment_date, a.appointment_time, a.status,
                s.name as salon_name, sv.name as service_name, b.name as barber_name
         FROM appointments a
         LEFT JOIN salons s ON a.salon_id = s.id
         LEFT JOIN services sv ON a.service_id = sv.id
         LEFT JOIN barbers b ON a.barber_id = b.id
         ORDER BY a.created_at DESC LIMIT 10`
      );
      io.to('admin-room').emit('admin:stats', {
        totalSalons: Number(salonsRow?.[0]?.c || 0),
        totalCustomers: Number(customersRow?.[0]?.c || 0),
        appointmentsToday: Number(apptRow?.[0]?.c || 0),
        revenueToday: Number(revRow?.[0]?.r || 0),
        recent: Array.isArray(recent) ? recent : [],
      });
    } catch (e: any) {
      console.warn('[Admin Stats] tick skipped:', e?.message || e);
    }
  }
  setInterval(emitAdminStats, 15000);


  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
     if (res.headersSent) return next(err);
     console.error('[Express Error]', err.stack || err.message || err);
     const status = err.status || err.statusCode || 500;
     const message = status === 500 && process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';
     res.status(status).json({ error: message });
   });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  // Vite / Static
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist/index.html')));
  }

  function startServerOnPort(port: number) {
    httpServer.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${port} is in use, trying ${port + 1}...`);
        startServerOnPort(port + 1);
      } else {
        console.error('[Server] Failed to start:', err.message);
      }
    });
    httpServer.listen(port, () => {
      console.log(`🚀 Platform running on http://localhost:${port}`);
      connectToWhatsApp('autozap-admin').catch((err: any) => {
        console.error('[WhatsApp] Admin session connect error:', err?.message || err);
      });
      startNotificationScheduler();
      startRecurringScheduler();
      initTokenRevocation();
    });
  }
  startServerOnPort(Number(PORT));

  // ─── Graceful Shutdown ──────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.log(`[Server] ${signal} received, shutting down gracefully...`);
    for (const t of reconnectTimers.values()) clearTimeout(t);
    reconnectTimers.clear();
    reconnectLocks.clear();
    reconnectAttempts.clear();
    noCredsCooldowns.clear();
    for (const s of sessions.values()) {
      try {
        if (s?.socket?.logout) await s.socket.logout();
        if (s?.socket?.ws?.close) s.socket.ws.close();
      } catch (_) {}
    }
    sessions.clear();
    connectingSessions.clear();
    try { io.close(); } catch (_) {}
    try { await new Promise<void>((r) => { httpServer.close(() => r()); }); } catch (_) {}
    if (process.env.USE_SQLITE !== 'true') {
      try { if (typeof pool?.end === 'function') await pool.end(); } catch (_) {}
    }
    console.log('[Server] Shutdown complete');
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ─── Global Error Handlers ──────────────────────────────────────────
process.on('unhandledRejection', (reason: any) => {
  console.error('[Unhandled Rejection]', reason?.message || reason);
  if (reason?.stack) console.error(reason.stack);
});
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err?.message || err);
  if (err?.stack) console.error(err.stack);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

startServer().catch(err => console.error('[Server Start Error]', err));

