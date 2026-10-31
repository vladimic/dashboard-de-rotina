// Vercel serverless function behind the Vendas tab. Requires the logged-in
// user's Supabase token ("Authorization: Bearer <access token>") and only
// answers for the owner of the photos. If today's photo is missing it takes
// one first (the 23h cron overwrites it later with the day's final one).
//
// Returns the last `days` photos as counts per stage, with deal names for the
// days of the hot funnel, plus today's deals (stage + days in stage).

import { takeSnapshot, supabaseAdmin, ownerUserId, dayKeySaoPaulo, COLD_STAGE_IDS } from './_lib/vendasSnapshot.js';

const PAGE = 1000;
const MAX_DAYS = 90;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const supabase = supabaseAdmin();
    const userId = ownerUserId();

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authErr } = token ? await supabase.auth.getUser(token) : { data: null, error: new Error('no token') };
    if (authErr || auth?.user?.id !== userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const today = dayKeySaoPaulo();
    const days = Math.min(MAX_DAYS, Math.max(1, Number(req.query?.days) || 30));
    const since = new Date(Date.now() - (days + 1) * 86400000);
    const sinceKey = dayKeySaoPaulo(since);

    let ensured = false;
    const { count: todayRows } = await supabase
      .from('deal_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('day', today);
    if (!todayRows) {
      await takeSnapshot();
      ensured = true;
    }

    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('deal_snapshots')
        .select('day, deal_id, deal_name, stage_id, stage_label, entered_stage_at, taken_at')
        .eq('user_id', userId)
        .gte('day', sinceKey)
        .order('day', { ascending: true })
        .order('deal_id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...data);
      if (data.length < PAGE) break;
    }

    // day → stage_id → { n, names[] }, and today's deals.
    const byDay = new Map();
    const labels = {};
    const todayDeals = [];
    let takenAt = null;
    for (const r of rows) {
      labels[r.stage_id] = r.stage_label;
      const day = byDay.get(r.day) || {};
      const st = day[r.stage_id] || { n: 0, names: [] };
      st.n += 1;
      if (r.day === today || !COLD_STAGE_IDS.includes(r.stage_id)) st.names.push(r.deal_name);
      day[r.stage_id] = st;
      byDay.set(r.day, day);
      if (r.day === today) {
        todayDeals.push({ id: r.deal_id, name: r.deal_name, stage: r.stage_id, enteredAt: r.entered_stage_at });
        if (!takenAt || r.taken_at > takenAt) takenAt = r.taken_at;
      }
    }

    res.status(200).json({
      today,
      ensured,
      takenAt,
      labels,
      days: [...byDay.entries()].map(([day, stages]) => ({ day, stages })),
      todayDeals,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not load the sales funnel.' });
  }
}
