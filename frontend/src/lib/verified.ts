/**
 * Verified-project mock ("Tasdiqlangan" status).
 *
 * NOTE: The backend does not expose a verified flag yet. A deterministic hash
 * marks a sparse subset of catalog ids as reviewed by an architect/builder so
 * the badge, filter and tooltip are fully functional. Replace with a real
 * `is_verified` field on the Project model when available.
 */
export function isProjectVerified(id: number): boolean {
  return id % 7 === 3 || id % 11 === 5;
}

export const VERIFIED_TOOLTIP =
  'Ushbu loyiha arxitektor yoki tajribali quruvchi tomonidan ko’rib chiqilib tasdiqlangan. Rahmatli rejalar va o’lchamlar bo’yicha ishonchli deb belgilangan.';
