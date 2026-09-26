// Vercel serverless function. Fetches the USD/BRL quote (live commercial
// rate + daily closes for the last year) from Yahoo Finance's chart API
// (query1.finance.yahoo.com, symbol "USDBRL=X") — unofficial/undocumented
// but very widely used (the yfinance Python library and countless personal
// finance tools rely on the same endpoint), free, no key.
//
// Two other sources were tried first and ruled out: UOL's cambio page sits
// behind an Akamai WAF that 403s any non-browser request; the Banco
// Central's PTAX API is official but only a once-a-day average/close, not
// the live traded rate this needs; AwesomeAPI (a free third-party
// aggregator, does offer a live rate) rate-limited (429) every single call
// from this deployment — Vercel functions share outbound IPs across many
// unrelated projects, so that 429 likely wasn't even about our own traffic.
//
// Still cached in Supabase (same pattern as reminders_cache) so a burst of
// page loads/refreshes doesn't turn into a burst of upstream calls, and a
// transient failure falls back to the last known-good quote instead of
// erroring outright.

import { createClient } from '@supabase/supabase-js';

const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchFresh() {
  const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1y', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance failed (${res.status})`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('Unexpected Yahoo Finance response shape.');

  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];

  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  const series = timestamps
    .map((t, i) => ({ date: dtf.format(new Date(t * 1000)), bid: closes[i] }))
    .filter((p) => Number.isFinite(p.bid));

  if (!Number.isFinite(meta.regularMarketPrice)) throw new Error('Unexpected Yahoo Finance meta shape.');

  return {
    updatedAt: new Date().toISOString(),
    current: {
      bid: Number(meta.regularMarketPrice),
      pctChange: Number(meta.regularMarketChangePercent) || 0,
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
      // Yahoo Finance failed — serve the last known-good quote instead of
      // erroring outright, even if it's older than the TTL.
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
