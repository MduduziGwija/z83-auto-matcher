import type { ExpEntry } from './types';

/** Month number: year * 12 + (month - 1). */
export const monthIdx = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** [start, end) in months. A job that is still current runs up to today, not to the end of this month. */
function span(e: ExpEntry, now: Date): [number, number] {
  if (e.present) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const end = monthIdx(now) + now.getDate() / daysInMonth;
    return [e.startIdx, Math.max(end, e.startIdx)];
  }
  return [e.startIdx, e.endIdx + 1]; // the month a job ended in counts as worked
}

/** Months covered by the spans, counting overlapping jobs only once. */
function unionMonths(spans: [number, number][]): number {
  const s = [...spans].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = 0;
  let curEnd = -Infinity;
  for (const [a, b] of s) {
    if (a > curEnd) {
      if (curEnd > -Infinity) total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else curEnd = Math.max(curEnd, b);
  }
  if (curEnd > -Infinity) total += curEnd - curStart;
  return total;
}

export interface ExpTotals {
  publicMonths: number;
  privateMonths: number;
  totalMonths: number;
}

/** Totals from the jobs that are ticked. Each sector counts overlapping jobs once. */
export function experienceTotals(entries: ExpEntry[], now = new Date()): ExpTotals {
  const inc = entries.filter((e) => e.include);
  const of = (list: ExpEntry[]) => unionMonths(list.map((e) => span(e, now)));
  return {
    publicMonths: of(inc.filter((e) => e.sector === 'public')),
    privateMonths: of(inc.filter((e) => e.sector === 'private')),
    totalMonths: of(inc),
  };
}

export function entryMonths(e: ExpEntry, now = new Date()): number {
  const [a, b] = span(e, now);
  return b - a;
}

/** 23.5 -> "1 yr 11 mths". Whole months only: a part month is not rounded up. */
export function formatMonths(months: number): string {
  const whole = Math.floor(months + 1e-9);
  if (whole <= 0) return '0';
  const y = Math.floor(whole / 12);
  const m = whole % 12;
  return [y ? `${y} yr${y === 1 ? '' : 's'}` : '', m ? `${m} mth${m === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
}

export const toYears = (months: number): number => Math.round((months / 12) * 10) / 10;
