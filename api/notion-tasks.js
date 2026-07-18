// Vercel serverless function. Runs server-side only — the Notion integration
// token never reaches the browser. Pulls tasks due today or overdue from a
// single Notion tasks database, sorted by due date, with a deep link back to
// each task's page in Notion.

import { getDayBoundsMs } from './_lib/dateRange.js';

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';
const NOTION_VERSION = '2022-06-28';
const TITLE_PROPERTY = 'Atividades';
const DUE_PROPERTY = 'Prazo';
const STATUS_PROPERTY = 'Status';
const EXCLUDED_STATUSES = ['concluido', 'cancelado'];

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim();
}

// Works for either a Notion "status" or "select" property type — whichever
// one the database actually uses for STATUS_PROPERTY.
function statusName(page) {
  const prop = page.properties?.[STATUS_PROPERTY];
  return prop?.status?.name || prop?.select?.name || null;
}

// Every Notion database has exactly one property of type "title" — that's
// the actual page title, regardless of what it's labeled. Prefer the
// property named TITLE_PROPERTY, but fall back to whichever one is really
// type "title" in case the configured name doesn't match (e.g. renamed).
function taskTitle(page) {
  const properties = page.properties || {};
  let prop = properties[TITLE_PROPERTY];
  if (!prop?.title?.length && !prop?.rich_text?.length) {
    prop = Object.values(properties).find((p) => p?.type === 'title') || prop;
  }
  const arr = prop?.title || prop?.rich_text || [];
  return arr.map((t) => t.plain_text).join('') || '(sem título)';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  if (!token || !databaseId) {
    res.status(500).json({ error: 'NOTION_TOKEN / NOTION_TASKS_DATABASE_ID not configured on the server.' });
    return;
  }

  try {
    const { endOfDay } = getDayBoundsMs(0, TIMEZONE);
    const endOfDayIso = new Date(endOfDay).toISOString();

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: DUE_PROPERTY, date: { on_or_before: endOfDayIso } },
        sorts: [{ property: DUE_PROPERTY, direction: 'ascending' }],
        page_size: 100,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion query failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const openPages = (data.results || []).filter((page) => !EXCLUDED_STATUSES.includes(normalize(statusName(page))));
    const tasks = openPages.map((page) => ({
      id: page.id,
      label: taskTitle(page),
      link: `https://www.notion.so/${page.id.replace(/-/g, '')}`,
    }));

    res.status(200).json({ updatedAt: new Date().toISOString(), tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching Notion tasks.' });
  }
}
