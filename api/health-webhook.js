// Vercel serverless function. Receives Apple Health samples pushed by the
// "Sincronizar Saúde" Shortcut on the user's iPhone (Health data has no web
// API — the device is the only way to reach it). Protected by a
// shared-secret bearer token, like api/reminders-webhook.js.
//
//   GET  ?type=weight  → { since } — the newest sample already stored, so the
//                        Shortcut only fetches what's new. A far-past date
//                        when nothing is stored yet, so the first run pulls
//                        the whole history.
//   POST { type, samples: [{ date, endDate?, value, unit?, source? }] }
//                      → upserts every sample (duplicates are overwritten).

import { createClient } from '@supabase/supabase-js';

const TYPES = new Set(['weight']);
const FIRST_SYNC_SINCE = '2000-01-01T00:00:00Z';
const UPSERT_CHUNK = 500;

// Health hands back whatever unit the iPhone is set to display.
function toKg(value, unit) {
  const u = String(unit || 'kg').trim().toLowerCase();
  if (u === 'lb' || u === 'lbs') return value * 0.45359237;
  if (u === 'g') return value / 1000;
  if (u === 'st') return value * 6.35029318;
  return value;
}

// Shortcuts sends numbers formatted with the device locale ("86,4"), and
// when the whole Health sample ends up in the text instead of just its
// value it comes through as "86,4 kg" — take the first number either way.
function parseNumber(raw) {
  if (typeof raw === 'number') return raw;
  const match = /-?\d+(?:[.,]\d+)?/.exec(String(raw ?? ''));
  return match ? Number(match[0].replace(',', '.')) : NaN;
}

function parseDate(raw) {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const expectedSecret = process.env.HEALTH_WEBHOOK_SECRET;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expectedSecret || provided !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.HEALTH_USER_ID;
  if (!supabaseUrl || !serviceRoleKey || !userId) {
    res.status(500).json({ error: 'VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / HEALTH_USER_ID not configured on the server.' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === 'GET') {
    const type = String(req.query.type || 'weight');
    if (!TYPES.has(type)) {
      res.status(400).json({ error: `Unknown type "${type}".` });
      return;
    }
    const { data, error } = await supabase
      .from('health_samples')
      .select('start_at')
      .eq('user_id', userId)
      .eq('type', type)
      .order('start_at', { ascending: false })
      .limit(1);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ since: data?.[0]?.start_at || FIRST_SYNC_SINCE });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, use GET or POST.' });
    return;
  }

  const type = String(req.body?.type || '');
  const samples = Array.isArray(req.body?.samples) ? req.body.samples : null;
  if (!TYPES.has(type) || !samples) {
    res.status(400).json({ error: 'Expected a JSON body shaped like { "type": "weight", "samples": [...] }.' });
    return;
  }

  const rows = [];
  let skipped = 0;
  for (const s of samples) {
    const startAt = parseDate(s?.date);
    let value = parseNumber(s?.value);
    if (!startAt || !Number.isFinite(value)) {
      skipped++;
      continue;
    }
    if (type === 'weight') value = toKg(value, s.unit);
    rows.push({
      user_id: userId,
      type,
      start_at: startAt,
      end_at: parseDate(s.endDate),
      value: Math.round(value * 1000) / 1000,
      unit: type === 'weight' ? 'kg' : s.unit || null,
      source: String(s.source || ''),
    });
  }

  // Same sample listed twice in one payload would make the upsert fail
  // ("cannot affect row a second time").
  const unique = [...new Map(rows.map((r) => [`${r.start_at}|${r.source}`, r])).values()];

  try {
    for (let i = 0; i < unique.length; i += UPSERT_CHUNK) {
      const { error } = await supabase
        .from('health_samples')
        .upsert(unique.slice(i, i + UPSERT_CHUNK), { onConflict: 'user_id,type,start_at,source' });
      if (error) throw new Error(error.message);
    }
    res.status(200).json({ ok: true, saved: unique.length, skipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error saving health samples.' });
  }
}
