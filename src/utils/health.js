import { dateKeySaoPaulo, lastNDateKeys } from './format';

const DAY_MS = 86400000;

// Below this many kg/week (either way) the weight counts as "estável".
export const WEIGHT_STABLE_KG_PER_WEEK = 0.1;

// One point per day (São Paulo calendar day) — the average of that day's
// weigh-ins — plotted at noon, so a day with two scale readings doesn't
// pull the moving averages twice as hard as a day with one.
export function dailyWeights(samples) {
  const byDay = new Map();
  for (const s of samples) {
    const key = dateKeySaoPaulo(new Date(s.t));
    const day = byDay.get(key) || { sum: 0, n: 0 };
    day.sum += s.value;
    day.n += 1;
    byDay.set(key, day);
  }
  return [...byDay.entries()]
    .map(([key, { sum, n }]) => ({ key, t: new Date(`${key}T12:00:00-03:00`).getTime(), value: sum / n }))
    .sort((a, b) => a.t - b.t);
}

// Trailing average over the last `days` calendar days (by time, not by
// count — gaps without weigh-ins just mean fewer points in the window).
export function movingAverage(points, days) {
  const windowMs = days * DAY_MS;
  let start = 0;
  let sum = 0;
  return points.map((p, i) => {
    sum += p.value;
    while (points[start].t <= p.t - windowMs) {
      sum -= points[start].value;
      start++;
    }
    return { t: p.t, value: sum / (i - start + 1) };
  });
}

// Least-squares slope of the last `days` days, in kg/week. null when there
// aren't at least two weigh-ins in the window to draw a line through.
export function weightTrend(points, days, now = Date.now()) {
  const win = points.filter((p) => p.t > now - days * DAY_MS);
  if (win.length < 2) return null;
  const mx = win.reduce((a, p) => a + p.t, 0) / win.length;
  const my = win.reduce((a, p) => a + p.value, 0) / win.length;
  let num = 0;
  let den = 0;
  for (const p of win) {
    num += (p.t - mx) * (p.value - my);
    den += (p.t - mx) ** 2;
  }
  if (den === 0) return null;
  const kgPerWeek = (num / den) * 7 * DAY_MS;
  const direction = Math.abs(kgPerWeek) < WEIGHT_STABLE_KG_PER_WEEK ? 'stable' : kgPerWeek > 0 ? 'up' : 'down';
  return { kgPerWeek, direction };
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// The fixed 30-day axis shared by the sleep, sleep-quality and IAH charts:
// each day labeled day number / weekday / month (month only on the first
// column and on the 1st of a month, where the chart also draws a divider).
export function thirtyDayAxis(now = new Date()) {
  return lastNDateKeys(30, now).map((key, i) => {
    const d = new Date(`${key}T12:00:00Z`);
    const day = d.getUTCDate();
    const monthStart = i > 0 && day === 1;
    return {
      key,
      weekday: d.getUTCDay(),
      monthStart,
      label: [String(day).padStart(2, '0'), WEEKDAYS[d.getUTCDay()], i === 0 || monthStart ? MONTHS[d.getUTCMonth()] : ''],
    };
  });
}

// Standard CPAP apnea-hypopnea index bands.
export function iahBand(value) {
  if (value < 5) return 'normal';
  if (value < 15) return 'leve';
  if (value < 30) return 'moderado';
  return 'grave';
}
