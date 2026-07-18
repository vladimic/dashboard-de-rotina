// Vercel serverless function. Runs server-side only — the Notion integration
// token never reaches the browser. Pulls tasks due today or overdue from a
// single Notion tasks database, grouped by project.

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';
const NO_PROJECT_LABEL = 'Sem Projeto';
const NOTION_VERSION = '2022-06-28';
const TITLE_PROPERTY = 'Atividades';
const DUE_PROPERTY = 'Prazo';
const STATUS_PROPERTY = 'Status';
const PROJECT_PROPERTY = '[A] Projetos';
// Prefixes, not full words — matches "concluído"/"concluída"/"concluídos"
// and "cancelado"/"cancelada"/etc. regardless of grammatical gender/plural.
const EXCLUDED_STATUS_PREFIXES = ['conclu', 'cancel'];

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim();
}

function isExcludedStatus(status) {
  const n = normalize(status);
  return EXCLUDED_STATUS_PREFIXES.some((prefix) => n.startsWith(prefix));
}

// Looks up a property by exact name first, then falls back to a
// bracket/whitespace/accent-insensitive match, then to any property whose
// name simply contains `hint` — in case the configured property name
// doesn't match the database's actual property name character-for-character.
function findProperty(properties, exactName, hint) {
  if (properties[exactName]) return properties[exactName];
  const target = normalize(exactName).replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
  for (const [key, value] of Object.entries(properties)) {
    const normalizedKey = normalize(key).replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
    if (normalizedKey === target) return value;
  }
  for (const [key, value] of Object.entries(properties)) {
    if (normalize(key).includes(hint)) return value;
  }
  return null;
}

// Works for either a Notion "status" or "select" property type — whichever
// one the database actually uses for STATUS_PROPERTY.
function statusName(page) {
  const prop = findProperty(page.properties || {}, STATUS_PROPERTY, 'status');
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

// Reads the plain-text value of a Notion property regardless of its type.
// "relation" properties only carry related page ids, not their titles —
// those are resolved separately via relationTitles.
function propertyText(prop, relationTitles) {
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
      return (prop.title || []).map((t) => t.plain_text).join('');
    case 'rich_text':
      return (prop.rich_text || []).map((t) => t.plain_text).join('');
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return (prop.multi_select || []).map((s) => s.name).join(', ');
    case 'relation':
      return (prop.relation || [])
        .map((r) => relationTitles.get(r.id))
        .filter(Boolean)
        .join(', ');
    case 'formula':
      return propertyText(
        { type: prop.formula?.type, [prop.formula?.type]: prop.formula?.[prop.formula?.type] },
        relationTitles
      );
    case 'rollup':
      if (prop.rollup?.type === 'array') {
        return prop.rollup.array.map((item) => propertyText(item, relationTitles)).filter(Boolean).join(', ');
      }
      if (prop.rollup?.type === 'number') return prop.rollup.number != null ? String(prop.rollup.number) : '';
      if (prop.rollup?.type === 'date') return prop.rollup.date?.start || '';
      return '';
    default:
      return '';
  }
}

function findProjectProperty(properties) {
  return findProperty(properties, PROJECT_PROPERTY, 'projeto');
}

// Walks a property (including nested inside a rollup array) collecting every
// related page id so their titles can be fetched in one batch up front.
function collectRelationIds(prop, ids) {
  if (!prop) return;
  if (prop.type === 'relation') {
    for (const r of prop.relation || []) ids.add(r.id);
  } else if (prop.type === 'rollup' && prop.rollup?.type === 'array') {
    for (const item of prop.rollup.array) collectRelationIds(item, ids);
  }
}

async function fetchPage(pageId, token) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
  });
  if (!res.ok) return null;
  return res.json();
}

function pageTitle(page) {
  const titleProp = Object.values(page.properties || {}).find((p) => p?.type === 'title');
  const arr = titleProp?.title || [];
  return arr.map((t) => t.plain_text).join('') || null;
}

// The "query a database" endpoint doesn't reliably return relation property
// values inline (a documented Notion API quirk — confirmed here: a task
// visibly had its project set in the Notion UI but the query response still
// came back with an empty relation array). The "retrieve a page property
// item" endpoint is the reliable source of truth for relation values, so
// every task's project relation is re-fetched through it directly.
async function fetchRelationIds(pageId, propertyId, token) {
  const ids = [];
  let cursor;
  do {
    const url = new URL(`https://api.notion.com/v1/pages/${pageId}/properties/${propertyId}`);
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
    });
    if (!res.ok) return ids;
    const data = await res.json();
    for (const item of data.results || []) {
      if (item.relation?.id) ids.push(item.relation.id);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return ids;
}

