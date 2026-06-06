import { query, getDueRecurringBookings, updateRecurringNextDate } from './db';

function calcNextWeeklyDate(dayOfWeek: number): string {
  const now = new Date();
  const currentDay = now.getDay();
  let diff = dayOfWeek - currentDay;
  if (diff <= 0) diff += 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().split('T')[0];
}

function calcNextMonthlyDate(dayOfMonth: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() >= dayOfMonth) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function processRecurringBookings() {
  try {
    const dueBookings = await getDueRecurringBookings();
    for (const booking of dueBookings) {
      const now = new Date();
      const appointmentDate = now.toISOString().split('T')[0];
      const appointmentDateTime = `${appointmentDate} ${booking.appointment_time}`;

      try {
        await query(
          `INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_time, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'confirmed', NOW())`,
          [booking.salon_id, booking.barber_id, booking.customer_phone, booking.customer_name, booking.service_id, appointmentDateTime]
        );

        let nextDate: string | null = null;
        if (booking.frequency === 'weekly' && booking.day_of_week != null) {
          nextDate = calcNextWeeklyDate(booking.day_of_week);
        } else if (booking.frequency === 'monthly' && booking.day_of_month != null) {
          nextDate = calcNextMonthlyDate(booking.day_of_month);
        }

        await updateRecurringNextDate(booking.id, nextDate, appointmentDate);
        console.log(`[Recurring] Created appointment for recurring booking #${booking.id}`);
      } catch (err: any) {
        console.error(`[Recurring] Failed to process booking #${booking.id}:`, err.message);
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
