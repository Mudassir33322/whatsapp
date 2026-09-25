import {
  getBotState,
  saveBotState,
  getAllCountries,
  getCitiesByCountry,
  getAreasByCity,
  getSalonsByLocation,
  getServicesBySalon,
  getBarbersBySalon,
  getAvailableSlots,
  createAppointment,
  getAppointmentByToken,
  cancelAppointmentByToken,
  getOffersBySalon,
  getSalonDetailForBot,
  getSalonReviews,
  upsertCustomer,
  addLoyaltyPoints,
  getCustomerByPhone,
  getBookingsByPhone,
  getSalonById,
  createReview,
  updateAppointmentByToken,
  getCustomerPreference,
  setCustomerPreference,
  updateCustomerActivity,
  getOrCreateReferralCode,
  getActiveOffersAll,
  getSalonsByCityName,
  getAllSalons,
  createRecurringBooking,
  getRecurringBookingsByPhone,
  cancelRecurringBooking,
  updateCustomerStatus,
  getSalonMedia,
  findNextAvailableSlot,
  findNextAvailableSlotForAnyBarber,
  findRescheduleDates
} from './db';
import { generateReceiptPDF } from './receipt-generator';
import { sendBookingAlert } from './notification-service';
import crypto from 'crypto';
import path from 'path';
import { appendFile } from 'fs/promises';
import { writeFile, unlink } from 'fs/promises';

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

function getCleanPhone(sender: string): string {
  return normalizePhone(sender);
}

import { 
  showMainMenu,
  showCountries, 
  showCities, 
  showAreas, 
  showSalons, 
  showSalonMenu, 
  showServices,
  showBarbers,
  M
} from './bot-menus';
import { escapeMarkdown, generateToken, generateUniqueToken, normalizePhone } from './utils';
import { processWithAI, isAiAvailable, clearConversation } from './ai';
import { BOT_CONFIG } from './bot-config';

// ─── Per-sender async mutex (promise chain, not busy-wait) ─────────
const senderQueues = new Map<string, Promise<void>>();

async function acquireSenderLock(sender: string): Promise<() => void> {
  const prev = senderQueues.get(sender) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  senderQueues.set(sender, next);
  await prev;
  return () => {
    if (senderQueues.get(sender) === next) {
      senderQueues.delete(sender);
    }
    release!();
  };
}

// ─── Rate limiting ─────────────────────────────────────────────────
const rateLimitMap = new Map<string, { time: number }>();

function checkRateLimit(sender: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sender);
  if (entry && now - entry.time < BOT_CONFIG.rateLimitWindow) return false;
  rateLimitMap.set(sender, { time: now });
  return true;
}

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - BOT_CONFIG.rateLimitWindow * 10;
  for (const [key, val] of rateLimitMap) {
    if (val.time < cutoff) rateLimitMap.delete(key);
  }
}, BOT_CONFIG.rateLimitCleanupInterval);

// ─── State timeout ─────────────────────────────────────────────────
const recentTimeoutMap = new Map<string, number>();

setInterval(() => {
  const cutoff = Date.now() - BOT_CONFIG.recentTimeoutMs * 2;
  for (const [key, ts] of recentTimeoutMap) {
    if (ts < cutoff) recentTimeoutMap.delete(key);
  }
}, BOT_CONFIG.rateLimitCleanupInterval);

function isStateExpired(state: any): boolean {
  if (!state || !state.updatedAt) return false;
  return Date.now() - state.updatedAt > BOT_CONFIG.stateTimeoutMs;
}

function isRecentlyTimeout(sender: string): boolean {
  const ts = recentTimeoutMap.get(sender);
  if (!ts) return false;
  return Date.now() - ts < BOT_CONFIG.recentTimeoutMs;
}

function formatSlots(slots: { start: string; end: string }[]): string {
  return slots.map((s, i) => {
    const time12h = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    return `${i + 1}. ${time12h(s.start)} – ${time12h(s.end)}`;
  }).join('\n');
}

export type SendButtons = (to: string, text: string, buttons: { id: string; text: string }[], footer?: string) => Promise<void>;
export type SendList = (to: string, text: string, buttonText: string, sections: { title: string; rows: { id: string; title: string; description?: string }[] }[], footer?: string) => Promise<void>;

