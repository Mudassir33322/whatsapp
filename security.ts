import { z } from 'zod';

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const emailSchema = z.string().email('Invalid email format');
export const phoneSchema = z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits only');
export const urlSchema = z.string().url().optional().or(z.literal(''));
export const nameSchema = z.string().min(2).max(100);
export const priceSchema = z.number().min(0, 'Price cannot be negative');
export const ratingSchema = z.number().min(1).max(5);

export function validatePassword(password: string): string | null {
  const result = passwordSchema.safeParse(password);
  if (!result.success) return result.error.issues[0].message;
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').replace(/^0+/, '');
}

// Comprehensive XSS sanitization - strips all HTML tags, event handlers, and dangerous protocols
export function sanitizeString(input: string, maxLength: number = 500): string {
  if (!input) return '';
  let clean = input
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol (except safe images)
    .replace(/data:(?!image\/(png|jpeg|gif|webp))/gi, '')
    // Remove vbscript: protocol
    .replace(/vbscript:/gi, '')
    // Remove event handler attributes (already stripped with tags, but double-check)
    .replace(/on\w+\s*=/gi, '')
    // Remove common XSS vectors
    .replace(/&#x?[\da-f]+;?/gi, '')
    .replace(/\\u[\da-f]{4}/gi, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, maxLength);
}

// Parse and validate integer ID params
export function parseId(value: string): number | null {
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0 || !Number.isInteger(id)) return null;
  return id;
}
