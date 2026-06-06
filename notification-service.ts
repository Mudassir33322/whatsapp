import { query } from './db';

let waSocket: any = null;

export function setWASocket(sock: any) {
  waSocket = sock;
}

export function getWASocket() {
  return waSocket;
}

async function sendWhatsApp(to: string, text: string) {
  if (!waSocket) {
    console.warn('[Notifications] WhatsApp socket not available');
    return;
  }
  try {
    await waSocket.sendMessage(to, { text });
  } catch (e: any) {
    console.error('[Notifications] Send failed:', e.message);
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
  if (!waSocket) {
    console.warn('[Notifications] WhatsApp not initialized, skipping salon booking alert');
    return;
  }
  try {
    const salon: any[] = await query('SELECT phone, name FROM salons WHERE id = ?', [booking.salon_id]);
    const salonPhone = salon[0]?.phone;
    if (!salonPhone) return;
    const to = salonPhone.includes('@') ? salonPhone : `${salonPhone}@s.whatsapp.net`;
    const msg = `🏪 *New Booking Alert* 🎉\n\nSalon: ${booking.salon_name}\nCustomer: ${booking.customer_name}\n📞 ${booking.customer_phone}\n✂️ Service: ${booking.service_name}\n📅 ${formatDate(booking.appointment_date)}\n⏰ ${formatTime(booking.appointment_time)}\n🔖 Token: *${booking.token}*`;
    await sendWhatsApp(to, msg);
  } catch (e: any) {
    console.error('[Notifications] Failed to send salon booking alert:', e.message);
  }
}

// ─── Visit Alert to Salon Owner ──────────────────────────────────
export async function sendVisitAlert(data: {
  salon_id: number;
  salon_name: string;
  customer_name: string;
  customer_phone: string;
  barber_name?: string;
}) {
  if (!waSocket) return;
  try {
    const salon: any[] = await query('SELECT phone FROM salons WHERE id = ?', [data.salon_id]);
    const salonPhone = salon[0]?.phone;
    if (!salonPhone) return;
    
    // Check if already alerted in last 1 hour to avoid spamming
    const already: any = await query(
      `SELECT id FROM sent_notifications 
       WHERE customer_phone = ? AND type = 'visit_alert' 
       AND appointment_id = ? 
       AND sent_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [data.customer_phone, data.salon_id]
    );
    if (already.length > 0) return;

    const to = salonPhone.includes('@') ? salonPhone : `${salonPhone}@s.whatsapp.net`;
    const msg = `📢 *New Visitor Alert!* 👤\n\nEk potential customer aapka profile dekh raha hai.\n\n👤 *Customer*: ${data.customer_name}\n📱 *Number*: ${data.customer_phone}\n📍 *Status*: Viewing ${data.barber_name ? `Barber "${data.barber_name}"` : 'Salon'} Profile.\n\n💡 *Aap chahen toh in se direct baat kar sakte hain.*`;
    
    await sendWhatsApp(to, msg);
    await markSent(data.salon_id, 'visit_alert', data.customer_phone);
  } catch (e: any) {
    console.error('[Notifications] Failed to send visit alert:', e.message);
  }
}


// ─── Booking Confirmation ─────────────────────────────────────────
export async function sendBookingConfirmation(apt: any) {
  if (!waSocket) {
    console.warn('[Notifications] WhatsApp not initialized, skipping booking confirmation');
    return;
  }
  const phone = apt.customer_phone.includes('@') ? apt.customer_phone : `${apt.customer_phone}@s.whatsapp.net`;
  const msg = `✅ *Booking Confirmed!* 🎉
🏪 ${apt.salon_name || 'Salon'}
💇 Barber: ${apt.barber_name}
✂️ Service: ${apt.service_name}
📅 ${formatDate(apt.appointment_date)}
⏰ ${formatTime(apt.appointment_time)}
🔖 Token: *${apt.token}*
Aapko salon par ye token dena hoga.`;
  await sendWhatsApp(phone, msg);
}

// ─── 30-Min Reminder ──────────────────────────────────────────────
export async function sendReminder(apt: any) {
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
  const phone = apt.customer_phone.includes('@') ? apt.customer_phone : `${apt.customer_phone}@s.whatsapp.net`;
  if (await alreadySent(apt.id, 'review_request')) return;

  const prefs: any = await query('SELECT review_request FROM notification_preferences WHERE salon_id = ?', [apt.salon_id]);
  if (prefs.length > 0 && !prefs[0].review_request) return;

  const msg = `⭐ *Apna Experience Share Karein!*\n\nAapne ${apt.barber_name} se ${apt.salon_name} mein service li thi. Kaisi lagi? Humare liye 1 se 5 stars dein:\n\n1️⃣ ⭐\n2️⃣ ⭐⭐\n3️⃣ ⭐⭐⭐\n4️⃣ ⭐⭐⭐⭐\n5️⃣ ⭐⭐⭐⭐⭐\n\nApna rating is message ka reply karein. Shukriya! 🙏`;
  await sendWhatsApp(phone, msg);
  await markSent(apt.id, 'review_request', apt.customer_phone);
}

// ─── Points Earned ────────────────────────────────────────────────
export async function sendPointsEarned(phone: string, points: number, total: number) {
  const contact = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  const msg = `🎉 *Points Earned!*\n\nAapne ${points} loyalty points earn kiye hain!\nTotal points: ${total}\n\nZyada points earn karke silver, gold ya platinum tier mein jayein! 💎`;
  await sendWhatsApp(contact, msg);
}

// ─── Re-Engagement ────────────────────────────────────────────────
export async function sendReEngagement(customer: any) {
  const phone = customer.phone.includes('@') ? customer.phone : `${customer.phone}@s.whatsapp.net`;
  const msg = `💈 *Miss You!*\n\nAap ko ${customer.salon_name} ne yaad kiya! Kaafi din ho gaye aaye hue. Abhi appointment book karein aur naye offers ka faida uthayein! 🎉\n\nBook karne ke liye koi bhi message bhejein.`;
  await sendWhatsApp(phone, msg);
}

// ─── Periodic Checks ──────────────────────────────────────────────
export function startNotificationScheduler() {
  // Check every 60 seconds for 30-min reminders
  setInterval(async () => {
    try {
      const now = new Date();
      const targetTime = new Date(now.getTime() + 30 * 60 * 1000);
      const targetHour = targetTime.getHours();
      const targetMin = targetTime.getMinutes();
      const targetStr = `${String(targetHour).padStart(2, '0')}:${String(targetMin).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];

      // Find appointments starting in ~30 minutes that haven't been reminded
      const appts: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name
         FROM appointments a
         JOIN barbers b ON a.barber_id = b.id
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
          WHERE a.appointment_date = ? AND a.appointment_time BETWEEN ? AND DATE_ADD(?, INTERVAL 1 MINUTE) AND a.status = 'confirmed'`,
        [today, targetStr, targetStr]
      );

      for (const apt of appts) {
        await sendReminder(apt);
      }
    } catch (e: any) {
      console.error('[Notifications] Reminder check error:', e.message);
    }
  }, 60000);

  // Check every 5 minutes for queue updates
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
  }, 300000);

  // Check once daily for re-engagement (customers not visited in 30 days)
  setInterval(async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

      const customers: any = await query(
        `SELECT c.phone, MAX(a.appointment_date) as last_visit, sl.name as salon_name, sl.id as salon_id
         FROM customers c
         JOIN appointments a ON c.phone = a.customer_phone
         JOIN salons sl ON a.salon_id = sl.id
         GROUP BY c.phone, sl.id
         HAVING MAX(a.appointment_date) < ? AND MAX(a.appointment_date) >= DATE_SUB(?, INTERVAL 60 DAY)`,
        [thirtyDaysAgo, thirtyDaysAgo]
      );

      for (const customer of customers) {
        // Check not already sent in last 30 days
        const sent: any = await query(
          `SELECT id FROM sent_notifications WHERE customer_phone = ? AND type = 're_engagement' AND sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [customer.phone]
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
      `SELECT p.*, s.name as salon_name, s.owner_phone, s.phone as salon_phone, s.id as salon_id
       FROM products p
       JOIN salons s ON p.salon_id = s.id
       WHERE p.stock <= p.min_stock AND p.stock > 0 AND p.is_active = TRUE`
    );
    for (const product of products) {
      const targetPhone = product.owner_phone || product.salon_phone;
      if (!targetPhone) continue;
      // Check if already alerted in last 24 hours
      const already: any = await query(
        `SELECT id FROM sent_notifications WHERE appointment_id = ? AND type = 'low_stock' AND customer_phone = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [product.id, targetPhone]
      );
      if (already.length > 0) continue;
      const contact = targetPhone.includes('@') ? targetPhone : `${targetPhone}@s.whatsapp.net`;
      const msg = `📦 *Low Stock Alert!*\n\n🏪 ${product.salon_name}\n📛 Product: *${product.name}*\n📊 Remaining: ${product.stock} ${product.unit}\n⚠️ Min Stock: ${product.min_stock} ${product.unit}\n\nPlease reorder soon!`;
      await sendWhatsApp(contact, msg);
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
