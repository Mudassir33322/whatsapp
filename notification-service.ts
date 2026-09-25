import type { Server } from 'socket.io';
import { query } from './db';

interface WASocket {
  sendMessage(jid: string, content: Record<string, unknown>): Promise<unknown>;
  [key: string]: unknown;
}

let waSocket: WASocket | null = null;
let waConnected = false;
const messageQueue: Array<{ to: string; text: string; retries: number; maxRetries: number; sessionId?: string }> = [];
const MAX_QUEUE_SIZE = 5000;
// Pace outbound messages to avoid WhatsApp rate limits / temporary bans and to
// keep a single socket from being overwhelmed when a user triggers bulk messaging.
const SEND_INTERVAL_MS = Number(process.env.WA_SEND_INTERVAL_MS || 800);
let queueProcessing = false;
const sessionSocketMap = new Map<string, WASocket | null>();

interface SessionData {
  socket: WASocket | null;
  status: string;
  qr?: string | null;
  user?: string;
  lastActivity?: number;
}

// Cross-module references (set by server.ts)
export let sessions: Map<string, SessionData> | null = null;
export let io: Server | null = null;
export let connectingSessions: Set<string> | null = null;
export let reconnectLocks: Set<string> | null = null;
export let reconnectTimers: Map<string, ReturnType<typeof setTimeout>> | null = null;
export let cleanupSession: ((sid: string) => void) | null = null;

// Max sessions to prevent memory leaks
const MAX_SESSIONS = 100;
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

let sessionsCleanupTimer: ReturnType<typeof setInterval> | null = null;

export function setSessions(s: Map<string, SessionData>) { 
  sessions = s;
  if (sessionsCleanupTimer) clearInterval(sessionsCleanupTimer);
  sessionsCleanupTimer = setInterval(() => {
    if (sessions && sessions.size > MAX_SESSIONS) {
      const now = Date.now();
      for (const [key, val] of sessions) {
        if (val?.lastActivity && now - val.lastActivity > SESSION_TTL) {
          cleanupSession?.(key);
          sessions.delete(key);
        }
      }
    }
  }, 60000);
}
export function setReconnectLocks(rl: Set<string>) { reconnectLocks = rl; }
export function setReconnectTimers(rt: Map<string, ReturnType<typeof setTimeout>>) { reconnectTimers = rt; }
export function setCleanupSession(fn: (sid: string) => void) { cleanupSession = fn; }
export function setIO(sIO: Server) { io = sIO; }

export function setWASocket(sock: WASocket | null, sessionId?: string) {
  if (!sessionId || sessionId === 'autozap-admin') {
    waSocket = sock;
    waConnected = true;
    processMessageQueue();
  }
  if (sessionId) {
    sessionSocketMap.set(sessionId, sock);
  }
}

export function removeSessionSocket(sessionId: string) {
  sessionSocketMap.delete(sessionId);
}

export function getSessionSocket(sessionId: string): WASocket | null {
  return sessionSocketMap.get(sessionId) || null;
}

export function isSessionConnected(sessionId: string): boolean {
  return !!sessionSocketMap.get(sessionId);
}

export function getWASocket() {
  return waSocket;
}

export function setWAConnected(connected: boolean) {
  waConnected = connected;
  if (connected) processMessageQueue();
}

export function isWAConnected(): boolean {
  return waConnected && waSocket !== null;
}

export async function sendWhatsAppMessage(to: string, content: { text?: string; image?: { url: string; caption?: string } }, sessionId?: string) {
  const socket = sessionId ? sessionSocketMap.get(sessionId) : waSocket;
  const connected = sessionId ? !!socket : (waConnected && waSocket !== null);

  if (!socket || !connected) {
    console.warn('[Notifications] WhatsApp not connected, cannot send to', to);
    await recordBackupNotification(sessionId, to, content.text || content.image?.caption || '');
    return false;
  }
  try {
    if (content.image) {
      await socket.sendMessage(to, { image: { url: content.image.url }, caption: content.image.caption || '' });
    } else if (content.text) {
      await socket.sendMessage(to, { text: content.text });
    }
    return true;
  } catch (e: any) {
    console.error('[Notifications] Send failed:', e.message);
    await recordBackupNotification(sessionId, to, content.text || content.image?.caption || '');
    return false;
  }
}

