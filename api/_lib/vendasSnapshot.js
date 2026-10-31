// Shared by /api/vendas-snapshot (cron) and /api/vendas (takes today's photo
// when it's missing). Reads the open sales funnel from HubSpot and stores one
// row per deal in Supabase (deal_snapshots), keyed by the São Paulo day.

import { createClient } from '@supabase/supabase-js';
import { searchAll } from './hubspotShared.js';

const TIMEZONE = 'America/Sao_Paulo';

// The user's own deals in the main pipeline ("VENDAS"), in every stage but
// Inbox, Closed won and Closed lost.
export const VENDAS_PIPELINE = 'default';
export const EXCLUDED_STAGE_IDS = ['967209303', 'closedwon', 'closedlost'];
const DEFAULT_OWNER_ID = '81367379';

// Cold funnel (Remarketing, Contato Morno, Contato Frio): hundreds of deals,
// so /api/vendas sends names only for today.
export const COLD_STAGE_IDS = ['121424252', '31607681', '31607680'];

// A photo taken less than this long ago isn't taken again, so the endpoints
// can't be used to hammer the HubSpot API.
const MIN_GAP_MS = 10 * 60 * 1000;

export function dayKeySaoPaulo(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

export function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured on the server.');
  return createClient(url, key, { auth: { persistSession: false } });
}

// auth.users id the photos belong to (same login as the health data).
export function ownerUserId() {
  const id = process.env.VENDAS_USER_ID || process.env.HEALTH_USER_ID;
  if (!id) throw new Error('VENDAS_USER_ID (or HEALTH_USER_ID) not configured on the server.');
  return id;
}

async function fetchStageLabels(token) {
  const res = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Pipelines fetch failed (${res.status}).`);
  const data = await res.json();
  const map = new Map();
  for (const pipeline of data.results || []) for (const stage of pipeline.stages || []) map.set(stage.id, stage.label);
  return map;
}

// Takes today's photo. Returns { day, count, skipped }.
export async function takeSnapshot({ force = false } = {}) {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) throw new Error('HUBSPOT_TOKEN not configured on the server.');
  const owner = process.env.HUBSPOT_OWNER_ID || DEFAULT_OWNER_ID;
  const userId = ownerUserId();
  const supabase = supabaseAdmin();
  const day = dayKeySaoPaulo();

  if (!force) {
    const { data: last } = await supabase
      .from('deal_snapshots')
      .select('taken_at')
      .eq('user_id', userId)
      .eq('day', day)
      .order('taken_at', { ascending: false })
      .limit(1);
    const takenAt = last?.[0]?.taken_at ? new Date(last[0].taken_at).getTime() : 0;
    if (Date.now() - takenAt < MIN_GAP_MS) return { day, count: null, skipped: true };
  }

  const [labels, deals] = await Promise.all([
    fetchStageLabels(token),
    searchAll(
      token,
      '/crm/v3/objects/deals/search',
      {
        filterGroups: [
          {
            filters: [
              { propertyName: 'hubspot_owner_id', operator: 'EQ', value: owner },
              { propertyName: 'pipeline', operator: 'EQ', value: VENDAS_PIPELINE },
              { propertyName: 'dealstage', operator: 'NOT_IN', values: EXCLUDED_STAGE_IDS },
            ],
          },
        ],
        properties: ['dealname', 'dealstage', 'hs_v2_date_entered_current_stage'],
        sorts: [{ propertyName: 'hs_object_id', direction: 'ASCENDING' }],
        limit: 100,
      },
      30
    ),
  ]);

  const takenAt = new Date().toISOString();
  const rows = deals.map((d) => ({
    user_id: userId,
    day,
    deal_id: String(d.id),
    deal_name: d.properties.dealname || '(sem nome)',
    stage_id: d.properties.dealstage,
    stage_label: labels.get(d.properties.dealstage) || d.properties.dealstage,
    entered_stage_at: d.properties.hs_v2_date_entered_current_stage || null,
    taken_at: takenAt,
  }));

  // An empty search would wipe the day; treat it as a failure instead.
  if (rows.length === 0) throw new Error('HubSpot returned no deals — photo not saved.');

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('deal_snapshots').upsert(rows.slice(i, i + 500), { onConflict: 'user_id,day,deal_id' });
    if (error) throw new Error(`Saving the photo failed: ${error.message}`);
  }
  // Deals that left the funnel since an earlier photo of the same day.
  const { error: delErr } = await supabase.from('deal_snapshots').delete().eq('user_id', userId).eq('day', day).lt('taken_at', takenAt);
  if (delErr) throw new Error(`Cleaning the day failed: ${delErr.message}`);

  return { day, count: rows.length, skipped: false };
}