async function hydratedProjectProperty(page, token) {
  const prop = findProjectProperty(page.properties || {});
  if (!prop) return null;
  if (prop.type !== 'relation') return prop;
  const ids = await fetchRelationIds(page.id, prop.id, token);
  return { type: 'relation', relation: ids.map((id) => ({ id })) };
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
    // A plain "YYYY-MM-DD" string (not a full ISO instant) makes Notion
    // compare calendar dates directly. "Prazo" is a date-only property (no
    // time-of-day), and Notion anchors date-only values at UTC midnight —
    // comparing that against an instant like "23:59 America/Sao_Paulo"
    // (= 02:59 UTC the *next* day) let tomorrow's date-only tasks slip in as
    // "on or before today", which is exactly the stale-looking bug reported.
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: DUE_PROPERTY, date: { on_or_before: todayStr } },
        sorts: [{ property: DUE_PROPERTY, direction: 'ascending' }],
        page_size: 100,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion query failed (${response.status}): ${text}`);
    }

    const data = await response.json();

    const openPages = (data.results || []).filter((page) => !isExcludedStatus(statusName(page)));

    // ?debug=1[&title=<substring>] — makes the actual "retrieve page property
    // item" call for a chosen task (first task by default, or the first task
    // whose title contains &title=) and reports back its raw HTTP status/body
    // verbatim, instead of guessing.
    if (req.query?.debug) {
      const titleFilter = (req.query.title || '').toLowerCase();
      const targetPage = titleFilter
        ? openPages.find((p) => taskTitle(p).toLowerCase().includes(titleFilter))
        : openPages[0];
      if (!targetPage) {
        res.status(200).json({ debug: `no matching open page found (title filter: "${titleFilter}")` });
        return;
      }
      const prop = findProjectProperty(targetPage.properties || {});
      let rawFetch = null;
      if (prop?.type === 'relation') {
        const url = `https://api.notion.com/v1/pages/${targetPage.id}/properties/${prop.id}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION } });
        const bodyText = await r.text();
        rawFetch = { url, status: r.status, ok: r.ok, body: bodyText.slice(0, 2000) };
      }

      // Both the query endpoint AND the dedicated "retrieve page property
      // item" endpoint agreeing on "empty" (previous debug round) is only
      // possible if the property itself is configured in a way that makes it
      // genuinely empty from the API's perspective — e.g. a dual-property
      // (synced) relation where the API only reliably serves it from the
      // *other* database. The database schema spells out exactly how "[A]
      // Projetos" is configured, which explains it definitively instead of
      // guessing again.
      const schemaRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
      });
      const schemaData = schemaRes.ok ? await schemaRes.json() : null;
      const schemaProp = schemaData
        ? Object.entries(schemaData.properties || {}).find(([, v]) => v.id === prop?.id)
        : null;

      res.status(200).json({
        debug: {
          title: taskTitle(targetPage),
          pageId: targetPage.id,
          allPropertyNames: Object.keys(targetPage.properties || {}),
          projectPropertyRaw: prop,
          propertyItemFetch: rawFetch,
          projectPropertySchema: schemaProp ? { name: schemaProp[0], definition: schemaProp[1] } : null,
        },
      });
      return;
    }

    const hydratedProjects = new Map();
    await Promise.all(
      openPages.map(async (page) => {
        hydratedProjects.set(page.id, await hydratedProjectProperty(page, token));
      })
    );

    const relationIds = new Set();
    for (const page of openPages) collectRelationIds(hydratedProjects.get(page.id), relationIds);
    const relationTitles = new Map();
    await Promise.all(
      [...relationIds].map(async (id) => {
        const page = await fetchPage(id, token);
        if (page) relationTitles.set(id, pageTitle(page));
      })
    );

    // notion:// opens the page directly in the Notion app instead of a
    // browser tab.
    const groupsByLabel = new Map();
    for (const page of openPages) {
      const project = propertyText(hydratedProjects.get(page.id), relationTitles) || NO_PROJECT_LABEL;
      if (!groupsByLabel.has(project)) groupsByLabel.set(project, []);
      groupsByLabel.get(project).push({
        id: page.id,
        label: taskTitle(page),
        link: `notion://www.notion.so/${page.id.replace(/-/g, '')}`,
      });
    }

    const groups = [...groupsByLabel.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([projectLabel, tasks]) => ({
        projectLabel,
        tasks: [...tasks].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      }));

    res.status(200).json({ updatedAt: new Date().toISOString(), total: openPages.length, groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching Notion tasks.' });
  }
}