export async function handleIncomingMessage(
  sendMessage: (to: string, text: string) => Promise<void>,
  sendDocument: ((to: string, buffer: Buffer, filename: string, caption?: string) => Promise<void>) | null,
  sendButtons: SendButtons | null,
  sendList: SendList | null,
  sender: string,
  text: string,
  pushName: string | null | undefined
) {
  const release = await acquireSenderLock(sender);
  try {
    const pushNameStr: string | undefined = pushName ?? undefined;
    // Rate limiting
    if (!checkRateLimit(sender)) return;

    const userInput = text.trim();
    const state = await getBotState(sender) || { step: 'IDLE' };
    const botLog = async (msg: string) => {
      if (process.env.NODE_ENV === 'production') return;
      try { await appendFile('bot_debug.log', `${new Date().toISOString()} ${msg}\n`); } catch {}
    };
    if (state.step !== 'IDLE') {
      await botLog(`sender=${sender} step=${state.step} updatedAt=${state.updatedAt} now=${Date.now()} delta=${state.updatedAt ? (Date.now() - state.updatedAt)/1000 + 's' : 'N/A'}`);
    }

    // State timeout: reset expired states
    if (state.step !== 'IDLE' && isStateExpired(state)) {
      await botLog(`TIMEOUT for ${sender}: step=${state.step} updatedAt=${state.updatedAt} delta=${(Date.now()-state.updatedAt)/1000}s`);
      recentTimeoutMap.set(sender, Date.now());
      try { await saveBotState(sender, { step: 'IDLE' }); } catch (e: any) { await botLog(`saveBotState after timeout failed: ${e.message}`); }
      await sendMessage(sender, `⏰ Timeout. Koi bhi message bhejein nayi booking shuru karne ke liye.`);
      return;
    }
    // Prevent re-timeout loop: if user just timed out, treat their next message in IDLE
    if (state.step === 'IDLE' && isRecentlyTimeout(sender)) {
      recentTimeoutMap.delete(sender);
    }

    const name = pushName || 'Dear Customer';

    // Skip empty messages
    if (!userInput) return;

    // --- Handle MENU command (go back to main menu) ---
    if (/^(MENU|MAIN\s+MENU)$/i.test(userInput)) {
      await saveBotState(sender, { step: 'IDLE' });
      await showMainMenu(sendMessage, sender, pushNameStr);
      return;
    }

    // --- Back to IDLE if user types 00 from unsupported steps ---
    if (userInput === '00' && !['SELECT_COUNTRY', 'SELECT_CITY', 'SELECT_AREA', 'SELECT_SALON', 'SHOW_SALON_MENU', 'SELECT_SERVICE', 'SELECT_BARBER', 'SELECT_SLOT', 'CONFIRM_BOOKING', 'RESCHEDULE_DATE', 'RESCHEDULE_SLOT', 'RESCHEDULE_CONFIRM', 'RECURRING_CHOOSE', 'RECURRING_DAY', 'GALLERY'].includes(state.step || '')) {
      await saveBotState(sender, { step: 'IDLE' });
      await showMainMenu(sendMessage, sender, pushNameStr);
      return;
    }

    // --- Handle 0 as Main Menu ---
    if (userInput === '0') {
      await saveBotState(sender, { step: 'IDLE' });
      await showMainMenu(sendMessage, sender, pushNameStr);
      return;
    }

    // --- Handle token lookup via #TOKEN ---
    if (/^#[A-Z0-9]{8}$/.test(userInput.toUpperCase())) {
      const token = userInput.toUpperCase();
      const apt = await getAppointmentByToken(token);
      if (!apt) {
        await sendMessage(sender, `❌ Token *${token}* nahi mila. Please apna appointment token check karein.`);
        return;
      }
      const date = new Date(apt.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const statusIcon: Record<string, string> = { completed: '✅', confirmed: '🟢', in_progress: '🔄', cancelled: '❌', pending: '⏳', no_show: '🚫' };
      const statusLine = (label: string, active: boolean) => active ? `● ${label}` : `○ ${label}`;
      const currentStatus = apt.status || 'pending';
      const msg = `┌─────────────────────────┐\n│   📋 *BOOKING DETAILS*   │\n└─────────────────────────┘\n\n` +
        `🔖 Token: *${token}*\n📌 Status: ${statusIcon[currentStatus] || '⏳'} *${(currentStatus).toUpperCase()}*\n\n` +
        `🏪 *${escapeMarkdown(apt.salon_name || '')}*\n💇 ${escapeMarkdown(apt.barber_name || '')}\n✂️ ${escapeMarkdown(apt.service_name || '')}\n📅 ${date} | ⏰ ${apt.appointment_time}\n\n` +
        `📋 *Timeline:*\n${statusLine('Booked', true)}\n${statusLine('Confirmed', ['confirmed', 'in_progress', 'completed'].includes(currentStatus))}\n${statusLine('In Progress', ['in_progress', 'completed'].includes(currentStatus))}\n${statusLine('Completed', currentStatus === 'completed')}\n\n` +
        `💡 *RESCHEDULE ${token}* — change date/time\n💡 *RATE ${token}* — give rating\n💡 *CANCEL ${token}* — cancel booking`;
      await sendMessage(sender, msg);
      return;
    }

if (/^CANCEL\s+#[A-Z0-9]{8}\s*$/i.test(userInput)) {
      const token = userInput.toUpperCase().replace(/^CANCEL\s+/, '').trim();
      const cancelled = await cancelAppointmentByToken(token);
      if (cancelled) {
        await sendMessage(sender, `✅ Appointment *${token}* successfully cancelled.`);
      } else {
        await sendMessage(sender, `❌ Token *${token}* nahi mila ya already cancelled/completed hai.`);
      }
      return;
    }

    // --- Handle RATE #TOKEN command (works from any state) ---
    const rateCmdMatch = userInput.match(/^RATE\s+#[A-Z0-9]{8}\s*$/i);
    if (rateCmdMatch) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const token = userInput.toUpperCase().replace(/^RATE\s+/, '').trim();
      const apt = await getAppointmentByToken(token);
      if (!apt) {
        await sendMessage(sender, `❌ Token ${token} nahi mila.`);
        return;
      }
      await sendMessage(sender, `⭐ Apni booking ke liye rating bhejein:\n\n1️⃣ ⭐\n2️⃣ ⭐⭐\n3️⃣ ⭐⭐⭐\n4️⃣ ⭐⭐⭐⭐\n5️⃣ ⭐⭐⭐⭐⭐\n\nToken: ${token}`);
      return;
    }

    // --- Handle RESCHEDULE #TOKEN command (works from any state) ---
    const reschedCmdMatch = userInput.match(/^RESCHEDULE\s+#[A-Z0-9]{8}\s*$/i);
    if (reschedCmdMatch) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const token = userInput.toUpperCase().replace(/^RESCHEDULE\s+/, '').trim();
      const apt = await getAppointmentByToken(token);
      if (!apt) {
        await sendMessage(sender, `❌ Token ${token} nahi mila.`);
        return;
      }
      // Find next available dates for reschedule
      const today = new Date().toISOString().split('T')[0];
      const dates = await findRescheduleDates(apt.barber_id, today);
      if (dates.length === 0) {
        await sendMessage(sender, `❌ Is appointment ke liye koi dates available nahi hain.`);
        return;
      }
      let msg = `🔄 *Reschedule ${token}*\n\nSelect new date:\n\n`;
      for (let i = 0; i < dates.length; i++) {
        const d = new Date(dates[i]);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        msg += `${i + 1}. ${label}\n`;
      }
      msg += `\n00: Back`;
      await sendMessage(sender, msg);
      await saveBotState(sender, { step: 'RESCHEDULE_DATE', context: { barberId: apt.barber_id, token, dates } });
      return;
    }

    // --- Handle RECURRING command (list/manage recurring bookings) ---
    if (/^RECURRING/i.test(userInput)) {
      const phone = getCleanPhone(sender);
      // Handle CANCEL_RECURRING <id>
      const cancelMatch = userInput.match(/^RECURRING\s+CANCEL\s+(\d+)$/i);
      if (cancelMatch) {
        const id = parseInt(cancelMatch[1]);
        const cancelled = await cancelRecurringBooking(id, phone);
        if (cancelled) {
          await sendMessage(sender, `✅ Recurring booking #${id} cancelled.`);
        } else {
          await sendMessage(sender, `❌ Recurring booking #${id} nahi mili ya already cancelled hai.`);
        }
        return;
      }
      const recurrings = await getRecurringBookingsByPhone(phone);
      if (recurrings.length === 0) {
        await sendMessage(sender, `🔁 Aapki koi recurring booking nahi hai.\n\nNayi booking karne ke baad, aap usay *weekly* ya *monthly* repeat kar sakte hain.\n\nKoi bhi message bhejein nayi booking ke liye.`);
        return;
      }
      let msg = `┌─────────────────────────┐\n│   🔁 *RECURRING BOOKINGS*  │\n│   (${recurrings.length} active)        │\n└─────────────────────────┘\n\n`;
      for (const r of recurrings) {
        const freqLabel = r.frequency === 'weekly' ? '📅 Weekly' : '📅 Monthly';
        const dayLabel = r.frequency === 'weekly'
          ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][r.day_of_week - 1] || ''
          : `Day ${r.day_of_month}`;
        msg += `#${r.id} ${freqLabel} (${dayLabel})\n` +
          `  🏪 ${r.salon_name} | 💇 ${r.barber_name}\n` +
          `  ✂️ ${r.service_name} | ⏰ ${r.appointment_time?.slice(0,5)}\n` +
          `  📅 Next: ${r.next_date ? new Date(r.next_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}\n\n`;
      }
      msg += `💡 Cancel: *RECURRING CANCEL <id>*`;
      await sendMessage(sender, msg);
      return;
    }

    // --- Handle PROFILE command (works from any state) ---
    if (/^(MY\s+)?PROFILE$/i.test(userInput)) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const phone = getCleanPhone(sender);
      const customer = await getCustomerByPhone(phone);
      if (!customer) {
        await sendMessage(sender, `❌ Aapka koi profile nahi mila. Pehle ek booking karein taake profile create ho.`);
        return;
      }
      const tier = (customer.loyalty_points || 0) >= 1000 ? '💎 Platinum' : (customer.loyalty_points || 0) >= 500 ? '🥇 Gold' : (customer.loyalty_points || 0) >= 100 ? '🥈 Silver' : '🪙 Bronze';
      const divider = '▔'.repeat(25);
      const msg = `┌─────────────────────────┐\n│    👤 *CUSTOMER PROFILE*   │\n│   ${tier} Member   │\n├─────────────────────────┤\n│ 📛 *Name:* ${customer.name || 'N/A'}\n│ 📞 *Phone:* ${phone}\n├─────────────────────────┤\n│ ⭐ *Loyalty Points:* ${customer.loyalty_points || 0}\n│ 🏆 *Total Visits:* ${customer.total_visits || 0}\n│ 🌍 *Global Points:* ${customer.global_points || 0}\n│ ${customer.referral_code ? `🔗 *Referral: ${customer.referral_code}*` : '🔗 *Referral:* N/A'}\n├─────────────────────────┤\n│ *Status:* ${tier}          │\n└─────────────────────────┘\n\n📌 *Commands:* BOOKINGS, #TOKEN, HELP`;
      await sendMessage(sender, msg);
      return;
    }

    // --- Handle MY BOOKINGS command (works from any state) ---
    if (/^(MY\s+)?(BOOKINGS?|APPOINTMENTS?)$/i.test(userInput)) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const phone = getCleanPhone(sender);
      const bookings = await getBookingsByPhone(phone);
      if (bookings.length === 0) {
        await sendMessage(sender, `❌ Aapki koi booking nahi hai. Koi bhi message bhejein nayi booking karne ke liye.`);
        return;
      }
      const recent = bookings.slice(0, 5);
      let msg = `┌─────────────────────────┐\n│   📋 *BOOKING HISTORY*    │\n│   (Last ${recent.length} of ${bookings.length})    │\n└─────────────────────────┘\n\n`;
      for (const b of recent) {
        const date = new Date(b.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const statusIcon = b.status === 'completed' ? '✅' : b.status === 'confirmed' ? '🟢' : b.status === 'cancelled' ? '❌' : b.status === 'in_progress' ? '🔄' : '⏳';
        msg += `┌─ # ${b.token} ${statusIcon}\n│ 🏪 ${b.salon_name}\n│ 💇 ${b.service_name}\n│ 📅 ${date} | ⏰ ${b.appointment_time?.slice(0,5)}\n│ 📌 *${(b.status || '').toUpperCase()}*\n└─────────\n\n`;
      }
      msg += `💡 *Token* bhej kar details dekhein\n📌 *HELP* for all commands`;
      await sendMessage(sender, msg);
      return;
    }

    // --- Handle HELP command (works from any state) ---
    if (/^(HELP|MENU|COMMANDS)$/i.test(userInput)) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const lang = await getCustomerPreference(getCleanPhone(sender), 'lang');
      if (lang === 'urdu') {
        const msg = `📖 *دستیاب کمانڈز*\n\n` +
          `1. نئی بکنگ شروع کریں\n` +
          `👤 *PROFILE* — اپنا پروفائل دیکھیں\n` +
          `📋 *BOOKINGS* — اپنی بکنگز دیکھیں\n` +
          `🔍 *#TOKEN* — ٹوکن سے بکنگ کی تفصیل\n` +
          `⭐ *RATE #TOKEN* — بکنگ کو ریٹ کریں\n` +
          `🔄 *RESCHEDULE #TOKEN* — تاریخ/وقت تبدیل کریں\n` +
          `🎉 *OFFERS* — پیشکشیں دیکھیں\n` +
          `💇 *FAV BARBER* — پسندیدہ باربر سیٹ کریں\n` +
          `📍 *LOCATION* — سیلون کا پتہ دیکھیں\n` +
          `🔗 *REFER* — ریفرل کوڈ حاصل کریں\n` +
          `🌐 *LANG URDU/ENGLISH* — زبان تبدیل کریں\n` +
          `⏰ *SLOT <id>* — باربر کے سلاٹ دیکھیں\n` +
          `🏪 *NEARBY* — قریبی سیلون دیکھیں\n` +
          `❌ *CANCEL #TOKEN* — بکنگ منسوخ کریں\n` +
          `🔁 *RECURRING* — ری کرنگ بکنگز دیکھیں\n` +
          `📖 *HELP* — یہ کمانڈز دیکھیں`;
        await sendMessage(sender, msg);
      } else {
        const msg = `📖 *Available Commands*\n\n` +
          `1. Start new booking\n` +
          `👤 *PROFILE* — View your profile\n` +
          `📋 *BOOKINGS* — View your bookings\n` +
          `🔍 *#TOKEN* — Booking details by token\n` +
          `⭐ *RATE #TOKEN* — Rate your booking\n` +
          `🔄 *RESCHEDULE #TOKEN* — Change date/time\n` +
          `🎉 *OFFERS* — View active offers\n` +
          `💇 *FAV BARBER [id]* — Set favorite barber\n` +
          `📍 *LOCATION* — Get salon address\n` +
          `🔗 *REFER* — Get referral code\n` +
          `🌐 *LANG URDU/ENGLISH* — Change language\n` +
          `⏰ *SLOT <id>* — Check barber slots\n` +
          `🏪 *NEARBY* — Find nearby salons\n` +
          `❌ *CANCEL #TOKEN* — Cancel booking\n` +
          `🔁 *RECURRING* — See recurring bookings\n` +
          `📖 *HELP* — Show commands`;
        await sendMessage(sender, msg);
      }
      return;
    }

    // --- RATE #TOKEN <rating> [comment] ---
    const rateMatch = userInput.match(/^RATE\s+#([A-Z0-9]{8})\s+([1-5])(\s+(.+))?\s*$/i);
    if (rateMatch) {
      const token = '#' + rateMatch[1].toUpperCase();
      const rating = parseInt(rateMatch[2]);
      const comment = rateMatch[4]?.trim() || '';
      await saveBotState(sender, { step: 'IDLE' });
      if (rating < 1 || rating > 5) {
        await sendMessage(sender, `❌ Rating 1 se 5 ke darmiyan hona chahiye.\nExample: RATE #A7K2 5`);
        return;
      }
      const apt = await getAppointmentByToken(token);
      if (!apt) {
        await sendMessage(sender, `❌ Token ${token} nahi mila.`);
        return;
      }
      if (apt.customer_phone !== normalizePhone(sender)) {
        await sendMessage(sender, `❌ Ye booking aapki nahi hai.`);
        return;
      }
      try {
        await createReview({
          salon_id: apt.salon_id,
          barber_id: apt.barber_id,
          customer_phone: apt.customer_phone,
          rating,
          comment
        });
        await sendMessage(sender, `✅ ${'⭐'.repeat(rating)} Thank you for your review!${comment ? `\n📝 "${comment}"` : ''}`);
      } catch {
        await sendMessage(sender, `❌ Review submit nahi ho saka.`);
      }
      return;
    }

    // --- RESCHEDULE #TOKEN start ---
    const reschedMatch = userInput.match(/^RESCHEDULE\s+#([A-Z0-9]{8})\s*$/i);
    if (reschedMatch) {
      const token = '#' + reschedMatch[1].toUpperCase();
      const apt = await getAppointmentByToken(token);
      if (!apt) {
        await sendMessage(sender, `❌ Token ${token} nahi mila.`);
        return;
      }
      if (apt.customer_phone !== normalizePhone(sender)) {
        await sendMessage(sender, `❌ Ye booking aapki nahi hai.`);
        return;
      }
      if (['completed', 'cancelled', 'no_show'].includes(apt.status)) {
        await sendMessage(sender, `❌ Ye booking ${apt.status} hai, ise reschedule nahi kar sakte.`);
        return;
      }
      const dates: string[] = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
      let msg = `🔄 *Reschedule Booking ${token}*\n\nSelect new date:\n\n`;
      for (let i = 0; i < dates.length; i++) {
        const d = new Date(dates[i]);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        msg += `${i + 1}. ${label}\n`;
      }
      msg += `\n00: Cancel`;
      await sendMessage(sender, msg);
      await saveBotState(sender, {
        step: 'RESCHEDULE_DATE',
        context: { token, salonId: apt.salon_id, barberId: apt.barber_id, dates }
      });
      return;
    }

    // --- OFFERS command ---
    if (/^OFFERS$/i.test(userInput)) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const offers = await getActiveOffersAll();
      if (offers.length === 0) {
        await sendMessage(sender, `❌ Filhaal koi active offer nahi hai.`);
        return;
      }
      let msg = `┌─────────────────────────┐\n│   🎉 *ACTIVE OFFERS*     │\n│   (${offers.length} available)      │\n└─────────────────────────┘\n\n`;
      for (const o of offers) {
        msg += `🏪 ${o.salon_name}\n📌 ${o.title}\n`;
        if (o.description) msg += `📝 ${o.description}\n`;
        if (o.discount_percent) msg += `💰 ${o.discount_percent}% OFF\n`;
        msg += `📅 Till: ${new Date(o.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n`;
      }
      await sendMessage(sender, msg);
      return;
    }

    // --- FAV BARBER command ---
    const favMatch = userInput.match(/^FAV\s+BARBER\s*(\d+)?$/i);
    if (favMatch) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const phone = getCleanPhone(sender);
      const barberId = favMatch[1] ? parseInt(favMatch[1]) : null;
      if (barberId) {
        await setCustomerPreference(phone, 'fav_barber', String(barberId));
        await sendMessage(sender, `✅ Favorite barber set to ID #${barberId}!\n💡 *SLOT ${barberId}* se slots check karein.`);
      } else {
        const saved = await getCustomerPreference(phone, 'fav_barber');
        if (saved) {
          await sendMessage(sender, `💇 Your favorite barber is ID #${saved}\n💡 *SLOT ${saved}* to check slots\n💡 *FAV BARBER 0* to remove`);
        } else {
          await sendMessage(sender, `❌ Koi favorite barber set nahi hai.\n💡 Use: FAV BARBER <barber_id>\ne.g., *FAV BARBER 3*`);
        }
      }
      return;
    }

    // --- LOCATION command ---
    if (/^LOCATION$/i.test(userInput)) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const phone = getCleanPhone(sender);
      const bookings = await getBookingsByPhone(phone);
      if (bookings.length === 0) {
        await sendMessage(sender, `❌ Aapki koi booking nahi hai. Pehle book karein.`);
        return;
      }
      const last = bookings[0];
      const detail = await getSalonById(last.salon_id);
      if (!detail) {
        await sendMessage(sender, `❌ Salon info nahi mili.`);
        return;
      }
      let msg = `📍 *${detail.name}*\n\n📌 ${detail.address || 'N/A'}\n📞 ${detail.phone || 'N/A'}\n`;
      if (detail.latitude && detail.longitude) {
        msg += `\n🗺️ https://maps.google.com/?q=${detail.latitude},${detail.longitude}`;
      }
      await sendMessage(sender, msg);
      return;
    }

    // --- REFER command ---
    if (/^REFER$/i.test(userInput)) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const phone = getCleanPhone(sender);
      const customer = await getCustomerByPhone(phone);
      const name = customer?.name || 'Customer';
      const code = await getOrCreateReferralCode(phone, name);
      const msg = `┌─────────────────────────┐\n│   🔗 *REFER A FRIEND*    │\n└─────────────────────────┘\n\nYour referral code:\n\n*${code}*\n\n📌 Share this code with friends\n📌 When they book, you both earn points!\n\n💡 Share: "Book on SalonLink using code *${code}*"`;
      await sendMessage(sender, msg);
      return;
    }

    // --- LANG command ---
    const langMatch = userInput.match(/^LANG\s+(URDU|ENGLISH)$/i);
    if (langMatch) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const phone = getCleanPhone(sender);
      const lang = langMatch[1].toLowerCase();
      await setCustomerPreference(phone, 'lang', lang);
      const reply = lang === 'urdu'
        ? `✅ زبان اردو میں تبدیل کر دی گئی۔`
        : `✅ Language switched to English.`;
      await sendMessage(sender, reply);
      return;
    }

    // --- NEXT <barber_id> command (find next available slot) ---
    const nextMatch = userInput.match(/^NEXT\s+(\d+)$/i);
    if (nextMatch) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const barberId = parseInt(nextMatch[1]);
      const today = new Date().toISOString().split('T')[0];
      const slots = await getAvailableSlots(barberId, today);
      if (slots.length > 0) {
        await sendMessage(sender, `✅ Barber #${barberId} ke aaj bhi slots hain!\n\n${formatSlots(slots)}\n\nBook karne ke liye salon select karein.`);
        return;
      }
      const nextSlot = await findNextAvailableSlot(barberId, today);
      if (nextSlot) {
        const nextDate = new Date(nextSlot.date);
        const nextDisplay = nextDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        await sendMessage(sender, `📅 Barber #${barberId} ke liye agli available slot:\n🗓️ ${nextDisplay}\n⏰ ${nextSlot.slot.start} – ${nextSlot.slot.end}\n\nBook karne ke liye salon select karein.`);
        return;
      }
      await sendMessage(sender, `❌ Barber #${barberId} ke agle 30 din mein koi slots available nahi hain.`);
      return;
    }

    // --- SLOT <barber_id> command ---
    const slotMatch = userInput.match(/^SLOT\s+(\d+)$/i);
    if (slotMatch) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const barberId = parseInt(slotMatch[1]);
      const today = new Date().toISOString().split('T')[0];
      const slots = await getAvailableSlots(barberId, today);
      if (slots.length === 0) {
        await sendMessage(sender, `❌ Barber #${barberId} ke aaj koi slots available nahi hain.\n\n"NEXT ${barberId}" type karein agli available slot ke liye.`);
        return;
      }
      let msg = `┌─────────────────────────┐\n│   ⏰ *TODAY'S SLOTS*     │\n│   Barber #${barberId}            │\n└─────────────────────────┘\n\n${formatSlots(slots)}\n\n💡 Book karne ke liye koi bhi message bhejein.`;
      await sendMessage(sender, msg);
      return;
    }

    // --- NEARBY command ---
    if (/^NEARBY$/i.test(userInput)) {
      if (state.step !== 'IDLE') {
        await saveBotState(sender, { step: 'IDLE' });
      }
      const salons = await getAllSalons();
      if (salons.length === 0) {
        await sendMessage(sender, `❌ Koi salon available nahi hai.`);
        return;
      }
      let msg = `┌─────────────────────────┐\n│   🏪 *SALONS*            │\n│   (${salons.length} available)      │\n└─────────────────────────┘\n\n`;
      salons.slice(0, 10).forEach((s: any, i) => {
        msg += `${i + 1}. ${s.name}${s.rating ? ` ⭐${s.rating}` : ''}\n   📍 ${s.address || ''}\n`;
      });
      msg += `\nBook karne ke liye koi bhi message bhejein.`;
      await sendMessage(sender, msg);
      return;
    }

    // --- Handle cancel ---
    if (userInput.toUpperCase().trim() === 'CANCEL' && state.step !== 'IDLE') {
      await saveBotState(sender, { step: 'IDLE' });
      await showMainMenu(sendMessage, sender, pushNameStr);
      return;
    }

    // --- Gallery back handler ---
    if (state.step === 'GALLERY' && (userInput === '00' || userInput.toUpperCase() === 'BACK')) {
      const ctx = state.context;
      await showSalonMenu(sendMessage, sender, { id: ctx.salonId, name: ctx.salonName } as any);
      await saveBotState(sender, { step: 'SHOW_SALON_MENU', context: { countryId: ctx.countryId, cityId: ctx.cityId, areaId: ctx.areaId, salonId: ctx.salonId, salonName: ctx.salonName } });
      return;
    }

    // --- Back handler ---
    if (userInput === '00' || userInput.toUpperCase() === 'BACK') {
      // Skip updateCustomerStatus — unnecessary DB write on back navigation
      if (state.step === 'RESCHEDULE_DATE') {

        await saveBotState(sender, { step: 'IDLE' });
        await sendMessage(sender, `Reschedule cancelled.`);
        return;
      }
      if (state.step === 'RESCHEDULE_SLOT') {
        const ctx = state.context;
        const dates = ctx.dates as string[];
        let msg = `🔄 *Reschedule ${ctx.token}*\n\nSelect new date:\n\n`;
        for (let i = 0; i < dates.length; i++) {
          const d = new Date(dates[i]);
          const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
          msg += `${i + 1}. ${label}\n`;
        }
        msg += `\n00: Back`;
        await sendMessage(sender, msg);
        await saveBotState(sender, { step: 'RESCHEDULE_DATE', context: ctx });
        return;
      }
      if (state.step === 'RESCHEDULE_CONFIRM') {
        const ctx = state.context;
        const slots = await getAvailableSlots(ctx.barberId, ctx.selectedDate);
        await sendMessage(sender, `Available slots:\n\n${formatSlots(slots)}\n\n00: Back\n${M}`);
        await saveBotState(sender, { step: 'RESCHEDULE_SLOT', context: ctx });
        return;
      }
      if (state.step === 'SELECT_COUNTRY') {
        await saveBotState(sender, { step: 'IDLE' });
        await showMainMenu(sendMessage, sender, pushNameStr);
        return;
      }
      if (state.step === 'SELECT_CITY') {
        await showCountries(sendMessage, sender);
        await saveBotState(sender, { step: 'SELECT_COUNTRY' });
        return;
      }
      if (state.step === 'SELECT_AREA') {
        await showCities(sendMessage, sender, state.context.countryId);
        await saveBotState(sender, { step: 'SELECT_CITY', context: { countryId: state.context.countryId } });
        return;
      }
      if (state.step === 'SELECT_SALON') {
        await showAreas(sendMessage, sender, state.context.cityId);
        await saveBotState(sender, { step: 'SELECT_AREA', context: { countryId: state.context.countryId, cityId: state.context.cityId } });
        return;
      }
      if (state.step === 'SHOW_SALON_MENU' || state.step === 'SELECT_SERVICE') {
        const ctx = state.context;
        const salons = await getSalonsByLocation(ctx.countryId, ctx.cityId, ctx.areaId);
        await showSalons(sendMessage, sender, salons);
        await saveBotState(sender, { step: 'SELECT_SALON', context: { countryId: ctx.countryId, cityId: ctx.cityId, areaId: ctx.areaId } });
        return;
      }
      if (state.step === 'SELECT_BARBER') {
        const ctx = state.context;
        await showServices(sendMessage, sender, ctx.salonId);
        await saveBotState(sender, { step: 'SELECT_SERVICE', context: ctx });
        return;
      }
      if (state.step === 'SELECT_SLOT') {
        const ctx = state.context;
        const barbers = await getBarbersBySalon(ctx.salonId);
        await showBarbers(sendMessage, sender, barbers);
        await saveBotState(sender, { step: 'SELECT_BARBER', context: ctx });
        return;
      }
      if (state.step === 'CONFIRM_BOOKING') {
        const ctx = state.context;
        delete ctx.autoSlots;
        const slots = await getAvailableSlots(ctx.barberId, ctx.selectedDate);
        await sendMessage(sender, `Available slots:\n\n${formatSlots(slots)}\n\n00: Back\n${M}`);
        await saveBotState(sender, { step: 'SELECT_SLOT', context: ctx });
        return;
      }
      if (state.step === 'RECURRING_CHOOSE') {
        await sendMessage(sender, `OK, recurring nahi karenge. Koi bhi message bhejein nayi booking ke liye.`);
        await saveBotState(sender, { step: 'IDLE' });
        return;
      }
    }

    // =========== AI NATURAL LANGUAGE HANDLER ===========
    // Jab AI enable ho to natural language samjhe
    if (state.step === 'IDLE' && isAiAvailable()) {
      const aiResult = await processWithAI(sender, userInput);
      if (aiResult) {
        switch (aiResult.action) {
          case 'BOOK':
            await showCountries(sendMessage, sender);
            await saveBotState(sender, { step: 'SELECT_COUNTRY' });
            return;
          case 'PROFILE':
            // fall through to existing profile handler
            break;
          case 'BOOKINGS':
            // fall through
            break;
          case 'RATE': {
            const token = aiResult.params.token;
            const rating = aiResult.params.rating;
            const comment = aiResult.params.comment || '';
            if (token && rating >= 1 && rating <= 5) {
              const apt = await getAppointmentByToken(token);
               if (apt && apt.customer_phone === normalizePhone(sender)) {
                try {
                  await createReview({
                    salon_id: apt.salon_id,
                    barber_id: apt.barber_id,
                    customer_phone: apt.customer_phone,
                    rating,
                    comment
                  });
                  await sendMessage(sender, `✅ ${'⭐'.repeat(rating)} Thank you for your review!${comment ? `\n📝 "${comment}"` : ''}`);
                } catch {
                  await sendMessage(sender, `❌ Review submit nahi ho saka.`);
                }
              } else {
                await sendMessage(sender, `❌ Token ${token} nahi mila ya ye aapki booking nahi hai.`);
              }
            }
            return;
          }
          case 'GREETING':
            await sendMessage(sender, aiResult.reply);
            return;
          case 'UNKNOWN':
            await sendMessage(sender, aiResult.reply);
            return;
          default:
            // For other actions, show the AI's response and fall through
            if (aiResult.reply) {
              await sendMessage(sender, aiResult.reply);
            }
            return;
        }
      }
    }

    // =========== STATE MACHINE ===========

    if (state.step === 'IDLE') {
      if (userInput === '1') {
        await showCountries(sendMessage, sender);
        await saveBotState(sender, { step: 'SELECT_COUNTRY' });
        return;
      }
      if (userInput === '2') {
        const phone = getCleanPhone(sender);
        const customer = await getCustomerByPhone(phone);
        if (!customer) {
          await sendMessage(sender, `❌ Aapka koi profile nahi mila. Pehle ek booking karein.\n\n${M}`);
          return;
        }
        const tier = (customer.loyalty_points || 0) >= 1000 ? '💎 Platinum' : (customer.loyalty_points || 0) >= 500 ? '🥇 Gold' : (customer.loyalty_points || 0) >= 100 ? '🥈 Silver' : '🪙 Bronze';
        const msg = `👤 *My Profile*\n\n📛 Name: ${customer.name || 'N/A'}\n📞 Phone: ${phone}\n⭐ Points: ${customer.loyalty_points || 0}\n🏆 Visits: ${customer.total_visits || 0}\n👑 Status: ${tier}\n\n${M}`;
        await sendMessage(sender, msg);
        return;
      }
      if (userInput === '3') {
        const phone = getCleanPhone(sender);
        const bookings = await getBookingsByPhone(phone);
        if (!bookings || bookings.length === 0) {
          await sendMessage(sender, `❌ Aapki koi booking nahi hai.\n\n${M}`);
          return;
        }
        let msg = `📋 *My Bookings*\n\n`;
        const active = bookings.filter((b: any) => ['pending', 'confirmed', 'in_progress'].includes(b.status));
        if (active.length === 0) {
          msg += `Koi active booking nahi hai.\n`;
        } else {
          active.slice(0, 5).forEach((b: any, i: number) => {
            msg += `${i + 1}. ${b.salon_name} | ${b.service_name}\n   📅 ${b.appointment_date} ⏰ ${b.appointment_time?.slice(0,5)}\n   🎫 ${b.token}\n\n`;
          });
        }
        msg += `${M}`;
        await sendMessage(sender, msg);
        return;
      }
      if (userInput === '4') {
        const phone = getCleanPhone(sender);
        const bookings = await getBookingsByPhone(phone);
        const history = bookings ? bookings.filter((b: any) => ['completed', 'cancelled', 'no_show'].includes(b.status)) : [];
        if (history.length === 0) {
          await sendMessage(sender, `❌ Aapki koi history nahi hai.\n\n${M}`);
          return;
        }
        let msg = `📜 *Booking History*\n\n`;
        history.slice(0, 10).forEach((b: any, i: number) => {
          msg += `${i + 1}. ${b.salon_name} | ${b.service_name}\n   📅 ${b.appointment_date} ⏰ ${b.appointment_time?.slice(0,5)}\n   📌 ${b.status}\n\n`;
        });
        msg += `${M}`;
        await sendMessage(sender, msg);
        return;
      }
      if (userInput === '5') {
        const offers = await getActiveOffersAll();
        if (!offers || offers.length === 0) {
          await sendMessage(sender, `❌ Filhaal koi offer nahi hai.\n\n${M}`);
          return;
        }
        let msg = `🎉 *Active Offers*\n\n`;
        offers.slice(0, 10).forEach((o: any, i: number) => {
          msg += `${i + 1}. ${o.title}${o.discount_percent ? ` (${o.discount_percent}% off)` : ''}\n   ${o.description || ''}\n\n`;
        });
        msg += `${M}`;
        await sendMessage(sender, msg);
        return;
      }
      if (userInput === '6') {
        const msg = `❓ *Help*\n\n1. Book Appointment - Nayi booking karein\n2. My Profile - Apna profile dekhein\n3. My Bookings - Active bookings dekhein\n4. History - Purani bookings dekhein\n5. Offers - Offers dekhein\n\n🔍 #TOKEN - Token se booking check karein\n💡 CANCEL #TOKEN - Booking cancel karein\n💡 RESCHEDULE #TOKEN - Booking reschedule karein\n💡 RATE #TOKEN - Rating dein\n\n${M}`;
        await sendMessage(sender, msg);
        return;
      }
      await sendMessage(sender, `❌ Invalid option. Please select 1-6.\n\n${M}`);
      return;
    }

    if (state.step === 'SELECT_COUNTRY') {
      const countries = await getAllCountries();
      let countryId: number | null = null;
      const listMatch = userInput.match(/^COUNTRY_(\d+)$/);
      if (listMatch) {
        countryId = parseInt(listMatch[1]);
      } else {
        const idx = parseInt(userInput) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < countries.length) {
          countryId = countries[idx].id;
        }
      }
      if (!countryId) {
        await sendMessage(sender, `❌ Invalid choice. Please select a country from the list.`);
        return;
      }
      await showCities(sendMessage, sender, countryId);
      await saveBotState(sender, { step: 'SELECT_CITY', context: { countryId } });
      return;
    }

    if (state.step === 'SELECT_CITY') {
      const cities = await getCitiesByCountry(state.context.countryId);
      let cityId: number | null = null;
      const listMatch = userInput.match(/^CITY_(\d+)$/);
      if (listMatch) {
        cityId = parseInt(listMatch[1]);
      } else {
        const idx = parseInt(userInput) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < cities.length) {
          cityId = cities[idx].id;
        }
      }
      if (!cityId) {
        await sendMessage(sender, `❌ Invalid choice. Please select a city from the list.`);
        return;
      }
      await showAreas(sendMessage, sender, cityId);
      await saveBotState(sender, { step: 'SELECT_AREA', context: { ...state.context, cityId } });
      return;
    }

    if (state.step === 'SELECT_AREA') {
      const areas = await getAreasByCity(state.context.cityId);
      let areaId: number | null = null;
      const listMatch = userInput.match(/^AREA_(\d+)$/);
      if (listMatch) {
        areaId = parseInt(listMatch[1]);
      } else {
        const idx = parseInt(userInput) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < areas.length) {
          areaId = areas[idx].id;
        }
      }
      if (!areaId) {
        await sendMessage(sender, `❌ Invalid choice. Please select an area from the list.`);
        return;
      }
      const salons = await getSalonsByLocation(state.context.countryId, state.context.cityId, areaId);
      await showSalons(sendMessage, sender, salons);
      await saveBotState(sender, { step: 'SELECT_SALON', context: { ...state.context, areaId } });
      return;
    }

    if (state.step === 'SELECT_SALON') {
      const ctx = state.context;
      const salons = await getSalonsByLocation(ctx.countryId, ctx.cityId, ctx.areaId);
      let salon: any = null;
      const listMatch = userInput.match(/^SALON_(\d+)$/);
      if (listMatch) {
        salon = salons.find((s: any) => s.id === parseInt(listMatch[1])) || null;
      } else {
        const idx = parseInt(userInput) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < salons.length) {
          salon = salons[idx];
        }
      }
      if (!salon) {
        await sendMessage(sender, `❌ Invalid choice. Please select a salon from the list.`);
        return;
      }

      await showSalonMenu(sendMessage, sender, salon);
      await saveBotState(sender, { step: 'SHOW_SALON_MENU', context: { ...ctx, salonId: salon.id, salonName: salon.name } });
      return;
    }

    if (state.step === 'SHOW_SALON_MENU') {
      const ctx = state.context;
      const menuBook = ['1', 'MENU_BOOK'].includes(userInput);
      const menuOffers = ['2', 'MENU_OFFERS'].includes(userInput);
      const menuReviews = ['3', 'MENU_REVIEWS'].includes(userInput);
      const menuInfo = ['4', 'MENU_INFO'].includes(userInput);
      const menuGallery = ['5', 'MENU_GALLERY'].includes(userInput);
      if (menuBook) {
        await showServices(sendMessage, sender, ctx.salonId);
        await saveBotState(sender, { step: 'SELECT_SERVICE', context: ctx });
        return;
      }
      if (menuOffers) {
        const offers = await getOffersBySalon(ctx.salonId);
        if (offers.length === 0) {
          await sendMessage(sender, `❌ Is waqt koi offer nahi hai.`);
        } else {
          let msg = `🎉 *Current Offers* 🎉\n\n`;
          for (const o of offers) {
            msg += `*${escapeMarkdown(o.title)}*\n`;
            if (o.description) msg += `${escapeMarkdown(o.description)}\n`;
            if (o.discount_percent) msg += `Discount: ${o.discount_percent}%\n`;
            msg += `Valid till: ${o.valid_until ? new Date(o.valid_until).toLocaleDateString('en-IN') : 'N/A'}\n\n`;
          }
          await sendMessage(sender, msg);
        }
        await showSalonMenu(sendMessage, sender, { id: ctx.salonId, name: ctx.salonName } as any);
        return;
      }
      if (menuReviews) {
        const reviews = await getSalonReviews(ctx.salonId);
        if (reviews.length === 0) {
          await sendMessage(sender, `❌ Abhi koi reviews nahi hain.`);
        } else {
          let msg = `⭐ *Reviews* ⭐\n\n`;
          for (const r of reviews) {
            const stars = '⭐'.repeat(r.rating);
            msg += `${stars} by ${r.customer_name || 'Anonymous'}\n`;
            if (r.comment) msg += `"${escapeMarkdown(r.comment)}"\n`;
            msg += `\n`;
          }
          await sendMessage(sender, msg);
        }
        await showSalonMenu(sendMessage, sender, { id: ctx.salonId, name: ctx.salonName } as any);
        return;
      }
      if (menuInfo) {
        const detail = await getSalonDetailForBot(ctx.salonId);
        if (detail) {
          let msg = `🏪 *${escapeMarkdown(detail.name)}*\n\n`;
          if (detail.address) msg += `📍 *Address:* ${escapeMarkdown(detail.address)}\n`;
          if (detail.phone) msg += `📞 *Phone:* ${detail.phone}\n`;
          if (detail.email) msg += `📧 *Email:* ${detail.email}\n`;
          if (detail.city_name) msg += `🏙️ *City:* ${detail.city_name}\n`;
          if (detail.area_name) msg += `📍 *Area:* ${detail.area_name}\n`;
          if (detail.rating) msg += `⭐ *Rating:* ${detail.rating}/5\n`;
          await sendMessage(sender, msg);
        }
        await showSalonMenu(sendMessage, sender, { id: ctx.salonId, name: ctx.salonName } as any);
        return;
      }
      if (menuGallery) {
        const media = await getSalonMedia(ctx.salonId);
        if (media.length === 0) {
          await sendMessage(sender, `❌ Is salon mein abhi koi gallery images nahi hain.`);
          await showSalonMenu(sendMessage, sender, { id: ctx.salonId, name: ctx.salonName } as any);
          return;
        }
        let msg = `🖼️ *${escapeMarkdown(ctx.salonName)} — Gallery*\n\n`;
        for (let i = 0; i < media.length; i++) {
          const m = media[i];
          const typeIcon = m.media_type === 'video' ? '🎬' : '🖼️';
          msg += `${i + 1}. ${typeIcon} ${escapeMarkdown(m.title || 'Untitled')}`;
          if (m.description) msg += `\n   ${escapeMarkdown(m.description)}`;
          msg += `\n\n`;
        }
        msg += `00: Wapas\n${M}`;
        await sendMessage(sender, msg);
        await saveBotState(sender, { step: 'GALLERY', context: { ...ctx, media } });
        return;
      }
      await sendMessage(sender, `❌ Invalid option. Please select a valid option.`);
      return;
    }

    if (state.step === 'SELECT_SERVICE') {
      const ctx = state.context;
      const services = await getServicesBySalon(ctx.salonId);
      if (services.length === 0) {
        await sendMessage(sender, `❌ Is salon mein koi service available nahi hai.\n\nMENU type karke wapas jayein.`);
        await saveBotState(sender, { step: 'IDLE' });
        return;
      }
      let service: any = null;
      const listMatch = userInput.match(/^SERVICE_(\d+)$/);
      if (listMatch) {
        service = services.find((s: any) => s.id === parseInt(listMatch[1])) || null;
      } else {
        const idx = parseInt(userInput) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < services.length) {
          service = services[idx];
        }
      }
      if (!service) {
        await sendMessage(sender, `❌ Invalid choice. Please select a service from the list.`);
        return;
      }
      const barbers = await getBarbersBySalon(ctx.salonId);
      await showBarbers(sendMessage, sender, barbers);
      await saveBotState(sender, { step: 'SELECT_BARBER', context: { ...ctx, barbers, serviceId: service.id, serviceName: service.name, servicePrice: service.price, serviceDuration: service.duration } });
      return;
    }

    if (state.step === 'SELECT_BARBER') {
      const ctx = state.context;
      const barbers = state.context.barbers || await getBarbersBySalon(ctx.salonId);
      if (barbers.length === 0) {
        await sendMessage(sender, `❌ Is salon mein koi barber available nahi hai.\n\nMENU type karke wapas jayein.`);
        await saveBotState(sender, { step: 'IDLE' });
        return;
      }
      let barber: any = null;
      const listMatch = userInput.match(/^BARBER_(\d+)$/);
      if (listMatch) {
        barber = barbers.find((b: any) => b.id === parseInt(listMatch[1])) || null;
      } else {
        const idx = parseInt(userInput) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < barbers.length) {
          barber = barbers[idx];
        }
      }
      if (!barber) {
        await sendMessage(sender, `❌ Invalid choice. Please select a barber from the list.`);
        return;
      }

      const today = new Date();
      // Show slots for today first
      const dateStr = today.toISOString().split('T')[0];
      const slots = await getAvailableSlots(barber.id, dateStr);
      if (slots.length === 0) {
        await sendMessage(sender, `😔 ${escapeMarkdown(barber.name)} ke aaj koi slots available nahi hain.`);
        // Try tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowSlots = await getAvailableSlots(barber.id, tomorrowStr);
        if (tomorrowSlots.length > 0) {
          const dateDisplay = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
          await sendMessage(sender, `Kal *${dateDisplay}* ke liye ye slots hain:\n\n${formatSlots(tomorrowSlots)}\n\n00: Back\n${M}`);
          await saveBotState(sender, { step: 'SELECT_SLOT', context: { ...ctx, barberId: barber.id, barberName: barber.name, selectedDate: tomorrowStr } });
          return;
        }
        // Auto-find next available slot
        const nextSlot = await findNextAvailableSlot(barber.id, tomorrowStr);
        if (nextSlot) {
          const nextDate = new Date(nextSlot.date);
          const nextDisplay = nextDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          await sendMessage(sender, `✅ *${escapeMarkdown(barber.name)}* ke liye agli available slot:\n📅 ${nextDisplay}\n⏰ ${nextSlot.slot.start} – ${nextSlot.slot.end}\n\n1️⃣ Is slot ko book karein\n00: Back\n${M}`);
          await saveBotState(sender, {
            step: 'SELECT_SLOT',
            context: { ...ctx, barberId: barber.id, barberName: barber.name, selectedDate: nextSlot.date, autoSlots: [nextSlot.slot] }
          });
          return;
        }
        // Check any barber in this salon
        const anyBarber = await findNextAvailableSlotForAnyBarber(ctx.salonId, ctx.serviceDuration || 30, tomorrowStr);
        if (anyBarber) {
          const nextDate = new Date(anyBarber.date);
          const nextDisplay = nextDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          await sendMessage(sender, `ℹ️ *${escapeMarkdown(barber.name)}* ke koi slots available nahi hain.\nLekin *${escapeMarkdown(anyBarber.barberName)}* ke liye slot available hai:\n📅 ${nextDisplay}\n⏰ ${anyBarber.slot.start} – ${anyBarber.slot.end}\n\nKya aap ${escapeMarkdown(anyBarber.barberName)} se book karwana chahenge?\n\n1️⃣ Haan, is barber se book karein\n00: Back\n${M}`);
          await saveBotState(sender, {
            step: 'SELECT_SLOT',
            context: { ...ctx, barberId: anyBarber.barberId, barberName: anyBarber.barberName, selectedDate: anyBarber.date, autoSlots: [anyBarber.slot] }
          });
          return;
        }
        await sendMessage(sender, `😔 Maafi chahte hain, agle 30 din mein ${escapeMarkdown(barber.name)} ke koi slots available nahi hain. Baad mein dobara try karein.`);
        await showSalonMenu(sendMessage, sender, { id: ctx.salonId, name: ctx.salonName } as any);
        await saveBotState(sender, { step: 'SHOW_SALON_MENU', context: { ...state.context, barberId: undefined, barberName: undefined } });
        return;
      }
      const dateDisplay = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
      if (barber.profile_image && sendDocument) {
        try {
          let imageUrl = barber.profile_image;
          if (imageUrl.startsWith('/')) imageUrl = BASE_URL + imageUrl;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const response = await fetch(imageUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const ext = imageUrl.split('.').pop() || 'jpg';
            await sendDocument(sender, buffer, `barber-${barber.id}.${ext}`, `💇 ${escapeMarkdown(barber.name)}`);
          }
        } catch {
          // Image load failed, continue with text
        }
      }
      let msg = `💇 *${escapeMarkdown(barber.name)}*\n⭐ Rating: ${barber.rating}/5 (${barber.review_count} reviews)\nExperience: ${barber.experience} years\n\n`;
      if (barber.specialization) msg += `Specialization: ${escapeMarkdown(barber.specialization)}\n\n`;
      msg += `📅 Aaj *${dateDisplay}* ke liye available slots:\n\n${formatSlots(slots)}\n\n00: Back\n${M}`;
      await sendMessage(sender, msg);
      await saveBotState(sender, { step: 'SELECT_SLOT', context: { ...ctx, barberId: barber.id, barberName: barber.name, selectedDate: dateStr } });
      return;
    }

