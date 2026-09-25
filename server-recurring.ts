import { query, getDueRecurringBookings, updateRecurringNextDate, beginTransaction, commit, rollback } from './db';
import { generateToken } from './utils';

function calcNextWeeklyDate(dayOfWeek: number | null | undefined): string {
  const now = new Date();
  const currentDay = now.getDay();
  const targetDay = dayOfWeek ?? (currentDay + 1) % 7;
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().split('T')[0];
}

function calcNextMonthlyDate(dayOfMonth: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (now.getDate() >= dayOfMonth) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function processRecurringBookings() {
  try {
    const dueBookings = await getDueRecurringBookings();
    for (const booking of dueBookings) {
      const appointmentDate = booking.next_date || new Date().toISOString().split('T')[0];
      const token = generateToken();

      let done = false;
      let attempts = 0;
      const maxAttempts = 3;
      while (!done && attempts < maxAttempts) {
        attempts++;
        try {
          await beginTransaction();
          if (process.env.USE_SQLITE === 'true') {
            await query(
              `INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, token, status, created_at, recurring_booking_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', datetime('now'), ?)`,
              [booking.salon_id, booking.barber_id, booking.customer_phone, booking.customer_name, booking.service_id, appointmentDate, booking.appointment_time, booking.end_time, token, booking.id]
            );
          } else {
            await query(
              `INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, token, status, created_at, recurring_booking_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', NOW(), ?)`,
              [booking.salon_id, booking.barber_id, booking.customer_phone, booking.customer_name, booking.service_id, appointmentDate, booking.appointment_time, booking.end_time, token, booking.id]
            );
          }

          let nextDate: string | null = null;
          if (booking.frequency === 'weekly' && booking.day_of_week != null) {
            nextDate = calcNextWeeklyDate(booking.day_of_week);
          } else if (booking.frequency === 'monthly' && booking.day_of_month != null) {
            nextDate = calcNextMonthlyDate(booking.day_of_month);
          }

          await updateRecurringNextDate(booking.id, nextDate, appointmentDate);
          await commit();
          done = true;
          console.log(`[Recurring] Created appointment for recurring booking #${booking.id}`);
        } catch (err: any) {
          await rollback().catch(() => {});
          console.error(`[Recurring] Failed to process booking #${booking.id} (attempt ${attempts}/${maxAttempts}):`, err.message);
        }
      }

      if (!done) {
        console.error(`[Recurring] Giving up on booking #${booking.id} after ${maxAttempts} failed attempts — will be retried on next scheduler run`);
      }
    }
  } catch (err: any) {
    console.error('[Recurring] Scheduler error:', err.message);
  }
}

export function startRecurringScheduler() {
  console.log('[Recurring] Scheduler started');
  processRecurringBookings();
  setInterval(processRecurringBookings, 60 * 60 * 1000);
}
