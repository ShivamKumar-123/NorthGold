/** Display helpers. `en-US` throughout, so grouping and currency match the
 *  rest of the platform. */

export function money(value: number | string | null | undefined, currency = 'USD'): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function num(value: number | string | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(value: number | string | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(
    'en-US',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

/** "in 12 days" / "3 months ago" — for schedules the reader is scanning, not
 *  auditing. Exact dates sit next to these wherever precision matters. */
export function relative(value: string | null | undefined): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const days = Math.round((then - Date.now()) / 86400_000);
  if (days === 0) return 'today';
  const abs = Math.abs(days);
  const unit = abs < 31 ? `${abs} day${abs === 1 ? '' : 's'}` : `${Math.round(abs / 30)} month${Math.round(abs / 30) === 1 ? '' : 's'}`;
  return days > 0 ? `in ${unit}` : `${unit} ago`;
}

/** Full name, falling back to the email. Derived on read rather than stored
 *  alongside `first_name`/`last_name`, which would be a third copy of the
 *  same fact and free to drift away from the other two. */
export function displayName(user: { first_name?: string; last_name?: string; email: string }): string {
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email;
}
