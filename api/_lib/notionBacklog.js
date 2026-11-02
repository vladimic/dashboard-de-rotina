// Pure helpers for the Backlog tab's "Notion - Atividades Abertas" table: where
// each open task's deadline falls (overdue, this week, the next three weeks,
// later, none) and the counts per category and project. Weeks run Monday to
// Sunday; the dates are plain "YYYY-MM-DD" keys in the user's time zone.

const DAY_MS = 86400000;
export const NO_CATEGORY_LABEL = 'Sem categoria';

const ms = (key) => new Date(`${key}T12:00:00Z`).getTime();
const addDays = (key, n) => new Date(ms(key) + n * DAY_MS).toISOString().slice(0, 10);

// Monday of the week that contains `key`.
export function weekStart(key) {
  const dow = new Date(ms(key)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

// 'overdue' | 'w0' (this week) | 'w1' | 'w2' | 'w3' | 'later' | 'none'
export function bucketOf(dueKey, todayKey) {
  if (!dueKey) return 'none';
  if (dueKey < todayKey) return 'overdue';
  const weeks = Math.floor((ms(dueKey) - ms(weekStart(todayKey))) / (7 * DAY_MS));
  return weeks >= 4 ? 'later' : `w${weeks}`;
}

const sortKey = (name) => name.replace(/[^\p{L}\p{N} -]/gu, '').trim();

// tasks: [{ project, due, urgent }] (open tasks only); projectMeta: Map(project -> { category, id }).
// Categories come in alphabetical order ("Sem categoria" last), projects too.
export function summarizeBacklog(tasks, projectMeta, todayKey) {
  const byProject = new Map();
  for (const t of tasks) {
    const row = byProject.get(t.project) || { name: t.project, id: projectMeta.get(t.project)?.id || null, open: 0, overdue: 0, w0: 0, w1: 0, w2: 0, w3: 0, later: 0, none: 0, noneUrgent: 0 };
    row.open += 1;
    const bucket = bucketOf(t.due, todayKey);
    row[bucket] += 1;
    if (bucket === 'none' && t.urgent) row.noneUrgent += 1;
    byProject.set(t.project, row);
  }
  const byCategory = new Map();
  for (const row of byProject.values()) {
    const category = projectMeta.get(row.name)?.category || NO_CATEGORY_LABEL;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(row);
  }
  const groups = [...byCategory.entries()]
    .sort(([a], [b]) => (a === NO_CATEGORY_LABEL) - (b === NO_CATEGORY_LABEL) || a.localeCompare(b, 'pt-BR'))
    .map(([category, projects]) => ({ category, projects: projects.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'pt-BR')) }));
  const start = weekStart(todayKey);
  return { today: todayKey, weeks: [0, 1, 2, 3].map((i) => addDays(start, i * 7)), total: tasks.length, groups };
}
