// Shared helpers for the HubSpot serverless functions. Lives under api/_lib
// so Vercel doesn't turn it into its own route (only direct children of
// /api become endpoints).

export const HUBSPOT_API = 'https://api.hubapi.com';
export const DEALS_OBJECT_TYPE = '0-3';

// Requested display order for pipeline stage groups. Matched
// case/punctuation-insensitively against each deal's stage label;
// unmatched stages sort after these.
const STAGE_ORDER_RAW = [
  'negociação & fechamento',
  'proposta',
  'mapeamento',
  'interessado',
  'stand by',
  'contato quente',
  'inbox',
  'momento ruim',
  'potencial',
  'remarketing',
  'contato morno',
  'contato frio',
  'estoque',
  'contato won',
  'contato lost',
];

// Lowercase and fold hyphens/underscores/extra whitespace to single spaces,
// so "Stand-By" / "stand_by" / "stand by" all match the same STAGE_ORDER entry.
export function normalizeStageName(label) {
  return label
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STAGE_ORDER = STAGE_ORDER_RAW.map(normalizeStageName);

export function stageRank(label, lastLabel) {
  if (label === lastLabel) return STAGE_ORDER.length + 1;
  const idx = STAGE_ORDER.indexOf(normalizeStageName(label));
  return idx === -1 ? STAGE_ORDER.length : idx;
}

export function sortByStage(entries, keyFn, lastLabel) {
  return [...entries].sort((a, b) => {
    const rankDiff = stageRank(keyFn(a), lastLabel) - stageRank(keyFn(b), lastLabel);
    return rankDiff !== 0 ? rankDiff : keyFn(a).localeCompare(keyFn(b), 'pt-BR');
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries on HubSpot's 429 (rate limit) responses — this app fires several
// sequential/parallel API calls per refresh, which can trip the per-second
// limit even though total volume is small. Honors Retry-After when present.
export async function hubspotFetch(token, path, options = {}, retriesLeft = 3) {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 429 && retriesLeft > 0) {
    const retryAfter = Number(res.headers.get('Retry-After'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200;
    await sleep(waitMs);
    return hubspotFetch(token, path, options, retriesLeft - 1);
  }

  return res;
}

// Paginated CRM object search. Follows paging.next.after up to maxPages
// (100 results/page) as a safety valve against runaway execution time.
// HubSpot enforces a stricter per-second limit specifically on /search
// endpoints, so pages are paced a little rather than fired back-to-back.
export async function searchAll(token, path, body, maxPages = 5) {
  let results = [];
  let after;
  for (let i = 0; i < maxPages; i++) {
    if (i > 0) await sleep(250);
    const res = await hubspotFetch(token, path, {
      method: 'POST',
      body: JSON.stringify({ ...body, after }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${path} search failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    results = results.concat(data.results || []);
    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;
  }
  return results;
}

export function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

export async function fetchStageLabelMap(token) {
  const res = await hubspotFetch(token, '/crm/v3/pipelines/deals');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipelines fetch failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const map = new Map();
  for (const pipeline of data.results || []) {
    for (const stage of pipeline.stages || []) {
      map.set(stage.id, stage.label);
    }
  }
  return map;
}

export function dealLink(portalId, dealId) {
  return `https://app.hubspot.com/contacts/${portalId}/record/${DEALS_OBJECT_TYPE}/${dealId}`;
}
