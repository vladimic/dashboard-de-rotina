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

// The three trend windows shown next to the weight, in the Saúde header
// and on the weight chart.
export const TREND_DAYS = [7, 30, 90];

export const TREND_UI = {
  up: { symbol: '↗', label: 'subindo' },
  down: { symbol: '↘', label: 'descendo' },
  stable: { symbol: '→', label: 'estável' },
};

export function weightTrends(points, now = Date.now()) {
  return TREND_DAYS.map((days) => ({ days, trend: weightTrend(points, days, now) }));
}

export const formatKg = (v) => v.toFixed(1).replace('.', ',');

const SIX_HOURS_MS = 6 * 3600000;

// Night a sleep segment belongs to, named after the day you woke up: shifted
// 6h forward, so anything from 18:00 on counts toward the next morning.
function nightKey(t) {
  return dateKeySaoPaulo(new Date(t + SIX_HOURS_MS));
}

const ASLEEP_STAGES = ['deep', 'core', 'rem', 'asleep'];

// Sleep segments → one summary per night: minutes per stage, total asleep,
// and when you fell asleep / woke up. When several sources logged the same
// night (Watch + iPhone, or another sleep app), only one is used — the one
// with the most stage detail — so the night isn't counted twice.
export function sleepNights(samples) {
  const byNight = new Map();
  for (const s of samples) {
    if (!s.end) continue;
    const key = nightKey(s.t);
    if (!byNight.has(key)) byNight.set(key, new Map());
    const bySource = byNight.get(key);
    if (!bySource.has(s.source)) bySource.set(s.source, []);
    bySource.get(s.source).push(s);
  }

  const nights = new Map();
  for (const [key, bySource] of byNight) {
    const score = (segs) => {
      const staged = segs.filter((x) => ['deep', 'core', 'rem'].includes(x.unit)).reduce((a, x) => a + x.value, 0);
      const asleep = segs.filter((x) => x.unit === 'asleep').reduce((a, x) => a + x.value, 0);
      return staged * 10 + asleep;
    };
    const segs = [...bySource.values()].sort((a, b) => score(b) - score(a))[0];
    const stages = { deep: 0, core: 0, rem: 0, asleep: 0, awake: 0 };
    let bedtime = Infinity;
    let wake = -Infinity;
    for (const x of segs) {
      if (x.unit in stages) stages[x.unit] += x.value;
      if (ASLEEP_STAGES.includes(x.unit)) {
        bedtime = Math.min(bedtime, x.t);
        wake = Math.max(wake, x.end);
      }
    }
    const asleepMin = ASLEEP_STAGES.reduce((a, k) => a + stages[k], 0);
    if (asleepMin > 0) nights.set(key, { key, stages, asleepMin, bedtime, wake });
  }
  return nights;
}

// "7h12" from minutes.
export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 60 ? `${h + 1}h00` : `${h}h${String(m).padStart(2, '0')}`;
}

const HOME_TIMEZONE = 'America/Sao_Paulo';

// Hours since midnight (e.g. 23.5), São Paulo time.
export function hourFloatSP(t) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: HOME_TIMEZONE, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t));
  return Number(parts.find((p) => p.type === 'hour').value) + Number(parts.find((p) => p.type === 'minute').value) / 60;
}

// "23:41", São Paulo time.
export function formatClockSP(t) {
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: HOME_TIMEZONE });
}

// Below this many minutes/week (either way) sleep counts as "estável".
export const SLEEP_STABLE_MIN_PER_WEEK = 10;

// Least-squares slope of minutes asleep over the last `days` nights, in
// minutes/week, plus that window's average. null with fewer than two nights.
export function sleepTrend(nights, days, now = new Date()) {
  const keys = lastNDateKeys(days, now);
  const pts = keys
    .map((k, i) => ({ x: i, y: nights.get(k)?.asleepMin }))
    .filter((p) => p.y != null);
  if (pts.length < 2) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  const minPerWeek = den ? (num / den) * 7 : 0;
  const direction = Math.abs(minPerWeek) < SLEEP_STABLE_MIN_PER_WEEK ? 'stable' : minPerWeek > 0 ? 'up' : 'down';
  return { minPerWeek, direction, avg: my };
}