if (state.step === 'SELECT_SLOT') {
       const ctx = state.context;
       const slots = ctx.autoSlots || await getAvailableSlots(ctx.barberId, ctx.selectedDate);
      if (slots.length === 0) {
        await sendMessage(sender, `❌ Is barber ke liye koi slot available nahi hai.\n\n00: Wapas\n${M}`);
        return;
      }
      const idx = parseInt(userInput) - 1;
      if (isNaN(idx) || idx < 0 || idx >= slots.length) {
        await sendMessage(sender, `❌ Invalid choice. Please select a number from 1 to ${slots.length}.`);
        return;
      }
      const slot = slots[idx];
      const dateObj = new Date(ctx.selectedDate);
      const dateDisplay = dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const token = await generateUniqueToken(async (t) => {
        const existing = await getAppointmentByToken(t);
        return existing !== null;
      });
      const priceStr = ctx.servicePrice ? `Rs. ${ctx.servicePrice}` : 'N/A';
      const confirmMsg = `📋 *Confirm Your Booking*\n\n🏪 ${escapeMarkdown(ctx.salonName)}\n💇 ${escapeMarkdown(ctx.barberName)}\n✂️ ${escapeMarkdown(ctx.serviceName)} (${priceStr})\n📅 ${dateDisplay}\n⏰ ${slot.start} – ${slot.end}\n\n🔖 Token: *${token}*`;
      await sendMessage(sender, `${confirmMsg}\n\n1. ✅ Confirm\n00. 🔙 Back\n${M}`);
      await saveBotState(sender, {
        step: 'CONFIRM_BOOKING',
        context: { ...ctx, selectedSlot: slot, token }
      });
      return;
    }

