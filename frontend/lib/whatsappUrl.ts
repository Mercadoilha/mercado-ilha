/**
 * Builds a wa.me URL from a stored WhatsApp number.
 *
 * Rules:
 *  - If the stored value starts with "+" → the user explicitly set an
 *    international number (e.g. "+54 11 9999-9999"). Use the digits as-is.
 *  - Otherwise → assume Brazil. Add "55" if the digits don't already
 *    start with "55".
 *
 * This handles all three common cases:
 *   "71 99999-9999"        → 5571999999999  (Brazil, no prefix)
 *   "+55 71 99999-9999"    → 5571999999999  (Brazil, explicit +55)
 *   "+54 11 9999-9999"     → 541199999999   (Argentina, respected as-is)
 */
export function buildWaNumber(whatsapp: string): string {
  const trimmed = whatsapp.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    // Explicit international format — trust the country code as-is
    return digits;
  }

  // No "+" → assume Brazil
  if (!digits.startsWith("55")) {
    return "55" + digits;
  }

  return digits;
}

export function buildWaUrl(whatsapp: string, message: string): string {
  const number = buildWaNumber(whatsapp);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

