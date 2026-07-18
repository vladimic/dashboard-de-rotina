// Vercel serverless function. Reads the TickTick OAuth token stored by
// api/ticktick-auth-callback.js from Supabase, then pulls tasks due today or
// overdue from every TickTick project (list), grouped by project.
//
// TickTick's Open API has no single "all tasks across projects, filtered by
// due date" endpoint — each project's data has to be fetched individually
// and filtered/grouped here.

import { createClient } from '@supabase/supabase-js';

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';
const NO_PROJECT_LABEL = 'Sem Lista';
const API_BASE = 'https://api.ticktick.com/open/v1';

async function getAccessToken(supabase) {
  const { data: row, error } = await supabase.from('ticktick_auth').select('data').eq('id', 'default').maybeSingle();
  if (error) throw new Error(error.message);
  return row?.data?.accessToken || null;
}

// Mirrors the Notion date-only fix: all-day tasks store just a calendar
// date, so they're compared as plain dates rather than instants (avoiding
// the same UTC-vs-local-timezone day-boundary bug fixed for Notion).
function isDueTodayOrEarlier(task, todayStr, endOfDayMs) {
  if (!task.dueDate) return false;
  if (task.isAllDay) {
    const dateStr = task.dueDate.slice(0, 10);
    return dateStr <= todayStr;
  }
  const dueMs = new Date(task.dueDate).getTime();
  return !Number.isNaN(dueMs) && dueMs <= endOfDayMs;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured on the server.' });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const accessToken = await getAccessToken(supabase);
    if (!accessToken) {
      res.status(200).json({ updatedAt: new Date().toISOString(), total: 0, groups: [], notConnected: true });
      return;
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
    const now = new Date();
    const endOfDayLocal = new Date(
      new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now) +
        'T23:59:59'
    );
    const endOfDayMs = endOfDayLocal.getTime();

    const projectsRes = await fetch(`${API_BASE}/project`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!projectsRes.ok) {
      const text = await projectsRes.text();
      throw new Error(`TickTick projects fetch failed (${projectsRes.status}): ${text}`);
    }
    const projects = await projectsRes.json();

    // ?debug=1[&project=<name substring>][&task=<title substring>] — dumps
    // the raw project list, and (when &project= is given) runs the exact
    // same filter used in production against that project's full task list,
    // reporting how many pass the status filter vs the due-date filter vs
    // both — plus the raw JSON of any task matching &task= regardless of
    // whether it passed the filters, so real field values can be inspected
    // directly instead of guessing why something was excluded.
    if (req.query?.debug) {
      const projectFilter = (req.query.project || '').toLowerCase();
      const taskFilter = (req.query.task || '').toLowerCase();
      const debug = { todayStr, endOfDayMs, projects: (projects || []).map((p) => ({ id: p.id, name: p.name })) };
      if (projectFilter) {
        const match = (projects || []).find((p) => (p.name || '').toLowerCase().includes(projectFilter));
        if (!match) {
          debug.matchedProject = null;
        } else {
          const dataRes = await fetch(`${API_BASE}/project/${match.id}/data`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          debug.matchedProject = { id: match.id, name: match.name };
          if (!dataRes.ok) {
            debug.projectDataFetch = { status: dataRes.status, ok: false, body: (await dataRes.text()).slice(0, 1000) };
          } else {
            const projectData = await dataRes.json();
            const allTasks = projectData.tasks || [];
            debug.totalTasksInProject = allTasks.length;
            debug.tasksPassingStatusFilter = allTasks.filter((t) => t.status === 0).length;
            debug.tasksPassingDueFilter = allTasks.filter((t) => isDueTodayOrEarlier(t, todayStr, endOfDayMs)).length;
            debug.tasksPassingBoth = allTasks.filter(
              (t) => t.status === 0 && isDueTodayOrEarlier(t, todayStr, endOfDayMs)
            ).length;
            if (taskFilter) {
              debug.matchingTasksRaw = allTasks.filter((t) => (t.title || '').toLowerCase().includes(taskFilter));
            }
          }
        }
      }
      res.status(200).json({ debug });
      return;
    }

    const groupsByLabel = new Map();
    let total = 0;

    await Promise.all(
      (projects || []).map(async (project) => {
        const dataRes = await fetch(`${API_BASE}/project/${project.id}/data`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!dataRes.ok) return;
        const projectData = await dataRes.json();
        const dueTasks = (projectData.tasks || []).filter(
          (t) => t.status === 0 && isDueTodayOrEarlier(t, todayStr, endOfDayMs)
        );
        if (dueTasks.length === 0) return;
        const label = project.name || NO_PROJECT_LABEL;
        const tasks = dueTasks.map((t) => ({
          id: t.id,
          label: t.title || '(sem título)',
          link: `https://ticktick.com/webapp/#p/${project.id}/tasks/${t.id}`,
        }));
        groupsByLabel.set(label, tasks);
        total += tasks.length;
      })
    );

    const groups = [...groupsByLabel.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([projectLabel, tasks]) => ({
        projectLabel,
        tasks: [...tasks].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      }));

    res.status(200).json({ updatedAt: new Date().toISOString(), total, groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching TickTick tasks.' });
  }
}
