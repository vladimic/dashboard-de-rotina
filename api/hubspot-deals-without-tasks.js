// Vercel serverless function. Finds deals that have no open (non-completed)
// task associated with them, grouped by pipeline stage. Two full scans are
// involved (all open tasks, all deals), each capped at 3000 records — a
// very large account could still see this miss records beyond that cap.

import { hubspotFetch, searchAll, chunk, fetchStageLabelMap, sortByStage, dealLink, normalizeStageName } from './_lib/hubspotShared.js';

const OTHER_STAGE_LABEL = 'Outro estágio';

// Stages that shouldn't count as "sem tarefa" — mostly cold/dead/closed
// buckets where an open task wouldn't be expected anyway.
const EXCLUDED_STAGES = [
  'potencial',
  'remarketing',
  'contato morno',
  'contato frio',
  'closed lost',
  'closed won',
  'estoque',
].map(normalizeStageName);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = process.env.HUBSPOT_TOKEN;
  const portalId = process.env.HUBSPOT_PORTAL_ID;

  if (!token || !portalId) {
    res.status(500).json({ error: 'HUBSPOT_TOKEN / HUBSPOT_PORTAL_ID not configured on the server.' });
    return;
  }

  try {
    // 1. All open tasks (any due date). The server-side NEQ filter isn't
    // fully reliable (completed tasks have slipped through), so the status
    // is re-checked client-side against the same property value as a
    // guarantee regardless of how HubSpot's search index applied the filter.
    const openTasksRaw = await searchAll(
      token,
      '/crm/v3/objects/tasks/search',
      {
        filterGroups: [{ filters: [{ propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' }] }],
        properties: ['hs_task_status'],
        limit: 100,
      },
      30
    );
    const openTasks = openTasksRaw.filter((t) => t.properties?.hs_task_status !== 'COMPLETED');

    // 2. Deal ids associated with those tasks, batched (assoc API caps at 100 inputs).
    // Also keeps a trail of which task(s) caused each deal to be considered
    // "has an open task", exposed via `excludedDebug` below for troubleshooting.
    const openTaskStatusById = new Map(openTasks.map((t) => [String(t.id), t.properties?.hs_task_status]));
    const dealIdsWithOpenTask = new Set();
    const dealIdToOpenTaskInfo = new Map();
    for (const taskChunk of chunk(openTasks, 100)) {
      if (taskChunk.length === 0) continue;
      const assocRes = await hubspotFetch(token, '/crm/v4/associations/tasks/deals/batch/read', {
        method: 'POST',
        body: JSON.stringify({ inputs: taskChunk.map((t) => ({ id: t.id })) }),
      });
      if (!assocRes.ok) {
        const text = await assocRes.text();
        throw new Error(`Task->deal associations failed (${assocRes.status}): ${text}`);
      }
      const assocData = await assocRes.json();
      for (const entry of assocData.results || []) {
        const dealId = entry.to?.[0]?.toObjectId;
        const taskId = entry.from?.id;
        if (dealId) {
          dealIdsWithOpenTask.add(String(dealId));
          const list = dealIdToOpenTaskInfo.get(String(dealId)) || [];
          list.push({ taskId, status: openTaskStatusById.get(String(taskId)) });
          dealIdToOpenTaskInfo.set(String(dealId), list);
        }
      }
    }

    // 3. All deals, with the excluded stages (Closed Lost, Potencial, etc.)
    // filtered out server-side so they never count against the pagination
    // cap — a HubSpot account accumulates a lot of closed/dead deals over
    // time, and there's no reason to scan through them here at all.
    const stageLabelById = await fetchStageLabelMap(token);
    const excludedStageIds = [...stageLabelById.entries()]
      .filter(([, label]) => EXCLUDED_STAGES.includes(normalizeStageName(label)))
      .map(([id]) => id);

    const dealsFilterGroups =
      excludedStageIds.length > 0
        ? [{ filters: [{ propertyName: 'dealstage', operator: 'NOT_IN', values: excludedStageIds }] }]
        : undefined;

    const allDeals = await searchAll(
      token,
      '/crm/v3/objects/deals/search',
      {
        ...(dealsFilterGroups ? { filterGroups: dealsFilterGroups } : {}),
        properties: ['dealname', 'dealstage', 'pipeline'],
        sorts: [{ propertyName: 'dealname', direction: 'ASCENDING' }],
        limit: 100,
      },
      30
    );

    // ?search=<text> short-circuits to a focused lookup for one deal by name
    // substring, instead of the full grouped response — useful to check
    // whether a specific deal is even present in the `allDeals` search
    // results at all, and if so why it isn't showing as "sem tarefa".
    const searchTerm = (req.query?.search || '').toLowerCase().trim();
    if (searchTerm) {
      const matches = allDeals
        .filter((d) => (d.properties.dealname || '').toLowerCase().includes(searchTerm))
        .map((d) => {
          const stageLabel = stageLabelById.get(d.properties.dealstage) || OTHER_STAGE_LABEL;
          const hasOpenTask = dealIdsWithOpenTask.has(String(d.id));
          const isExcludedStage = EXCLUDED_STAGES.includes(normalizeStageName(stageLabel));
          return {
            id: d.id,
            name: d.properties.dealname,
            dealstageRaw: d.properties.dealstage,
            stage: stageLabel,
            hasOpenTask,
            openTasks: dealIdToOpenTaskInfo.get(String(d.id)) || [],
            isExcludedStage,
            wouldShowAsSemTarefa: !hasOpenTask && !isExcludedStage,
          };
        });
      res.status(200).json({
        search: searchTerm,
        totalDealsScanned: allDeals.length,
        matchCount: matches.length,
        matches,
      });
      return;
    }

    const dealsWithoutTask = allDeals.filter((d) => {
      if (dealIdsWithOpenTask.has(String(d.id))) return false;
      const stageLabel = stageLabelById.get(d.properties.dealstage) || OTHER_STAGE_LABEL;
      return !EXCLUDED_STAGES.includes(normalizeStageName(stageLabel));
    });

    // Debug trail: for every deal that got excluded for having an "open"
    // task, show which task(s) and status(es) caused it. Visit this endpoint
    // directly in the browser to inspect when a deal seems to be missing.
    const excludedDebug = allDeals
      .filter((d) => dealIdsWithOpenTask.has(String(d.id)))
      .map((d) => ({
        id: d.id,
        name: d.properties.dealname,
        stage: stageLabelById.get(d.properties.dealstage) || OTHER_STAGE_LABEL,
        openTasks: dealIdToOpenTaskInfo.get(String(d.id)) || [],
      }));

    if (dealsWithoutTask.length === 0) {
      res.status(200).json({ updatedAt: new Date().toISOString(), total: 0, groups: [], excludedDebug });
      return;
    }

    const groupsByLabel = new Map();
    function groupFor(label) {
      if (!groupsByLabel.has(label)) groupsByLabel.set(label, []);
      return groupsByLabel.get(label);
    }

    for (const deal of dealsWithoutTask) {
      const stageLabel = stageLabelById.get(deal.properties.dealstage) || OTHER_STAGE_LABEL;
      groupFor(stageLabel).push({
        id: deal.id,
        name: deal.properties.dealname || '(sem nome)',
        link: dealLink(portalId, deal.id),
      });
    }

    const groups = sortByStage([...groupsByLabel.entries()], ([label]) => label, OTHER_STAGE_LABEL).map(
      ([stageLabel, deals]) => ({ stageLabel, deals })
    );

    res.status(200).json({ updatedAt: new Date().toISOString(), total: dealsWithoutTask.length, groups, excludedDebug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching deals without tasks.' });
  }
}
