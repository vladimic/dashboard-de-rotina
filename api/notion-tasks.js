// Vercel serverless function. Runs server-side only — the Notion integration
// token never reaches the browser. Pulls tasks due today or overdue from a
// single Notion tasks database, grouped by project.
//
// Grouping reads the *Projetos* database's "[A] Atividades" relation
// (project -> its tasks) rather than the task's own "[A] Projetos" relation
// (task -> its project). Confirmed empirically: the task-side property is
// unreliable via the API (empty even when visibly set in the Notion UI —
// likely a sync-lag quirk of this specific two-way relation), while the
// project-side property reliably lists its related tasks.

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';
const NO_PROJECT_LABEL = 'Sem Projeto';
const NOTION_VERSION = '2022-06-28';
const TITLE_PROPERTY = 'Atividades';
const DUE_PROPERTY = 'Prazo';
const STATUS_PROPERTY = 'Status';
const REVERSE_TASKS_PROPERTY = '[A] Atividades';
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

function pageTitle(page) {
  const titleProp = Object.values(page.properties || {}).find((p) => p?.type === 'title');
  const arr = titleProp?.title || [];
  return arr.map((t) => t.plain_text).join('') || null;
}

// The "query a database" endpoint doesn't reliably return every item of a
// relation property (Notion caps/truncates inline relation values). The
// "retrieve a page property item" endpoint is the reliable, paginated
// source of truth, so every project's task list is re-fetched through it.
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

// Queries the Projetos database and builds taskPageId -> projectName by
// reading each project's "[A] Atividades" relation.
async function buildProjectByTaskId(token, projectsDbId) {
  const map = new Map();
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${projectsDbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Projetos database query failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    for (const projectPage of data.results || []) {
      const projectName = pageTitle(projectPage) || NO_PROJECT_LABEL;
      const reverseProp = findProperty(projectPage.properties || {}, REVERSE_TASKS_PROPERTY, 'atividades');
      if (reverseProp?.type !== 'relation') continue;
      const taskIds = await fetchRelationIds(projectPage.id, reverseProp.id, token);
      for (const taskId of taskIds) map.set(taskId, projectName);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return map;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  const projectsDbId = process.env.NOTION_PROJECTS_DATABASE_ID;
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

    // ?debug=1 — dumps the project -> task-count map built from the
    // Projetos database's reverse relation, for troubleshooting.
    if (req.query?.debug) {
      if (!projectsDbId) {
        res.status(200).json({ debug: 'NOTION_PROJECTS_DATABASE_ID not configured' });
        return;
      }
      const projectByTaskId = await buildProjectByTaskId(token, projectsDbId);
      const counts = {};
      for (const name of projectByTaskId.values()) counts[name] = (counts[name] || 0) + 1;
      const openTaskIds = new Set(openPages.map((p) => p.id));
      const matchedOpenTasks = [...projectByTaskId.keys()].filter((id) => openTaskIds.has(id)).length;
      res.status(200).json({
        debug: {
          totalProjectPages: [...new Set(projectByTaskId.values())].length,
          totalTaskLinksFound: projectByTaskId.size,
          projectTaskCounts: counts,
          openTasksMatchedToAProject: matchedOpenTasks,
          openTasksTotal: openPages.length,
        },
      });
      return;
    }

    const projectByTaskId = projectsDbId ? await buildProjectByTaskId(token, projectsDbId) : new Map();

    // notion:// opens the page directly in the Notion app instead of a
    // browser tab.
    const groupsByLabel = new Map();
    for (const page of openPages) {
      const project = projectByTaskId.get(page.id) || NO_PROJECT_LABEL;
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
