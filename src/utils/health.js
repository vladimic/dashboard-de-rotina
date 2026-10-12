import { dateKeySaoPaulo, lastNDateKeys } from './format';

const DAY_MS = 86400000;

// A change smaller than this (either way) over a window counts as "estável".
export const WEIGHT_STABLE_KG = 0.2;

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

// Change over the last `days` days: latest weigh-in minus the first one
// inside the window — the same "início → atual" the chart shows for that
// period. null when the window has fewer than two weigh-ins.
export function weightTrend(points, days, now = Date.now()) {
  const win = points.filter((p) => p.t > now - days * DAY_MS);
  if (win.length < 2) return null;
  const start = win[0].value;
  const diff = win.at(-1).value - start;
  const direction = Math.abs(diff) < WEIGHT_STABLE_KG ? 'stable' : diff > 0 ? 'up' : 'down';
  return { start, diff, direction };
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
export const TREND_DAYS = [7, 30, 90, 365];

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

// When segments overlap (Watch + iPhone, or another sleep app, logging the
// same stretch), each minute counts once, as the highest-priority stage
// covering it: staged sleep first, then "acordado" (a Watch saying you were
// awake beats an iPhone guessing you were asleep), then plain "dormindo".
// "Na cama" never counts.
const STAGE_PRIORITY = { deep: 4, rem: 4, core: 4, awake: 3, asleep: 2 };

// Sleep segments → one summary per night: minutes per stage, total asleep,
// and when you fell asleep / woke up. Built on a timeline rather than by
// source (the Shortcut can't always tell sources apart), so overlapping
// segments never make a night count twice.
export function sleepNights(samples) {
  const byNight = new Map();
  for (const s of samples) {
    if (!s.end || !(s.unit in STAGE_PRIORITY)) continue;
    const key = nightKey(s.t);
    if (!byNight.has(key)) byNight.set(key, []);
    byNight.get(key).push(s);
  }

  const nights = new Map();
  for (const [key, segs] of byNight) {
    const cuts = [...new Set(segs.flatMap((x) => [x.t, x.end]))].sort((a, b) => a - b);
    const stages = { deep: 0, core: 0, rem: 0, asleep: 0, awake: 0 };
    let bedtime = Infinity;
    let wake = -Infinity;
    for (let i = 0; i < cuts.length - 1; i++) {
      const from = cuts[i];
      const to = cuts[i + 1];
      let best = null;
      for (const x of segs) {
        if (x.t <= from && x.end >= to && (!best || STAGE_PRIORITY[x.unit] > STAGE_PRIORITY[best])) best = x.unit;
      }
      if (!best) continue;
      stages[best] += (to - from) / 60000;
      if (ASLEEP_STAGES.includes(best)) {
        bedtime = Math.min(bedtime, from);
        wake = Math.max(wake, to);
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

// A rolling average that moved less than this many minutes since
// yesterday counts as "estável" — for both sleep duration and bedtime.
export const SLEEP_STABLE_MIN = 1;

// Bedtime as hours past midnight, with evenings negative (22:30 → -1.5), so
// a night is one continuous range and averages don't wrap around 0h.
export function bedtimeHour(t) {
  const h = hourFloatSP(t);
  return h >= 12 ? h - 24 : h;
}

// Rolling average of `minutesOf(night)` over the `days` nights ending today
// (today + the days-1 before it), compared with the same-size window ending
// yesterday: the arrow says whether today's average went up or down vs.
// yesterday's. Nights with no data are left out of an average. null when
// either window has no nights at all.
function nightTrend(nights, days, minutesOf, now) {
  const avgOf = (keys) => {
    const vals = keys.map((k) => nights.get(k)).filter(Boolean).map(minutesOf);
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
  };
  const avg = avgOf(lastNDateKeys(days, now));
  const prevAvg = avgOf(lastNDateKeys(days, new Date(now.getTime() - 86400000)));
  if (avg == null || prevAvg == null) return null;
  const diff = avg - prevAvg;
  const direction = Math.abs(diff) < SLEEP_STABLE_MIN ? 'stable' : diff > 0 ? 'up' : 'down';
  return { avg, prevAvg, diff, direction };
}

// Minutes asleep: "up" = sleeping more. avg in minutes.
export function sleepTrend(nights, days, now = new Date()) {
  return nightTrend(nights, days, (n) => n.asleepMin, now);
}

// Bedtime: "up" = going to bed later. avg in minutes past midnight
// (negative = before midnight).
export function bedtimeTrend(nights, days, now = new Date()) {
  return nightTrend(nights, days, (n) => bedtimeHour(n.bedtime) * 60, now);
}

// Sleep quality 0–100, modeled on the Health app's Sleep Score (which no
// app can read — HealthKit doesn't expose it). Apple's three pillars and
// weights, with curves fitted to a real night (7h07 asleep, bedtime 1h48
// later than average, 8 min awake → 46 + 10 + 19 = 75), so it's an
// estimate, not the same number:
//   • Duração (50 pts): asleep time vs. ~7h45 — that or more gets all 50.
//   • Hora de dormir (30 pts): how far bedtime is from the average of the
//     previous 13 nights; on the average = 30, ~2h42 off = 0. Fewer than 3
//     previous nights → neutral 15.
//   • Interrupções (20 pts): minutes awake during the night, 1 pt lost per
//     8 min (160 min awake = 0).
const DURATION_FULL_MIN = 465;
const BEDTIME_ZERO_MIN = 162;
const AWAKE_MIN_PER_POINT = 8;

export function sleepQuality(night, nights) {
  const duration = Math.min(night.asleepMin / DURATION_FULL_MIN, 1) * 50;

  const prior = nights
    ? [...nights.values()]
        .filter((n) => n.key < night.key)
        .sort((a, b) => b.key.localeCompare(a.key))
        .slice(0, 13)
    : [];
  let bedtime = 15;
  let bedtimeDiffMin = null;
  if (prior.length >= 3) {
    const avg = prior.reduce((a, n) => a + bedtimeHour(n.bedtime) * 60, 0) / prior.length;
    bedtimeDiffMin = bedtimeHour(night.bedtime) * 60 - avg;
    bedtime = Math.max(0, 1 - Math.abs(bedtimeDiffMin) / BEDTIME_ZERO_MIN) * 30;
  }

  const interruptions = Math.max(0, 20 - night.stages.awake / AWAKE_MIN_PER_POINT);
  const score = Math.round(duration + bedtime + interruptions);
  return {
    score,
    bedtimeDiffMin,
    parts: { duration: Math.round(duration), bedtime: Math.round(bedtime), interruptions: Math.round(interruptions) },
  };
}

// Apple's bands (Very Low 0–40, Low 41–60, OK 61–80, High 81–95, Very High 96+).
export function qualityLabel(score) {
  if (score >= 96) return 'Excelente';
  if (score >= 81) return 'Alta';
  if (score >= 61) return 'Regular';
  if (score >= 41) return 'Baixa';
  return 'Muito baixa';
}

// Same rolling-average comparison as sleepTrend, on the quality score.
// "up" = better nights. avg in points.
export function qualityTrend(nights, days, now = new Date()) {
  return nightTrend(nights, days, (n) => sleepQuality(n, nights).score, now);
}
