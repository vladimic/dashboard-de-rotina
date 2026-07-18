// Vercel serverless function. Reads today's + tomorrow's events from one or
// more published iCloud calendar (.ics) feeds and maps them into the shape
// the Agenda card already expects. Feed URLs are bearer-style secrets
// (anyone with the link can read that calendar) so they stay server-side only.

import ical from 'node-ical';
import { getDayBoundsMs } from './_lib/dateRange.js';

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;

// Each configured calendar keeps one fixed color (not hash-rotated) so a
// given calendar always reads the same way at a glance. CALENDAR_ICS_URL is
// always pastel green; additional calendars (CALENDAR_ICS_URL_2, _3, ...)
// take the next color in this list, in order.
const COLOR_SEQUENCE = [
  { bg: '#e0f0e4', border: '#4caf70', text: '#245c37', textFaint: '#4c8f63' }, // green
  { bg: '#f3ecf5', border: '#a897ad', text: '#5b4a63', textFaint: '#a897ad' }, // lavender
  { bg: '#fdeecb', border: '#d9a441', text: '#8a5a2f', textFaint: '#bda968' }, // amber
  { bg: '#f3e3ee', border: '#b568a8', text: '#6b3f63', textFaint: '#a888a0' }, // pink
  { bg: '#dbeaf7', border: '#6fa3d1', text: '#3f5c78', textFaint: '#7f9ab5' }, // blue
];

function getConfiguredCalendars() {
  const calendars = [];
  if (process.env.CALENDAR_ICS_URL) {
    calendars.push({ url: process.env.CALENDAR_ICS_URL, color: COLOR_SEQUENCE[0] });
  }
  for (let i = 2; i <= COLOR_SEQUENCE.length; i++) {
    const url = process.env[`CALENDAR_ICS_URL_${i}`];
    if (url) calendars.push({ url, color: COLOR_SEQUENCE[i - 1] });
  }
  return calendars;
}

function textOf(val) {
  if (val == null) return '';
  return typeof val === 'string' ? val : val.val || '';
}

function toHourFloat(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const min = Number(parts.find((p) => p.type === 'minute').value);
  return h + min / 60;
}

function makeEntry(summary, start, end, idKey, color, meta = {}) {
  const startHour = Math.max(DAY_START_HOUR, toHourFloat(start));
  const endHour = Math.min(DAY_END_HOUR, toHourFloat(end));
  return {
    id: `${idKey}-${start.toISOString()}`,
    start: startHour,
    end: Math.max(endHour, startHour + 0.25),
    label: textOf(summary) || '(sem título)',
    location: textOf(meta.location),
    description: textOf(meta.description),
    url: textOf(meta.url),
    ...color,
  };
}

function eventsInRange(data, rangeStartMs, rangeEndMs, color) {
  const rangeStart = new Date(rangeStartMs);
  const rangeEnd = new Date(rangeEndMs);
  const out = [];

  for (const key of Object.keys(data)) {
    const ev = data[key];
    if (ev.type !== 'VEVENT') continue;
    if (!ev.start) continue;
    if (ev.datetype === 'date') continue; // all-day events don't fit the hour ruler

    if (ev.rrule) {
      const instances = ical.expandRecurringEvent(ev, { from: rangeStart, to: rangeEnd });
      for (const inst of instances) {
        if (inst.isFullDay) continue;
        const instEnd = inst.end || new Date(inst.start.getTime() + 60 * 60 * 1000);
        if (instEnd.getTime() <= rangeStartMs || inst.start.getTime() >= rangeEndMs) continue;
        out.push(
          makeEntry(inst.summary, inst.start, instEnd, ev.uid || key, color, {
            location: inst.location || ev.location,
            description: inst.description || ev.description,
            url: inst.url || ev.url,
          })
        );
      }
    } else {
      // Some feeds encode duration via DURATION instead of DTEND — don't drop
      // the event just because .end wasn't populated.
      const end = ev.end || new Date(ev.start.getTime() + 60 * 60 * 1000);
      if (ev.start.getTime() < rangeEndMs && end.getTime() > rangeStartMs) {
        out.push(
          makeEntry(ev.summary, ev.start, end, ev.uid || key, color, {
            location: ev.location,
            description: ev.description,
            url: ev.url,
          })
        );
      }
    }
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const calendars = getConfiguredCalendars();
  if (calendars.length === 0) {
    res.status(500).json({ error: 'CALENDAR_ICS_URL not configured on the server.' });
    return;
  }

  try {
    const today = getDayBoundsMs(0, TIMEZONE);
    const tomorrow = getDayBoundsMs(1, TIMEZONE);

    let agenda = [];
    let agendaTomorrow = [];

    for (const cal of calendars) {
      const url = cal.url.replace(/^webcal:\/\//, 'https://');
      const data = await ical.async.fromURL(url);
      agenda = agenda.concat(eventsInRange(data, today.startOfDay, today.endOfDay, cal.color));
      agendaTomorrow = agendaTomorrow.concat(eventsInRange(data, tomorrow.startOfDay, tomorrow.endOfDay, cal.color));
    }

    agenda.sort((a, b) => a.start - b.start);
    agendaTomorrow.sort((a, b) => a.start - b.start);

    res.status(200).json({ updatedAt: new Date().toISOString(), agenda, agendaTomorrow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching calendar events.' });
  }
}
