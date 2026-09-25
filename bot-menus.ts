import { 
  getSalonsByLocation, 
  getBarbersBySalon, 
  getOffersBySalon, 
  getSalonReviews,
  getCitiesByCountry,
  getAreasByCity,
  getServicesBySalon,
  getAllCountries
} from './db';
import { escapeMarkdown } from './utils';
import { BOT_CONFIG } from './bot-config';

export const M = 'AutoZap Bot - Powered by SalonLink';

export async function showWelcomeMenu(sendMessage: any, sender: string) {
   const msg = `👋 *AutoZap Mein Khush Aamdeed!* ✂️\n\n` +
     `Apna pasandeeda salon choose karein aur appointment book karein.\n\n` +
     `1. 💇‍♂️ *Nayi Booking Karein*\n` +
     `2. 📍 *Qareebi Salons*\n` +
     `3. 🔖 *Meri Bookings*\n` +
     `4. 🎁 *Offers & Discounts*\n` +
     `5. 📞 *Madad (Help)*\n\n` +
     `👉 Koi bhi number reply karein.\n${M}`;
   try {
     await sendMessage(sender, msg);
   } catch (e: any) {
     console.error('[Bot-Menus] Failed to show welcome menu:', e?.message);
   }
 }

export async function showMainMenu(sendMessage: any, sender: string, name?: string) {
   const msg = `👋 *${escapeMarkdown(name || 'Customer')}!* 🎉\n\n📌 *Main Menu*\n\n` +
     `1. 📅 *Nayi Booking* - Appointment book karein\n` +
     `2. 👤 *Mera Profile* - Apna profile dekhein\n` +
     `3. 📋 *Meri Bookings* - Active bookings dekhein\n` +
     `4. 📜 *History* - Purani bookings dekhein\n` +
     `5. 🎉 *Offers* - Ongoing offers dekhein\n` +
     `6. ❓ *Madad* - Help & support\n\n` +
     `🔍 Ya phir apna appointment *token* bhejein (e.g., #A7K2)\n\n` +
     `0: Menu Refresh karein\n${M}`;
   try {
     await sendMessage(sender, msg);
   } catch (e: any) {
     console.error('[Bot-Menus] Failed to show main menu:', e?.message);
   }
 }

export async function showCountries(sendMessage: any, sender: string) {
   let countries: any[];
   try { countries = await getAllCountries(); } catch { countries = []; }
   if (countries.length === 0) {
     try {
       await sendMessage(sender, `❌ Koi country available nahi hai.\n\n00: Wapas\n${M}`);
     } catch (e: any) { console.error('[Bot-Menus] Failed to show countries error:', e?.message); }
     return;
   }
   let msg = `🌍 *Mulk (Country) Chunein:*\n\n`;
   countries.forEach((c: any, i: number) => {
     msg += `${i + 1}. ${escapeMarkdown(c.name)}\n`;
   });
   msg += `\n00: Wapas\n${M}`;
   try {
     await sendMessage(sender, msg);
   } catch (e: any) {
     console.error('[Bot-Menus] Failed to show countries:', e?.message);
   }
 }

export async function showCities(sendMessage: any, sender: string, countryId: number) {
   let cities: any[];
   try { cities = await getCitiesByCountry(countryId); } catch { cities = []; }
   if (cities.length === 0) {
     try {
       await sendMessage(sender, `❌ Is mulk mein koi city nahi hai.\n\n00: Wapas\n${M}`);
     } catch (e: any) { console.error('[Bot-Menus] Failed to show cities error:', e?.message); }
     return;
   }
   let msg = `🏙️ *Sheher (City) Chunein:*\n\n`;
   cities.forEach((c: any, i: number) => {
     msg += `${i + 1}. ${escapeMarkdown(c.name)}\n`;
   });
   msg += `\n00: Wapas\n${M}`;
   try {
     await sendMessage(sender, msg);
   } catch (e: any) {
     console.error('[Bot-Menus] Failed to show cities:', e?.message);
   }
 }

