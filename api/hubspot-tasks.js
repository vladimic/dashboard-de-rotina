// Vercel serverless function. Runs server-side only — the HubSpot token
// never reaches the browser. Pulls overdue + due-today tasks, resolves each
// task's associated deal (pipeline stage + name), and groups tasks by stage
// so the dashboard can render them without touching the HubSpot API itself.

import { hubspotFetch, fetchStageLabelMap, sortByStage, dealLink } from './_lib/hubspotShared.js';

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';
const NO_DEAL_LABEL = 'Sem negócio';

// Start-of-today / end-of-today as epoch ms, computed in TIMEZONE rather
// than the server's UTC clock, so "hoje" matches the user's actual day.
function todayBoundsMs() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  // Approximate the timezone's local midnight in UTC by reusing the offset
  // implied by Intl formatting of a UTC instant; good enough for day bucketing.
  const localMidnightUTC = new Date(`${y}-${m}-${d}T00:00:00`);
  const tzOffsetMs = getTzOffsetMs(now, TIMEZONE);
  const startOfDay = localMidnightUTC.getTime() - tzOffsetMs;
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
  return { startOfDay, endOfDay };
}

function getTzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUTC - date.getTime();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = process.env.HUBSPOT_TOKEN;
  const portalId = process.env.HUBSPOT_PORTAL_ID;

  if (!token || !portalId) {
    res.status(500).json({ error: 'HUBSPOT_TOKEN / HUBSPOT_PORTAL_ID not configured on the server.' });
    return;
  }

  try {
    const { endOfDay } = todayBoundsMs();

    const searchRes = await hubspotFetch(token, '/crm/v3/objects/tasks/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' },
              { propertyName: 'hs_timestamp', operator: 'LTE', value: String(endOfDay) },
            ],
          },
        ],
        properties: ['hs_task_subject', 'hs_timestamp', 'hs_task_status'],
        sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }],
        limit: 100,
      }),
    });

    if (!searchRes.ok) {
      const text = await searchRes.text();
      throw new Error(`Tasks search failed (${searchRes.status}): ${text}`);
    }
    const searchData = await searchRes.json();
    // The server-side NEQ filter isn't fully reliable (completed tasks have
    // slipped through), so the status is re-checked client-side as a guarantee.
    const tasks = (searchData.results || []).filter((t) => t.properties?.hs_task_status !== 'COMPLETED');

    // Points at the "Meu Dia" saved view (object type 0-27 = tasks).
    const tasksUrl = `https://app.hubspot.com/contacts/${portalId}/objects/0-27/views/61258822/list`;

    if (tasks.length === 0) {
      res.status(200).json({ updatedAt: new Date().toISOString(), vencidas: 0, hoje: 0, groups: [], tasksUrl });
      return;
    }

    // Task -> associated deal ids
    const assocRes = await hubspotFetch(token, '/crm/v4/associations/tasks/deals/batch/read', {
      method: 'POST',
      body: JSON.stringify({ inputs: tasks.map((t) => ({ id: t.id })) }),
    });
    if (!assocRes.ok) {
      const text = await assocRes.text();
      throw new Error(`Task->deal associations failed (${assocRes.status}): ${text}`);
    }
    const assocData = await assocRes.json();
    const taskIdToDealId = new Map();
    for (const entry of assocData.results || []) {
      const taskId = entry.from?.id;
      const dealId = entry.to?.[0]?.toObjectId;
      if (taskId && dealId) taskIdToDealId.set(String(taskId), String(dealId));
    }

    const dealIds = [...new Set(taskIdToDealId.values())];
    let dealById = new Map();
    let stageLabelById = new Map();

    if (dealIds.length > 0) {
      const dealsRes = await hubspotFetch(token, '/crm/v3/objects/deals/batch/read', {
        method: 'POST',
        body: JSON.stringify({
          properties: ['dealname', 'dealstage', 'pipeline'],
          inputs: dealIds.map((id) => ({ id })),
        }),
      });
      if (!dealsRes.ok) {
        const text = await dealsRes.text();
        throw new Error(`Deals batch read failed (${dealsRes.status}): ${text}`);
      }
      const dealsData = await dealsRes.json();
      dealById = new Map((dealsData.results || []).map((d) => [String(d.id), d]));
      stageLabelById = await fetchStageLabelMap(token);
    }

    const groupsByLabel = new Map();
    let vencidas = 0;
    let hoje = 0;

    function groupFor(label) {
      if (!groupsByLabel.has(label)) groupsByLabel.set(label, []);
      return groupsByLabel.get(label);
    }

    // "Vencido" is judged against the actual moment of this request (day AND
    // time), not just whether it falls before today's midnight — a task due
    // at 15:00 today is overdue by 16:00 today, not only starting tomorrow.
    const now = Date.now();

    for (const task of tasks) {
      const dueMs = Number(task.properties.hs_timestamp);
      const isOverdue = dueMs < now;
      if (isOverdue) vencidas += 1;
      else hoje += 1;

      const dealId = taskIdToDealId.get(String(task.id));
      const deal = dealId ? dealById.get(dealId) : null;
      const stageLabel = deal ? stageLabelById.get(deal.properties.dealstage) || 'Outro estágio' : NO_DEAL_LABEL;

      groupFor(stageLabel).push({
        id: task.id,
        title: task.properties.hs_task_subject || '(sem título)',
        due: isOverdue ? 'vencido' : 'hoje',
        dealName: deal?.properties?.dealname || null,
        link: dealId ? dealLink(portalId, dealId) : null,
        // TEMP DEBUG — reverter depois do diagnóstico.
        debugRaw: task.properties.hs_timestamp,
        debugDueMs: dueMs,
        debugNow: now,
      });
    }

    const groups = sortByStage([...groupsByLabel.entries()], ([label]) => label, NO_DEAL_LABEL).map(
      ([stageLabel, groupTasks]) => ({ stageLabel, tasks: groupTasks })
    );

    res.status(200).json({ updatedAt: new Date(now).toISOString(), vencidas, hoje, groups, tasksUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching HubSpot tasks.' });
  }
}
