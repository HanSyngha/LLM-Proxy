/**
 * Format Date as YYYY-MM-DD using local timezone (TZ=Asia/Seoul in Docker).
 * Unlike toISOString() which always uses UTC, this respects the server's timezone.
 *
 * With TZ=Asia/Seoul:
 *   toISOString() at 2026-02-10 01:00 KST → "2026-02-09" (WRONG)
 *   toDateString() at 2026-02-10 01:00 KST → "2026-02-10" (CORRECT)
 */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date string in local timezone (YYYY-MM-DD).
 */
export function todayString(): string {
  return toDateString(new Date());
}

/**
 * Format Date as YYYY-MM-DDTHH in local timezone (for hourly rate-limit keys).
 */
export function toHourString(d: Date): string {
  return `${toDateString(d)}T${String(d.getHours()).padStart(2, '0')}`;
}

/**
 * Format Date as YYYY-MM-DDTHH:mm in local timezone (for per-minute rate-limit keys).
 */
export function toMinuteString(d: Date): string {
  return `${toHourString(d)}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Format Date as YYYY-MM-DDTHH:mm:ss in local timezone (ISO-like but KST).
 * Use this instead of toISOString() when the time portion matters for display.
 */
export function toDateTimeString(d: Date): string {
  return `${toDateString(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
