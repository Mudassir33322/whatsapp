import { z } from 'zod';

export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');
export const emailSchema = z.string().email('Invalid email');
export const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export function validatePhone(value: unknown) {
  const result = phoneSchema.safeParse(value);
  if (result.success) return null;
  const e = result.error as z.ZodError;
  return e.issues[0]?.message || 'Invalid phone number';
}

export function validateEmail(value: unknown) {
  const result = emailSchema.safeParse(value);
  if (result.success) return null;
  const e = result.error as z.ZodError;
  return e.issues[0]?.message || 'Invalid email';
}

export function validatePassword(value: unknown) {
  const result = passwordSchema.safeParse(value);
  if (result.success) return null;
  const e = result.error as z.ZodError;
  return e.issues[0]?.message || 'Password must be at least 6 characters';
}