async function recordBackupNotification(sessionId: string | undefined, to: string, message: string) {
  try {
    const salonId = sessionId ? Number(sessionId.replace('salon-', '')) : null;
    if (!salonId || isNaN(salonId)) return;
    await query(
      `INSERT INTO notification_logs (salon_id, notification_type, customer_phone, message_sent, sent_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [salonId, 'backup', to, message.substring(0, 500)]
    );
  } catch (e: any) {
    console.error('[Notifications] Failed to record backup notification:', e.message);
  }
}

async function sendWhatsApp(to: string, text: string, priority: boolean = false, sessionId?: string) {
  const socket = sessionId ? sessionSocketMap.get(sessionId) : waSocket;
  const connected = sessionId ? !!socket : (waConnected && waSocket !== null);
  
  if (!socket || !connected) {
    if (messageQueue.length < MAX_QUEUE_SIZE) {
      messageQueue.push({ to, text, retries: 0, maxRetries: 3, sessionId });
    } else {
      console.warn('[Notifications] Queue full, dropping message to', to);
      await recordBackupNotification(sessionId, to, text);
    }
    if (!queueProcessing) processMessageQueue();
    return;
  }
  try {
    await socket.sendMessage(to, { text });
   } catch (e: any) {
     console.error('[Notifications] Send failed:', e.message);
     if (messageQueue.length < MAX_QUEUE_SIZE) {
       messageQueue.push({ to, text, retries: 0, maxRetries: 3, sessionId });
     } else {
       console.warn('[Notifications] Queue full, dropping message to', to);
       await recordBackupNotification(sessionId, to, text);
     }
   }
 }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function processMessageQueue() {
  if (queueProcessing) return;
  queueProcessing = true;
  try {
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      if (!msg) continue;
      const socket = msg.sessionId ? sessionSocketMap.get(msg.sessionId) : waSocket;
      const connected = msg.sessionId ? !!socket : (waConnected && waSocket !== null);
      if (!socket || !connected) {
        if (msg.retries < msg.maxRetries) {
          msg.retries++;
          setTimeout(() => { if (messageQueue.length < MAX_QUEUE_SIZE) messageQueue.push(msg); }, 5000 * msg.retries);
        } else {
          console.warn('[Notifications] Dropped message after retries exhausted:', msg.to);
          await recordBackupNotification(msg.sessionId, msg.to, msg.text);
        }
        continue;
      }
      try {
        await socket.sendMessage(msg.to, { text: msg.text });
      } catch (e: any) {
        console.error('[Notifications] Queued send failed:', e.message);
        if (msg.retries < msg.maxRetries) {
          msg.retries++;
          setTimeout(() => { if (messageQueue.length < MAX_QUEUE_SIZE) messageQueue.push(msg); }, 5000 * msg.retries);
        } else {
          console.warn('[Notifications] Dropped message after retries exhausted:', msg.to);
          await recordBackupNotification(msg.sessionId, msg.to, msg.text);
        }
      }
      // Pace outbound sends (jitter) so bulk messaging does not trip
      // WhatsApp rate limits / bans or saturate a single socket.
      await sleep(SEND_INTERVAL_MS + Math.floor(Math.random() * 400));
    }
  } finally {
    queueProcessing = false;
  }
}

async function alreadySent(appointmentId: number, type: string): Promise<boolean> {
  const rows: any = await query(
    'SELECT id FROM sent_notifications WHERE appointment_id = ? AND type = ?',
    [appointmentId, type]
  );
  return rows.length > 0;
}

async function markSent(appointmentId: number, type: string, phone: string) {
  try {
    await query(
      'INSERT INTO sent_notifications (appointment_id, type, customer_phone) VALUES (?, ?, ?)',
      [appointmentId, type, phone]
    );
  } catch (_) {
    // Duplicate entries are expected
  }
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Booking Alert to Salon Owner ────────────────────────────────
export async function sendBookingAlert(booking: {
 salon_id: number;
 salon_name: string;
 customer_name: string;
 customer_phone: string;
 service_name: string;
 appointment_date: string;
 appointment_time: string;
 token: string;
}) {
  try {
    const salon: any[] = await query('SELECT phone, name FROM salons WHERE id = ?', [booking.salon_id]);
    const salonPhone = salon[0]?.phone;
    const sessionId = `salon-${booking.salon_id}`;
    const socket = sessionSocketMap.get(sessionId) || waSocket;
    if (salonPhone && socket) {
      const cleanPhone = (salonPhone || '').includes('@') ? salonPhone : `${salonPhone}@s.whatsapp.net`;
      const msg = `🏪 *New Booking Alert* 🎉\n\nSalon: ${booking.salon_name}\nCustomer: ${booking.customer_name}\n📞 ${booking.customer_phone}\n✂️ Service: ${booking.service_name}\n📅 ${formatDate(booking.appointment_date)}\n⏰ ${formatTime(booking.appointment_time)}\n🔖 Token: *${booking.token}*`;
      await sendWhatsApp(cleanPhone, msg, false, sessionId);
    }
   if (io) {
     io.to('admin-room').emit('notification', {
       type: 'booking',
       title: 'Nayi Booking!',
       message: `${booking.customer_name} ne ${booking.salon_name} par ${booking.service_name} book kiya`,
       token: booking.token,
       salon_name: booking.salon_name,
       customer_name: booking.customer_name,
       customer_phone: booking.customer_phone,
       service_name: booking.service_name,
       appointment_date: booking.appointment_date,
       appointment_time: booking.appointment_time,
       timestamp: Date.now()
     });
   }
 } catch (e: any) {
   console.error('[Notifications] Failed to send salon booking alert:', e.message);
 }
}

// ─── Booking Confirmation ─────────────────────────────────────────
export async function sendBookingConfirmation(apt: any) {
 if (!waSocket) {
   console.warn('[Notifications] WhatsApp not initialized, skipping booking confirmation');
   return;
 }
 // Security: Null check for customer_phone
 if (!apt.customer_phone) { console.warn('[Notifications] Missing customer_phone, skipping'); return; }
 const phone = (apt.customer_phone || '').includes('@') ? apt.customer_phone : `${apt.customer_phone}@s.whatsapp.net`;
 const msg = `✅ *Booking Confirmed!* 🎉\n🏪 ${apt.salon_name || 'Salon'}\n💇 Barber: ${apt.barber_name || 'N/A'}\n✂️ Service: ${apt.service_name || 'N/A'}\n📅 ${formatDate(apt.appointment_date || '')}\n⏰ ${formatTime(apt.appointment_time || '')}\n🔖 Token: *${apt.token || 'N/A'}*\nAapko salon par ye token dena hoga.`;
 await sendWhatsApp(phone, msg);
}

// ─── 30-Min Reminder ──────────────────────────────────────────────
export async function sendReminder(apt: any) {
  if (!apt.customer_phone) { console.warn('[Notifications] Missing customer_phone, skipping'); return; }
  const phone = apt.customer_phone.includes('@') ? apt.customer_phone : `${apt.customer_phone}@s.whatsapp.net`;
  if (await alreadySent(apt.id, 'reminder_30min')) return;

  // Check salon preferences
  const prefs: any = await query('SELECT reminder_30min FROM notification_preferences WHERE salon_id = ?', [apt.salon_id]);
  if (prefs.length > 0 && !prefs[0].reminder_30min) return;

  const msg = `⏰ *Reminder!*\n\nAapka appointment *${formatTime(apt.appointment_time)}* par ${apt.barber_name} ke sath hai.\n\n🏪 ${apt.salon_name}\n🔖 Token: *${apt.token}*\n\nBarah-e-karam time par pahunchein.`;
  await sendWhatsApp(phone, msg);
  await markSent(apt.id, 'reminder_30min', apt.customer_phone);
}

// ─── Queue Update ─────────────────────────────────────────────────
export async function sendQueueUpdate(apt: any) {
  if (!apt.customer_phone) { console.warn('[Notifications] Missing customer_phone, skipping'); return; }
  const phone = apt.customer_phone.includes('@') ? apt.customer_phone : `${apt.customer_phone}@s.whatsapp.net`;

  // Count how many confirmed appointments are before this one
  const ahead: any = await query(
    `SELECT COUNT(*) as count FROM appointments 
     WHERE barber_id = ? AND appointment_date = ? AND appointment_time < ? 
     AND status IN ('confirmed', 'in_progress')`,
    [apt.barber_id, apt.appointment_date, apt.appointment_time]
  );
  const count = ahead[0]?.count || 0;

  if (count > 2) return; // Only notify when 2 or less ahead

  if (await alreadySent(apt.id, 'queue_update')) return;

  const prefs: any = await query('SELECT queue_update FROM notification_preferences WHERE salon_id = ?', [apt.salon_id]);
  if (prefs.length > 0 && !prefs[0].queue_update) return;

  const msg = `📋 *Queue Update*\n\nAap se pehle ${count} customer(s) hain. Kuch hi der mein aapki baari ayegi! 🎯\n\n🔖 Token: *${apt.token}*`;
  await sendWhatsApp(phone, msg);
  await markSent(apt.id, 'queue_update', apt.customer_phone);
}

// ─── Review Request ───────────────────────────────────────────────
export async function sendReviewRequest(apt: any) {
  if (!apt.customer_phone) { console.warn('[Notifications] Missing customer_phone, skipping'); return; }
  const phone = apt.customer_phone.includes('@') ? apt.customer_phone : `${apt.customer_phone}@s.whatsapp.net`;
  if (await alreadySent(apt.id, 'review_request')) return;

  const prefs: any = await query('SELECT review_request FROM notification_preferences WHERE salon_id = ?', [apt.salon_id]);
  if (prefs.length > 0 && !prefs[0].review_request) return;

  const msg = `⭐ *Apna Experience Share Karein!*\n\nAapne ${apt.barber_name} se ${apt.salon_name} mein service li thi. Kaisi lagi? Humare liye 1 se 5 stars dein:\n\n1️⃣ ⭐\n2️⃣ ⭐⭐\n3️⃣ ⭐⭐⭐\n4️⃣ ⭐⭐⭐⭐\n5️⃣ ⭐⭐⭐⭐⭐\n\nApna rating is message ka reply karein. Shukriya! 🙏`;
  await sendWhatsApp(phone, msg);
  await markSent(apt.id, 'review_request', apt.customer_phone);
}

// ─── Points Earned ────────────────────────────────────────────────
export async function sendPointsEarned(phone: string | null | undefined, points: number, total: number) {
  if (!phone) { console.warn('[Notifications] Missing phone, skipping points earned'); return; }
  const contact = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  const msg = `🎉 *Points Earned!*\n\nAapne ${points} loyalty points earn kiye hain!\nTotal points: ${total}\n\nZyada points earn karke silver, gold ya platinum tier mein jayein! 💎`;
  await sendWhatsApp(contact, msg);
}

// ─── Re-Engagement ────────────────────────────────────────────────
export async function sendReEngagement(customer: any) {
  if (!customer?.phone) { console.warn('[Notifications] Missing customer phone, skipping re-engagement'); return; }
  const phone = customer.phone.includes('@') ? customer.phone : `${customer.phone}@s.whatsapp.net`;
  const msg = `💈 *Miss You!*\n\nAap ko ${customer.salon_name || 'Salon'} ne yaad kiya! Kaafi din ho gaye aaye hue. Abhi appointment book karein aur naye offers ka faida uthayein! 🎉\n\nBook karne ke liye koi bhi message bhejein.`;
  await sendWhatsApp(phone, msg);
}

// ─── Periodic Checks ──────────────────────────────────────────────
let notificationSchedulerStarted = false;
export function startNotificationScheduler() {
  if (notificationSchedulerStarted) {
    console.log('[Notifications] Scheduler already running, skipping duplicate start');
    return;
  }
  notificationSchedulerStarted = true;
  function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return time;
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  // Check every 5 minutes for 30-min reminders (was 60s)
  setInterval(async () => {
    try {
      const now = new Date();
      const targetTime = new Date(now.getTime() + 30 * 60 * 1000);
      const targetHour = targetTime.getHours();
      const targetMin = targetTime.getMinutes();
      const targetStr = `${String(targetHour).padStart(2, '0')}:${String(targetMin).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];

      const endStr = addMinutes(targetStr, 2);
      const appts: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name
         FROM appointments a
         JOIN barbers b ON a.barber_id = b.id
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
         WHERE a.appointment_date = ? AND a.appointment_time >= ? AND a.appointment_time <= ? AND a.status = 'confirmed'`,
        [today, targetStr, endStr]
      );

      for (const apt of appts) {
        await sendReminder(apt);
      }
    } catch (e: any) {
      console.error('[Notifications] Reminder check error:', e?.message || e);
    }
  }, 300000);

  // Check every 10 minutes for queue updates (was 5 min)
  setInterval(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const appts: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name
         FROM appointments a
         JOIN barbers b ON a.barber_id = b.id
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
         WHERE a.appointment_date = ? AND a.appointment_time <= ? AND a.status = 'confirmed'
         ORDER BY a.appointment_time`,
        [today, currentTime]
      );

      for (const apt of appts) {
        await sendQueueUpdate(apt);
      }
    } catch (e: any) {
      console.error('[Notifications] Queue check error:', e.message);
    }
  }, 600000);

  // Check once daily for re-engagement (customers not visited in 30 days)
  setInterval(async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

      const customers: any = await query(
        `SELECT c.phone, MAX(a.appointment_date) as last_visit, sl.name as salon_name, sl.id as salon_id
         FROM customers c
         JOIN appointments a ON c.phone = a.customer_phone
         JOIN salons sl ON a.salon_id = sl.id
         GROUP BY c.phone, sl.id
         HAVING MAX(a.appointment_date) < ? AND MAX(a.appointment_date) >= ?`,
        [thirtyDaysAgo, sixtyDaysAgo]
      );

      for (const customer of customers) {
        // Check not already sent in last 30 days
        const thirtyDaysBack = new Date(Date.now() - 30 * 86400000).toISOString().split('.')[0].replace('T', ' ');
        const sent: any = await query(
          `SELECT id FROM sent_notifications WHERE customer_phone = ? AND type = 're_engagement' AND sent_at >= ?`,
          [customer.phone, thirtyDaysBack]
        );
        if (sent.length > 0) continue;

        // Check salon preferences
        const prefs: any = await query('SELECT re_engagement FROM notification_preferences WHERE salon_id = ?', [customer.salon_id]);
        if (prefs.length > 0 && !prefs[0].re_engagement) continue;

        await sendReEngagement(customer);
        try {
          await query(
            `INSERT INTO sent_notifications (appointment_id, type, customer_phone) VALUES (0, 're_engagement', ?)`,
            [customer.phone]
          );
        } catch (_) { /* ignore */ }
      }
    } catch (e: any) {
      console.error('[Notifications] Re-engagement check error:', e.message);
    }
  }, 86400000); // Once per day

  // Check low stock every hour
  setInterval(async () => {
    await checkLowStock();
  }, 3600000);

  console.log('[Notifications] Scheduler started');
}

