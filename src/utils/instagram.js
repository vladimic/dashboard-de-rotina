// Saved Instagram posts (Backlog tab): the three queues that count, reading
// the exported file and turning the daily imports into chart/table series.
// Posts in any other collection are not part of the backlog and are ignored.
import { dateKeySaoPaulo } from './format';

export const QUEUES = [
  { id: 'none', label: 'Sem coleção', color: '#e08a5a' },
  { id: 'inbox', label: 'Inbox', color: '#5a9bd5' },
  { id: 'backlog', label: 'Post backlog', color: '#8f86e0' },
];

const DAY_MS = 86400000;
const dayMs = (key) => new Date(`${key}T12:00:00Z`).getTime();

// Accents, case and spacing don't matter: "INBOX", "Posts backlog",
// "sem coleção" and an empty name all land on a queue (or on null = ignored).
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();

export function queueOf(collection) {
  const c = norm(collection);
  if (c === '' || c === 'sem colecao') return 'none';
  if (c === 'inbox') return 'inbox';
  if (c === 'posts backlog' || c === 'post backlog') return 'backlog';
  return null;
}

// Minimal CSV reader (comma or semicolon, quoted fields) for the same four columns.
function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map(norm);
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const pick = (o, names) => {
  for (const [k, v] of Object.entries(o)) if (names.includes(norm(k)) && v != null) return v;
  return '';
};

// The file: a JSON array (or { posts: [...] }) — or a CSV — with link, autor,
// data (date of the post) and colecao. The import day is the date in the file
// name (instagram-salvos-2026-11-02.json) or today.
export function parseSavedFile(text, fileName, now = new Date()) {
  const today = dateKeySaoPaulo(now);
  let raw;
  try {
    const json = JSON.parse(text.replace(/^﻿/, ''));
    raw = Array.isArray(json) ? json : json?.posts || json?.itens || json?.items;
  } catch {
    raw = parseCsv(text.replace(/^﻿/, ''));
  }
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Não encontrei a lista de posts no arquivo (esperava link, autor, data e colecao).' };

  const seen = new Set();
  const rows = [];
  const counts = { none: 0, inbox: 0, backlog: 0 };
  let ignored = 0;
  let duplicates = 0;
  let withoutLink = 0;
  for (const o of raw) {
    const link = String(pick(o, ['link', 'url', 'href'])).trim();
    if (!link) {
      withoutLink++;
      continue;
    }
    if (seen.has(link)) {
      duplicates++;
      continue;
    }
    seen.add(link);
    const category = queueOf(pick(o, ['colecao', 'collection', 'pasta']));
    if (!category) {
      ignored++;
      continue;
    }
    counts[category]++;
    const date = String(pick(o, ['data', 'date', 'data do post'])).slice(0, 10);
    rows.push({ link, autor: String(pick(o, ['autor', 'author', 'usuario'])).trim(), post_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, category });
  }
  if (rows.length + ignored === 0) return { error: 'Nenhum post com link no arquivo.' };

  const fromName = String(fileName || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const day = fromName && fromName <= today ? fromName : today;
  return { rows, counts, total: rows.length + ignored, ignored, duplicates, withoutLink, day };
}

// ---- series ---------------------------------------------------------------

// `imports`: [{ day, counts: { none, inbox, backlog }, importedAt }] by day.
// Days without an import repeat the previous one, so the chart is a staircase:
// one point per import in the period (plus the value in force when the period
// starts, and a flat last point at today).
export function buildSavedSeries(imports, today, periodDays) {
  const sorted = [...imports].sort((a, b) => a.day.localeCompare(b.day));
  const start = dateKeySaoPaulo(new Date(dayMs(today) - (periodDays - 1) * DAY_MS));
  const stagesOf = (i) => Object.fromEntries(QUEUES.map((q) => [q.id, { n: i.counts[q.id] ?? 0 }]));
  const points = [];
  const before = [...sorted].reverse().find((i) => i.day < start);
  const inside = sorted.filter((i) => i.day >= start && i.day <= today);
  if (before && !(inside[0] && inside[0].day === start)) points.push({ day: start, from: before.day, t: dayMs(start), stages: stagesOf(before) });
  inside.forEach((i) => points.push({ day: i.day, from: i.day, t: dayMs(i.day), stages: stagesOf(i) }));
  const last = points.at(-1);
  if (last && last.day < today) points.push({ day: today, from: last.from, t: dayMs(today), stages: last.stages });

  // Table rows: latest import, change over 7 days, the period's line.
  const latest = sorted.filter((i) => i.day <= today).at(-1) || null;
  const weekAgo = dateKeySaoPaulo(new Date(dayMs(today) - 7 * DAY_MS));
  const past = [...sorted].reverse().find((i) => i.day <= weekAgo);
  const rows = QUEUES.map((q) => ({
    ...q,
    today: latest ? latest.counts[q.id] ?? 0 : 0,
    delta7: latest && past ? (latest.counts[q.id] ?? 0) - (past.counts[q.id] ?? 0) : null,
    series: points.map((p) => p.stages[q.id].n),
  }));
  return { rows, points, latest };
}

// Whole days since the latest import (null when there is none).
export function daysSince(day, today) {
  return day ? Math.round((dayMs(today) - dayMs(day)) / DAY_MS) : null;
}

// After this many days without an import the Backlog tab asks for a new one.
export const STALE_AFTER_DAYS = 3;

// The latest import up to today and the one before it (null when missing).
export function latestAndPrevious(imports, today) {
  const sorted = [...imports].filter((i) => i.day <= today).sort((a, b) => a.day.localeCompare(b.day));
  return { latest: sorted.at(-1) || null, previous: sorted.at(-2) || null };
}

export const totalOf = (counts) => QUEUES.reduce((t, q) => t + (counts?.[q.id] ?? 0), 0);