if (state.step === 'CONFIRM_BOOKING') {
       const ctx = state.context;
       if (userInput === '1' || userInput === 'CONFIRM_YES') {
         // Confirm booking
         const result = await createAppointment({
           salon_id: ctx.salonId,
           barber_id: ctx.barberId,
           customer_phone: getCleanPhone(sender),
           customer_name: pushName || '',
           service_id: ctx.serviceId,
           appointment_date: ctx.selectedDate,
           appointment_time: ctx.selectedSlot.start,
           end_time: ctx.selectedSlot.end,
           token: ctx.token
         });
if (!result.success) {
            await sendMessage(sender, `❌ Booking confirm nahi ho saki: ${result.error || 'Slot already booked'}.\nKripya dobara try karein.`);
            return;
          }
         // Upsert customer + add loyalty points
         const price = ctx.servicePrice || 0;
         const points = Math.floor(price / BOT_CONFIG.pointsPerPriceDivisor);
         try {
           await upsertCustomer(pushName || '', getCleanPhone(sender));
           await updateCustomerActivity(getCleanPhone(sender));
           if (points > 0) {
             await addLoyaltyPoints(getCleanPhone(sender), points);
           }
         } catch (_) { /* non-critical */ }

         // Notify salon owner via WhatsApp
         try {
           await sendBookingAlert({
             salon_id: ctx.salonId,
             salon_name: ctx.salonName,
             customer_name: pushName || 'Customer',
             customer_phone: normalizePhone(sender),
             service_name: ctx.serviceName,
             appointment_date: ctx.selectedDate,
             appointment_time: ctx.selectedSlot.start,
             token: ctx.token
           });
         } catch (_) { /* non-critical */ }

         const dateObj = new Date(ctx.selectedDate);
         const dateDisplay = dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
         const msg = `✅ *Booking Confirmed!* 🎉\n\n🏪 *${escapeMarkdown(ctx.salonName)}*\n💇 Barber: ${escapeMarkdown(ctx.barberName)}\n✂️ Service: ${escapeMarkdown(ctx.serviceName)}\n📅 Date: ${dateDisplay}\n⏰ Time: ${ctx.selectedSlot.start}\n🔖 Token: *${ctx.token}*\n\n📌 *Please note your token number* — aapko salon par ye token dena hoga.\n${points > 0 ? `\n🎉 Aapne ${points} loyalty points earn kiye hain!` : ''}\n\nKuch aur madad? Koi bhi message bhejein nayi booking ke liye.`;
         await sendMessage(sender, msg);

         // Generate & send PDF receipt
         try {
           let salonAddress: string | undefined;
           const salonDetail = await getSalonById(ctx.salonId);
           if (salonDetail) {
             salonAddress = salonDetail.address;
           }
           const receiptData = {
             receiptId: `RCP-${ctx.token.replace('#', '')}`,
             salonName: ctx.salonName,
             salonAddress,
             salonPhone: salonDetail?.phone,
             barberName: ctx.barberName,
             serviceName: ctx.serviceName,
             servicePrice: ctx.servicePrice,
             serviceDuration: ctx.serviceDuration,
             appointmentDate: dateDisplay,
             appointmentTime: ctx.selectedSlot.start,
             endTime: ctx.selectedSlot.end,
             token: ctx.token,
             customerName: pushName || '',
             customerPhone: getCleanPhone(sender),
             status: 'Confirmed'
           };
           const pdfBuffer = await generateReceiptPDF(receiptData);
           if (sendDocument) {
             await sendDocument(sender, pdfBuffer, `receipt-${ctx.token.replace('#', '')}.pdf`, `📄 Booking Receipt - ${ctx.token}`);
           }
         } catch (pdfErr) {
           console.error('[Bot] PDF receipt error (non-critical):', pdfErr);
         }

         // Ask if they want recurring booking
         const repeatMsg = `🔁 *Is booking ko repeat karein?*\n\n1. Weekly (har week is din)\n2. Monthly (har month is date)\n00. Nahi, thank you`;
 await sendMessage(sender, repeatMsg);
         await saveBotState(sender, {
           step: 'RECURRING_CHOOSE',
           context: { ...ctx }
         });
         return;
       }
        await sendMessage(sender, `❌ Invalid input. Wapas slot select karne ke liye koi bhi message bhejein.`);
        await saveBotState(sender, { step: 'SELECT_SLOT', context: ctx });
        return;
     }

    if (state.step === 'RECURRING_CHOOSE') {
      const ctx = state.context;
      if (userInput === '0' || userInput.toUpperCase() === 'CANCEL' || /^(MENU|MAIN\s+MENU)$/i.test(userInput)) {
        await saveBotState(sender, { step: 'IDLE' });
        await showMainMenu(sendMessage, sender, pushNameStr);
        return;
      }
      if (userInput === '1' || userInput === 'REPEAT_WEEKLY') {
        await sendMessage(sender, `📅 *Which day?*\n\n1 Mon | 2 Tue | 3 Wed | 4 Thu\n5 Fri | 6 Sat | 7 Sun\n\n00: Back`);
        await saveBotState(sender, {
          step: 'RECURRING_DAY',
          context: { ...ctx, frequency: 'weekly' }
        });
        return;
      }
      if (userInput === '2' || userInput === 'REPEAT_MONTHLY') {
        await sendMessage(sender, `📆 *Kis date ko?* (1-31)\n\nHar month ki is tarikh ko booking repeat hogi.\n\n00: Back`);
        await saveBotState(sender, {
          step: 'RECURRING_DAY',
          context: { ...ctx, frequency: 'monthly' }
        });
        return;
      }
      await sendMessage(sender, `❌ Invalid choice. Wapas main menu mein ja rahe hain.\n\nKoi bhi message bhejein nayi booking ke liye.`);
      await saveBotState(sender, { step: 'IDLE' });
      return;
    }

    if (state.step === 'RECURRING_DAY') {
      const ctx = state.context;
      if (userInput === '0' || userInput.toUpperCase() === 'CANCEL' || /^(MENU|MAIN\s+MENU)$/i.test(userInput)) {
        await saveBotState(sender, { step: 'IDLE' });
        await showMainMenu(sendMessage, sender, pushNameStr);
        return;
      }
      if (userInput === '00') {
        await sendMessage(sender, `Cancel. Koi bhi message bhejein nayi booking ke liye.`);
        await saveBotState(sender, { step: 'IDLE' });
        return;
      }
      const day = parseInt(userInput);
      if (ctx.frequency === 'weekly') {
        if (isNaN(day) || day < 1 || day > 7) {
          await sendMessage(sender, `❌ 1-7 ke darmiyan koi number bhejein.\n1 Mon | 2 Tue | 3 Wed | 4 Thu\n5 Fri | 6 Sat | 7 Sun\n\n00: Back`);
          return;
        }
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const weeklyRes = await createRecurringBooking({
          salon_id: ctx.salonId,
          barber_id: ctx.barberId,
          customer_phone: getCleanPhone(sender),
          customer_name: pushName || '',
          service_id: ctx.serviceId,
          appointment_time: ctx.selectedSlot.start,
          end_time: ctx.selectedSlot.end,
          frequency: 'weekly',
          day_of_week: day
        });
        if (weeklyRes.success) {
          await sendMessage(sender, `✅ *Recurring Booking Set!* 🎉\n\n🔁 Har *${days[day-1]}* ko booking auto-create hogi.\n🧾 Receipt har baar WhatsApp par aayega.\n\n💡 *RECURRING* se dekhein ya *RECURRING CANCEL <id>* se cancel karein.`);
        } else {
          await sendMessage(sender, `❌ Recurring set nahi ho saka: ${weeklyRes.error}`);
        }
      } else {
        if (isNaN(day) || day < 1 || day > 31) {
          await sendMessage(sender, `❌ 1-31 ke darmiyan koi date bhejein.\n\n00: Back`);
          return;
        }
        const monthlyRes = await createRecurringBooking({
          salon_id: ctx.salonId,
          barber_id: ctx.barberId,
          customer_phone: getCleanPhone(sender),
          customer_name: pushName || '',
          service_id: ctx.serviceId,
          appointment_time: ctx.selectedSlot.start,
          end_time: ctx.selectedSlot.end,
          frequency: 'monthly',
          day_of_month: day
        });
        if (monthlyRes.success) {
          const dateLabel = day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`;
          await sendMessage(sender, `✅ *Recurring Booking Set!* 🎉\n\n🔁 Har month ki *${dateLabel}* tarikh ko booking auto-create hogi.\n🧾 Receipt har baar WhatsApp par aayega.\n\n💡 *RECURRING* se dekhein ya *RECURRING CANCEL <id>* se cancel karein.`);
        } else {
          await sendMessage(sender, `❌ Recurring set nahi ho saka: ${monthlyRes.error}`);
        }
      }
      await saveBotState(sender, { step: 'IDLE' });
      return;
    }

    // =========== GALLERY STATE ===========

    if (state.step === 'GALLERY') {
      const ctx = state.context;
      const idx = parseInt(userInput) - 1;
      if (userInput === '00' || userInput.toUpperCase() === 'BACK') {
        await showSalonMenu(sendMessage, sender, { id: ctx.salonId, name: ctx.salonName } as any);
        await saveBotState(sender, { step: 'SHOW_SALON_MENU', context: { countryId: ctx.countryId, cityId: ctx.cityId, areaId: ctx.areaId, salonId: ctx.salonId, salonName: ctx.salonName } });
        return;
      }
      if (!isNaN(idx) && idx >= 0 && idx < ctx.media.length) {
        const item = ctx.media[idx];
        if (item.media_url) {
          let imageUrl = item.media_url;
          if (imageUrl.startsWith('/')) {
            imageUrl = BASE_URL + imageUrl;
          }
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(imageUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const buffer = Buffer.from(await response.arrayBuffer());
            const ext = imageUrl.split('.').pop() || 'jpg';
            const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' };
            const mimetype = mimeMap[ext.toLowerCase()] || 'image/jpeg';
            if (sendDocument) {
              await sendDocument(sender, buffer, `gallery-${item.id}.${ext}`, item.title || 'Salon Image');
            } else {
              await sendMessage(sender, `🖼️ ${item.title || 'Salon Image'}\n${imageUrl}`);
            }
          } catch {
            await sendMessage(sender, `❌ Image load nahi ho saki. Baad mein try karein.`);
          }
        } else {
          await sendMessage(sender, `❌ Is image ka URL nahi hai.`);
        }
        return;
      }
      await sendMessage(sender, `❌ Invalid choice. 1-${ctx.media.length} select karein ya 00: Wapas.`);
      return;
    }

    // =========== RESCHEDULE STATE MACHINE ===========

    if (state.step === 'RESCHEDULE_DATE') {
      const ctx = state.context;
      const idx = parseInt(userInput) - 1;
      if (isNaN(idx) || idx < 0 || idx >= ctx.dates.length) {
        await sendMessage(sender, `❌ Invalid choice. Select 1-${ctx.dates.length} ya 00 cancel.\n\nWapas shuru kar rahe hain.`);
        await saveBotState(sender, { step: 'IDLE' });
        return;
      }
      const selectedDate = ctx.dates[idx];
      const slots = await getAvailableSlots(ctx.barberId, selectedDate);
      if (slots.length === 0) {
        await sendMessage(sender, `❌ Is din koi slots available nahi hain. Koi aur date select karein.\n\n00: Back`);
        return;
      }
      const dateDisplay = new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
      await sendMessage(sender, `📅 *${dateDisplay}* ke liye slots:\n\n${formatSlots(slots)}\n\n00: Back\n${M}`);
      await saveBotState(sender, {
        step: 'RESCHEDULE_SLOT',
        context: { ...ctx, selectedDate, slots }
      });
      return;
    }

    if (state.step === 'RESCHEDULE_SLOT') {
      const ctx = state.context;
      const slots = ctx.slots || [];
      const idx = parseInt(userInput) - 1;
      if (isNaN(idx) || idx < 0 || idx >= slots.length) {
        await sendMessage(sender, `❌ Invalid choice. Please select 1-${slots.length}.\n\n00: Back`);
        return;
      }
      const slot = slots[idx];
      const dateDisplay = new Date(ctx.selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const msg = `🔄 *Confirm Reschedule*\n\nToken: *${ctx.token}*\n📅 ${dateDisplay}\n⏰ ${slot.start} - ${slot.end}\n\n1️⃣ Confirm\n0️⃣ Back`;
      await sendMessage(sender, msg);
      await saveBotState(sender, {
        step: 'RESCHEDULE_CONFIRM',
        context: { ...ctx, selectedSlot: slot }
      });
      return;
    }

    if (state.step === 'RESCHEDULE_CONFIRM') {
      const ctx = state.context;
      if (userInput === '1') {
        const updated = await updateAppointmentByToken(ctx.token, {
          appointment_date: ctx.selectedDate,
          appointment_time: ctx.selectedSlot.start,
          end_time: ctx.selectedSlot.end
        });
        if (updated) {
          const dateDisplay = new Date(ctx.selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          await sendMessage(sender, `✅ *Booking Rescheduled!* 🎉\n\n🔄 Token: *${ctx.token}*\n📅 ${dateDisplay}\n⏰ ${ctx.selectedSlot.start} - ${ctx.selectedSlot.end}\n\nKisi bhi message se nayi booking karein.`);
        } else {
          await sendMessage(sender, `❌ Reschedule fail ho gaya. Token check karein ya dobara try karein.`);
        }
      } else {
        await sendMessage(sender, `Reschedule cancelled.`);
      }
      await saveBotState(sender, { step: 'IDLE' });
      return;
    }

// --- Handle SELECT_DATE state (fallback for any edge cases) ---
    if (state.step === 'SELECT_DATE') {
      await sendMessage(sender, `📅 *Select Date*\n\nPlease select a date from the options below:\n\n1. Today\n2. Tomorrow\n3. Other dates\n\n00: Back`);
      return;
    }

    // Fallback for unrecognized state
    await sendMessage(sender, `❌ Something went wrong. Koi bhi message bhejein dobara shuru karne ke liye.`);
    await saveBotState(sender, { step: 'IDLE' });
     return;

   } catch (err: any) {
    console.error('[Bot Error]', err);
    try {
      await sendMessage(sender, `❌ Technical error aa gaya hai. Kripya dobara try karein ya MENU type karke wapas jayein.`);
    } catch (_) { /* ignore */ }
  } finally {
    release();
  }
}