export async function showAreas(sendMessage: any, sender: string, cityId: number) {
   let areas: any[];
   try { areas = await getAreasByCity(cityId); } catch { areas = []; }
   if (areas.length === 0) {
     try {
       await sendMessage(sender, `❌ Is sheher mein koi area nahi hai.\n\n00: Wapas\n${M}`);
     } catch (e: any) { console.error('[Bot-Menus] Failed to show areas error:', e?.message); }
     return;
   }
   let msg = `📍 *Ilaqa (Area) Chunein:*\n\n`;
   areas.forEach((a: any, i: number) => {
     msg += `${i + 1}. ${escapeMarkdown(a.name)}\n`;
   });
   msg += `\n00: Wapas\n${M}`;
   try {
     await sendMessage(sender, msg);
   } catch (e: any) {
     console.error('[Bot-Menus] Failed to show areas:', e?.message);
   }
 }

export async function showSalons(sendMessage: any, sender: string, salons: any[]) {
   if (salons.length === 0) {
     try {
       await sendMessage(sender, `❌ Is ilaqe mein koi salon nahi mila. Koi aur ilaqa chunein.\n\n00: Wapas\n${M}`);
     } catch (e: any) { console.error('[Bot-Menus] Failed to show salons error:', e?.message); }
     return;
   }
   let msg = `🏪 *Salon Chunein:*\n\n`;
   salons.forEach((s: any, i: number) => {
     msg += `${i + 1}. ${escapeMarkdown(s.name)}${s.rating ? ` ⭐${s.rating}` : ''}\n`;
   });
   msg += `\n00: Wapas\n${M}`;
   try {
     await sendMessage(sender, msg);
   } catch (e: any) {
     console.error('[Bot-Menus] Failed to show salons:', e?.message);
   }
 }

export async function showSalonMenu(sendMessage: any, sender: string, salon: any) {
  const msg = `🏪 *${escapeMarkdown(salon.name)}*\n\n` +
    `1. Kitab (Book appointment) 📅\n` +
    `2. Offers dekhein 🎉\n` +
    `3. Reviews dekhein ⭐\n` +
    `4. Malumaat (Info) ℹ️\n` +
    `5. Gallery dekhein 🖼️\n\n` +
    `00: Wapas\n${M}`;
  try {
    await sendMessage(sender, msg);
  } catch (e: any) {
    console.error('[Bot-Menus] Failed to show salon menu:', e?.message);
  }
}

export async function showServices(sendMessage: any, sender: string, salonId: number) {
  let services: any[];
  try { services = await getServicesBySalon(salonId); } catch (e: any) { console.error('[Bot-Menus] Failed to get services:', e?.message); services = []; }
  if (services.length === 0) {
    try { await sendMessage(sender, `❌ Is salon mein koi service available nahi hai.\n\n00: Wapas\n${M}`); } catch (e: any) { console.error('[Bot-Menus] Failed to send services message:', e?.message); }
    return;
  }
  let msg = `✂️ *Service Chunein:*\n\n`;
  services.forEach((s: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(s.name)} — ${BOT_CONFIG.currency} ${s.price} (${s.duration} min)\n`;
  });
  msg += `\n00: Wapas\n${M}`;
  try { await sendMessage(sender, msg); } catch (e: any) { console.error('[Bot-Menus] Failed to send services:', e?.message); }
}

export async function showBarbers(sendMessage: any, sender: string, barbers: any[]) {
  if (barbers.length === 0) {
    try { await sendMessage(sender, `❌ Is salon mein koi barber available nahi hai.\n\n00: Wapas\n${M}`); } catch (e: any) { console.error('[Bot-Menus] Failed to send barbers error:', e?.message); }
    return;
  }
  let msg = `💇 *Hajjam (Barber) Chunein:*\n\n`;
  barbers.forEach((b: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(b.name)} ⭐${b.rating} (${b.experience} saal)\n`;
  });
  msg += `\n00: Wapas\n${M}`;
  try { await sendMessage(sender, msg); } catch (e: any) { console.error('[Bot-Menus] Failed to send barbers:', e?.message); }
}
