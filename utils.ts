export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '#';
  for (let i = 0; i < 5; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}
