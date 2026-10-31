// Vercel serverless function behind the Vendas tab. Requires the logged-in
// user's Supabase token ("Authorization: Bearer <access token>") and only
// answers for the owner of the photos. If today's photo is missing it takes
// one first (the 23h cron overwrites it later with the day's final one).
//
// With ?snapshot=1 it is the Vercel cron (see vercel.json) that takes the day's
// final photo at ~23h São Paulo instead. When CRON_SECRET is set on the
// project Vercel sends it as "Authorization: Bearer <secret>" and anything
// else is refused; without it only Vercel's cron user agent is accepted.
// (One file for both: Vercel's free plan allows 12 functions per deployment.)
//
// With ?refresh=1 (the refresh button / "Atualizar tudo") it takes a new
// photo of now, replacing today's.
//
// Returns the last `days` photos as counts per stage, plus today's deals
// (stage + when they entered it, for the days-in-stage column).

import { takeSnapshot, supabaseAdmin, ownerUserId, dayKeySaoPaulo } from './_lib/vendasSnapshot.js';

const PAGE = 1000;
const MAX_DAYS = 90;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.query?.snapshot === '1') {
    const secret = process.env.CRON_SECRET;
    const fromCron = String(req.headers['user-agent'] || '').startsWith('vercel-cron/');
    if (!(secret ? req.headers.authorization === `Bearer ${secret}` : fromCron)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      // The scheduled run is the day's final photo: it replaces an earlier one.
      res.status(200).json(await takeSnapshot({ force: true }));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Could not take the photo.' });
    }
    return;
  }

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
    if (req.query?.refresh === '1') {
      await takeSnapshot({ force: true });
      ensured = true;
    } else if (!todayRows) {
      await takeSnapshot();
      ensured = true;
    }

    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('deal_snapshots')
        .select('day, deal_id, stage_id, stage_label, entered_stage_at, taken_at')
        .eq('user_id', userId)
        .gte('day', sinceKey)
        .order('day', { ascending: true })
        .order('deal_id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...data);
      if (data.length < PAGE) break;
    }

    // day → stage_id → { n }, and today's deals.
    const byDay = new Map();
    const labels = {};
    const todayDeals = [];
    let takenAt = null;
    for (const r of rows) {
      labels[r.stage_id] = r.stage_label;
      const day = byDay.get(r.day) || {};
      const st = day[r.stage_id] || { n: 0 };
      st.n += 1;
      day[r.stage_id] = st;
      byDay.set(r.day, day);
      if (r.day === today) {
        todayDeals.push({ id: r.deal_id, stage: r.stage_id, enteredAt: r.entered_stage_at });
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
