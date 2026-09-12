import { z } from "zod";

/**
 * Validation primitives shared across forms.
 *
 * Mirrors `backend/app/schemas/validators.py`. The two are duplicated
 * deliberately — the API contract is the coordination point, not a shared type
 * package (root CLAUDE.md, monorepo split rules) — so a rule changed here needs
 * the same change there.
 */

const PHONE_STRIP = /[\s\-()]/g;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Strip formatting and any +91 / 91 / 0 prefix from a typed phone number.
 *
 * The backend normalizes the same way and stores the bare ten digits, so the
 * value that comes back may not be the one that was typed.
 */
export function normalizePhone(value: string): string {
  let digits = value.replace(PHONE_STRIP, "");
  if (digits.startsWith("+91")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("91") && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  return digits;
}

export const PHONE_MESSAGE = "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.";

/** A required Indian mobile number. Transforms to the canonical ten digits. */
export const phoneSchema = z
  .string()
  .min(1, "Required")
  .transform(normalizePhone)
  .refine((v) => INDIAN_MOBILE.test(v), PHONE_MESSAGE);

/** The same rule where the field may be left blank. */
export const optionalPhoneSchema = z
  .string()
  .optional()
  .transform((v) => (v ? normalizePhone(v) : ""))
  .refine((v) => v === "" || INDIAN_MOBILE.test(v), PHONE_MESSAGE);

export const USERNAME_MESSAGE =
  "3-30 characters: lowercase letters, digits, dot, underscore or hyphen.";

/** The login credential. Lowercased on the way in, as the backend stores it. */
export const usernameSchema = z
  .string()
  .min(1, "Required")
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => /^[a-z0-9._-]{3,30}$/.test(v), USERNAME_MESSAGE);
