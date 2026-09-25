// Resolves a possibly-relative media path (e.g. "/uploads/xyz.jpg") into an
// absolute URL so images load correctly on public/WhatsApp-shared pages that
// may live on a different origin than the API server.
const API_BASE = (import.meta as any).env?.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith('//')) return (API_BASE ? 'https:' : '') + path;
  const base = API_BASE.replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : '/' + path);
}