// ─── Low Stock Alert ──────────────────────────────────────────────
export async function checkLowStock() {
  try {
    const products: any = await query(
      `SELECT p.*, s.name as salon_name, s.phone as salon_phone, s.id as salon_id
       FROM products p
       JOIN salons s ON p.salon_id = s.id
       WHERE p.stock <= p.min_stock AND p.is_active = TRUE`
    );
    for (const product of products) {
      const targetPhone = product.salon_phone;
      if (!targetPhone) continue;
      // Check if already alerted in last 24 hours
      const oneDayBack = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('.')[0].replace('T', ' ');
      const already: any = await query(
        `SELECT id FROM sent_notifications WHERE appointment_id = ? AND type = 'low_stock' AND customer_phone = ? AND sent_at >= ?`,
        [product.id, targetPhone, oneDayBack]
      );
      if (already.length > 0) continue;
      const contact = targetPhone.includes('@') ? targetPhone : `${targetPhone}@s.whatsapp.net`;
      const sessionId = `salon-${product.salon_id}`;
      const socket = sessionSocketMap.get(sessionId) || waSocket;
      const msg = `📦 *Low Stock Alert!*\n\n🏪 ${product.salon_name}\n📛 Product: *${product.name}*\n📊 Remaining: ${product.stock} ${product.unit}\n⚠️ Min Stock: ${product.min_stock} ${product.unit}\n\nPlease reorder soon!`;
      await sendWhatsApp(contact, msg, false, sessionId);
      try {
        await query(
          `INSERT INTO sent_notifications (appointment_id, type, customer_phone) VALUES (?, 'low_stock', ?)`,
          [product.id, targetPhone]
        );
      } catch (_) {}
    }
  } catch (e: any) {
    console.error('[Notifications] Low stock check error:', e.message);
  }
}
