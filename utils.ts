import crypto from 'crypto';

function secureRandomInt(max: number): number {
  const byte = crypto.randomBytes(1)[0];
  const threshold = 256 - (256 % max);
  let val = byte;
  while (val >= threshold) {
    val = crypto.randomBytes(1)[0];
  }
  return val % max;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace('@s.whatsapp.net', '');
  cleaned = cleaned.replace(/[^\d]/g, '');
  while (cleaned.length > 0 && cleaned[0] === '0') {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '#';
  for (let i = 0; i < 8; i++) token += chars[secureRandomInt(chars.length)];
  return token;
}

// Retry until a unique token is generated
export async function generateUniqueToken(checkExists: (token: string) => Promise<boolean>, maxRetries: number = 10): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const token = generateToken();
    if (!(await checkExists(token))) return token;
  }
  // Last resort: keep within VARCHAR(10) limit
  const base = generateToken();
  return base.length <= 10 ? base : base.slice(0, 10);
}
