// Pure helpers for the Backlog tab's "Notion - Atividades Abertas" table: where
// each open task's deadline falls (overdue, this week, the next three weeks,
// later, none) and the counts per category and project. Weeks run Monday to
// Sunday; the dates are plain "YYYY-MM-DD" keys in the user's time zone.

const DAY_MS = 86400000;
export const CATEGORY_ORDER = ['Trabalho', 'Particular', 'Família', 'Imóveis', 'Outros'];
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

// tasks: [{ project, due }] (open tasks only); categoryByProject: Map(project -> category | null).
export function summarizeBacklog(tasks, categoryByProject, todayKey) {
  const byProject = new Map();
  for (const t of tasks) {
    const row = byProject.get(t.project) || { name: t.project, open: 0, overdue: 0, w0: 0, w1: 0, w2: 0, w3: 0, later: 0, none: 0 };
    row.open += 1;
    row[bucketOf(t.due, todayKey)] += 1;
    byProject.set(t.project, row);
  }
  const byCategory = new Map();
  for (const row of byProject.values()) {
    const category = categoryByProject.get(row.name) || NO_CATEGORY_LABEL;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(row);
  }
  const rank = (c) => (CATEGORY_ORDER.includes(c) ? CATEGORY_ORDER.indexOf(c) : CATEGORY_ORDER.length + (c === NO_CATEGORY_LABEL ? 1 : 0));
  const groups = [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'pt-BR'))
    .map(([category, projects]) => ({ category, projects: projects.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'pt-BR')) }));
  const start = weekStart(todayKey);
  return { today: todayKey, weeks: [0, 1, 2, 3].map((i) => addDays(start, i * 7)), total: tasks.length, groups };
}
