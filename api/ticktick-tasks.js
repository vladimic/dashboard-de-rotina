// Vercel serverless function. Reads the TickTick OAuth token stored by
// api/ticktick-auth-callback.js from Supabase, then pulls tasks due today or
// overdue from every TickTick project (list) plus the Inbox, grouped by list.
//
// TickTick's Open API has no single "all tasks across projects, filtered by
// due date" endpoint — each project's data has to be fetched individually
// and filtered/grouped here. Two quirks confirmed by direct testing:
// - GET /open/v1/project doesn't include the Inbox ("Caixa de Entrada") —
//   its tasks are only reachable via the special literal id "inbox".
// - GET /open/v1/project/{id}/data caps out around ~99 tasks with no
//   pagination parameter that changes that, so very large lists (300+
//   tasks) won't fully come through — a real Open API limitation.

import { createClient } from '@supabase/supabase-js';

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';
const INBOX_LABEL = 'Caixa de Entrada';
const API_BASE = 'https://api.ticktick.com/open/v1';

async function getAccessToken(supabase) {
  const { data: row, error } = await supabase.from('ticktick_auth').select('data').eq('id', 'default').maybeSingle();
  if (error) throw new Error(error.message);
  return row?.data?.accessToken || null;
}

// Mirrors the Notion date-only fix: all-day tasks store just a calendar
// date, so they're compared as plain dates rather than instants (avoiding
// the same UTC-vs-local-timezone day-boundary bug fixed for Notion).
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE });

function isDueTodayOrEarlier(task, todayStr) {
  if (!task.dueDate) return false;
  if (task.isAllDay) {
    const dateStr = task.dueDate.slice(0, 10);
    return dateStr <= todayStr;
  }
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  // Compare calendar days in the dashboard timezone. (The previous
  // end-of-day instant was built in the server's timezone — UTC on Vercel —
  // so tasks due after ~21h local today were wrongly excluded.)
  return dateFormatter.format(due) <= todayStr;
}

// GET /project/{id}/data returns only ~99 tasks, so big lists (e.g. a
// 365-task "Bíblia 365" list) lose their later tasks — exactly the overdue/
// today ones. POST /task/filter isn't capped that way, so for suspiciously
// full lists we also ask it for open tasks due up to today and merge by id.
// Best-effort: any failure just falls back to the /data result.
const CAP_SUSPECT = 90;

async function fetchFilteredOpenTasks(accessToken, projectId) {
  const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, '+0000');
  try {
    const res = await fetch(`${API_BASE}/task/filter`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectIds: [projectId],
        status: [0],
        startDate: '2000-01-01T00:00:00+0000',
        endDate: fmt(new Date(Date.now() + 36 * 3600 * 1000)),
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

async function loadProjectTasks(accessToken, project, projectData) {
  const tasks = projectData.tasks || [];
  if (tasks.length < CAP_SUSPECT) return tasks;
  const extra = await fetchFilteredOpenTasks(accessToken, project.id);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of extra) if (!byId.has(t.id)) byId.set(t.id, t);
  return [...byId.values()];
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

    const todayStr = dateFormatter.format(new Date());

    const projectsRes = await fetch(`${API_BASE}/project`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!projectsRes.ok) {
      const text = await projectsRes.text();
      throw new Error(`TickTick projects fetch failed (${projectsRes.status}): ${text}`);
    }
    const projects = await projectsRes.json();
    const projectList = [{ id: 'inbox', name: INBOX_LABEL }, ...(projects || [])];

    // ?debug=1[&project=<name substring>][&task=<title substring>] — runs
    // the exact same filter used in production against one project's full
    // task list, reporting how many pass the status filter vs the due-date
    // filter vs both — plus the raw JSON of any task matching &task=
    // regardless of whether it passed, so real field values can be
    // inspected directly instead of guessing why something was excluded.
    if (req.query?.debug) {
      const projectFilter = (req.query.project || '').toLowerCase();
      const taskFilter = (req.query.task || '').toLowerCase();
      const debug = { todayStr, projects: projectList.map((p) => ({ id: p.id, name: p.name })) };
      if (projectFilter) {
        const match = projectList.find((p) => (p.name || '').toLowerCase().includes(projectFilter));
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
            const allTasks = await loadProjectTasks(accessToken, match, projectData);
            debug.tasksFromData = (projectData.tasks || []).length;
            debug.totalTasksInProject = allTasks.length;
            debug.tasksPassingStatusFilter = allTasks.filter((t) => t.status === 0).length;
            debug.tasksPassingDueFilter = allTasks.filter((t) => isDueTodayOrEarlier(t, todayStr)).length;
            debug.tasksPassingBoth = allTasks.filter(
              (t) => t.status === 0 && isDueTodayOrEarlier(t, todayStr)
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
    const failedProjects = [];

    await Promise.all(
      projectList.map(async (project) => {
        const dataRes = await fetch(`${API_BASE}/project/${project.id}/data`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!dataRes.ok) {
          // Don't swallow this: a rate-limited/expired fetch used to look
          // exactly like "0 pending tasks".
          failedProjects.push({ name: project.name || INBOX_LABEL, status: dataRes.status });
          return;
        }
        const projectData = await dataRes.json();
        const dueTasks = (await loadProjectTasks(accessToken, project, projectData)).filter(
          (t) => t.status === 0 && isDueTodayOrEarlier(t, todayStr)
        );
        if (dueTasks.length === 0) return;
        const label = project.name || INBOX_LABEL;
        const tasks = dueTasks.map((t) => ({
          id: t.id,
          label: t.title || '(sem título)',
          // t.projectId (not the loop's project.id) — matches for both
          // regular projects and the special "inbox" pseudo-id.
          // Best-effort app deep link (no official docs for this) — mirrors
          // the web URL's #p/{projectId}/tasks/{taskId} shape under the
          // ticktick:// scheme. Falls back to the web URL if it doesn't work.
          link: `ticktick://p/${t.projectId}/tasks/${t.id}`,
        }));
        // Merge instead of overwrite: two lists sharing a name used to
        // clobber each other (and total double-counted the lost tasks).
        groupsByLabel.set(label, [...(groupsByLabel.get(label) || []), ...tasks]);
        total += tasks.length;
      })
    );

    const groups = [...groupsByLabel.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([projectLabel, tasks]) => ({
        projectLabel,
        tasks: [...tasks].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      }));

    if (failedProjects.length === projectList.length) {
      throw new Error(`TickTick project fetches all failed (e.g. status ${failedProjects[0].status}).`);
    }

    res.status(200).json({ updatedAt: new Date().toISOString(), total, groups, failedProjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching TickTick tasks.' });
  }
}
