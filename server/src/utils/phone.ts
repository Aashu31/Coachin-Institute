import { AppError } from './errors.js';

/**
 * Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts 10 digits, a leading 0 trunk prefix, 91 / 0091 prefixes, and the
 * spaces/dashes parents and front-desk staff naturally type.
 */
export function normalizeIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  let local = digits;

  if (local.startsWith('0091')) {
    local = local.slice(4);
  } else if (local.startsWith('91') && local.length === 12) {
    local = local.slice(2);
  } else if (local.startsWith('0') && local.length === 11) {
    local = local.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new AppError(
      422,
      'INVALID_PHONE_NUMBER',
      'Enter a valid 10-digit Indian mobile number (for example 9835112401).',
    );
  }

  return `+91${local}`;
}

/** Builds a wa.me link. Used for the public thank-you CTA and staff dialers. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');

  let international = digits;

  if (digits.length === 10) {
    international = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    international = `91${digits.slice(1)}`;
  } else if (digits.startsWith('0091')) {
    international = digits.slice(4);
  }

  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

/** tel: link helper for click-to-call buttons. */
export function buildTelUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `tel:+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `tel:+91${digits.slice(1)}`;
  }

  return `tel:+${digits}`;
}
