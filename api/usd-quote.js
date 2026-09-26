// Vercel serverless function. Fetches the USD/BRL quote (current + daily
// closes for the last year) from AwesomeAPI (economia.awesomeapi.com.br) —
// a free, key-less market data API. UOL's own cambio page was the original
// target, but it sits behind an Akamai WAF that returns a 403 "Access
// Denied" to any non-browser request (confirmed even with a real browser
// User-Agent), so it can't be scraped reliably from a serverless function.
// AwesomeAPI tracks the same underlying market rate.
//
// AwesomeAPI's free tier rate-limits (429) surprisingly fast — Vercel
// functions share outbound IPs across many unrelated projects, so even
// light traffic from this dashboard alone can trip it. A Vercel edge
// Cache-Control header was tried first, but this project's deployment has
// "Deployment Protection" on, and Vercel doesn't cache responses on
// protected deployments — so instead this caches in Supabase (same
// pattern as reminders_cache): serve straight from cache within
// CACHE_TTL_MS, and on a genuine refetch, fall back to the last cached
// value (even if stale) rather than erroring if AwesomeAPI 429s.

import { createClient } from '@supabase/supabase-js';

const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchFresh() {
  const [lastRes, dailyRes] = await Promise.all([
    fetch('https://economia.awesomeapi.com.br/last/USD-BRL'),
    // 365 daily closes is enough to cover every period the header offers
    // (7/30/90/365d) from one request instead of four.
    fetch('https://economia.awesomeapi.com.br/json/daily/USD-BRL/365'),
  ]);

  if (!lastRes.ok) throw new Error(`AwesomeAPI /last failed (${lastRes.status})`);
  if (!dailyRes.ok) throw new Error(`AwesomeAPI /daily failed (${dailyRes.status})`);

  const lastJson = await lastRes.json();
  const dailyJson = await dailyRes.json();

  const quote = lastJson.USDBRL;
  if (!quote) throw new Error('Unexpected AwesomeAPI /last response shape.');

  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

  // AwesomeAPI returns newest-first; reverse to oldest-first for the chart.
  const series = [...dailyJson]
    .reverse()
    .map((d) => ({ date: dtf.format(new Date(Number(d.timestamp) * 1000)), bid: Number(d.bid) }))
    .filter((p) => Number.isFinite(p.bid));

  const timestampMs = Number(quote.timestamp) * 1000;

  return {
    updatedAt: Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : new Date().toISOString(),
    current: {
      bid: Number(quote.bid),
      pctChange: Number(quote.pctChange),
    },
    series,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured on the server.' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: row, error: readError } = await supabase
      .from('usd_quote_cache')
      .select('data, updated_at')
      .eq('id', 'default')
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const ageMs = row?.updated_at ? Date.now() - new Date(row.updated_at).getTime() : Infinity;
    if (row?.data && ageMs < CACHE_TTL_MS) {
      res.status(200).json(row.data);
      return;
    }

    try {
      const payload = await fetchFresh();
      const { error: writeError } = await supabase
        .from('usd_quote_cache')
        .upsert({ id: 'default', data: payload, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (writeError) console.error('Failed to cache USD quote:', writeError.message);
      res.status(200).json(payload);
    } catch (fetchErr) {
      // AwesomeAPI failed (e.g. 429) — serve the last known-good quote
      // instead of erroring outright, even if it's older than the TTL.
      if (row?.data) {
        res.status(200).json(row.data);
        return;
      }
      throw fetchErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching USD quote.' });
  }
}
