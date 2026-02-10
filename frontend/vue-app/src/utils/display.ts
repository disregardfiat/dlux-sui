/**
 * Safe display helpers for graceful handling of missing data.
 */

/** Safe string for display; returns fallback if value is null/undefined/empty */
export function safeStr(value: string | null | undefined, fallback = '—'): string {
  if (value == null || value === '') return fallback
  return String(value)
}

/** Safe number for display; returns fallback if value is null/undefined/NaN */
export function safeNum(value: number | null | undefined, fallback = 0): number {
  if (value == null || Number.isNaN(value)) return fallback
  return value
}

/** Safe array for iteration; returns empty array if value is null/undefined */
export function safeArr<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}
