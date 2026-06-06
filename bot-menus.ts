import { 
  getSalonsByLocation, 
  getBarbersBySalon, 
  getOffersBySalon, 
  getSalonReviews,
  getCitiesByCountry,
  getAreasByCity,
  getServicesBySalon
} from './db';
import { escapeMarkdown } from './utils';

const M = 'AutoZap Bot';

export async function showWelcomeMenu(sendMessage: any, sender: string) {
  const msg = `👋 *Welcome to AutoZap!* ✂️\n\nYour personal barber booking assistant.\n\n1. 💇‍♂️ *Book Appointment*\n2. 📍 *Nearby Salons*\n3. 🔖 *My Bookings*\n4. 🎁 *Offers & Discounts*\n5. 📞 *Contact Support*\n\nReply with a number to choose.`;
  await sendMessage(sender, msg);
}

export async function showMainMenu(sendMessage: any, sender: string, name?: string) {
  const msg = `👋 *Welcome ${escapeMarkdown(name || 'Customer')}!*\n\n📌 *Main Menu*\n\n` +
    `1. 📅 Book Appointment\n` +
    `2. 👤 My Profile\n` +
    `3. 📋 My Bookings\n` +
    `4. 📜 History\n` +
    `5. 🎉 Offers\n` +
    `6. ❓ Help\n\n` +
    `🔍 Ya phir apna appointment *token* bhejein (e.g., #A7K2)\n\n` +
    `0: Refresh Menu`;
  await sendMessage(sender, msg);
}

export async function showCountries(sendMessage: any, sender: string, countries: any[]) {
  let msg = `🌍 *Select Country:*\n\n`;
  countries.forEach((c: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(c.name)}\n`;
  });
  msg += `\n${M}`;
  await sendMessage(sender, msg);
}

export async function showCities(sendMessage: any, sender: string, countryId: number) {
  const cities = await getCitiesByCountry(countryId);
  let msg = `🏙️ *Select City:*\n\n`;
  cities.forEach((c: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(c.name)}\n`;
  });
  msg += `\n00: Back\n${M}`;
  await sendMessage(sender, msg);
}

export async function showAreas(sendMessage: any, sender: string, cityId: number) {
  const areas = await getAreasByCity(cityId);
  let msg = `📍 *Select Area:*\n\n`;
  areas.forEach((a: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(a.name)}\n`;
  });
  msg += `\n00: Back\n${M}`;
  await sendMessage(sender, msg);
}

export async function showSalons(sendMessage: any, sender: string, salons: any[]) {
  if (salons.length === 0) {
    await sendMessage(sender, `❌ Is area mein koi salon nahi mila. Koi aur area select karein.\n\n00: Back\n${M}`);
    return;
  }
  let msg = `🏪 *Select Salon:*\n\n`;
  salons.forEach((s: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(s.name)}${s.rating ? ` ⭐${s.rating}` : ''}\n`;
  });
  msg += `\n00: Back\n${M}`;
  await sendMessage(sender, msg);
}

export async function showSalonMenu(sendMessage: any, sender: string, salon: any) {
  const msg = `🏪 *${escapeMarkdown(salon.name)}*\n\n1. Book appointment\n2. View offers 🎉\n3. Reviews ⭐\n4. Info ℹ️\n\n00: Back\n${M}`;
  await sendMessage(sender, msg);
}

export async function showServices(sendMessage: any, sender: string, salonId: number) {
  const services = await getServicesBySalon(salonId);
  let msg = `✂️ *Select Service:*\n\n`;
  services.forEach((s: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(s.name)} — Rs. ${s.price} (${s.duration} min)\n`;
  });
  msg += `\n00: Back\n${M}`;
  await sendMessage(sender, msg);
}

export async function showBarbers(sendMessage: any, sender: string, barbers: any[]) {
  let msg = `💇 *Select Barber:*\n\n`;
  barbers.forEach((b: any, i: number) => {
    msg += `${i + 1}. ${escapeMarkdown(b.name)} ⭐${b.rating} (${b.experience} yrs)\n`;
  });
  msg += `\n00: Back\n${M}`;
  await sendMessage(sender, msg);
}
