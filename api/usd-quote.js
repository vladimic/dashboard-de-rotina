// Vercel serverless function. Fetches the USD/BRL quote (current + daily
// closes for the last year) from the Banco Central do Brasil's own PTAX
// API (olinda.bcb.gov.br) — the official Brazilian exchange rate, published
// once per business day. Two other sources were tried first: UOL's cambio
// page sits behind an Akamai WAF that 403s any non-browser request, and
// AwesomeAPI (a free third-party aggregator) rate-limited (429) every
// single call from this deployment — Vercel functions share outbound IPs
// across many unrelated projects, so that 429 likely wasn't even about our
// own traffic. BCB's API is free, key-less, and has shown no such issue.
//
// Still cached in Supabase (same pattern as reminders_cache) so a burst of
// page loads/refreshes doesn't turn into a burst of upstream calls, and a
// transient failure falls back to the last known-good quote instead of
// erroring outright.

import { createClient } from '@supabase/supabase-js';

const CACHE_TTL_MS = 5 * 60 * 1000;

function fmtMMDDYYYY(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}-${dd}-${date.getFullYear()}`;
}

async function fetchFresh() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 370); // comfortably covers 365 days of trading data

  const url =
    'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)' +
    `?@dataInicial='${fmtMMDDYYYY(start)}'&@dataFinalCotacao='${fmtMMDDYYYY(today)}'&$top=1000&$format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`BCB PTAX failed (${res.status})`);
  const json = await res.json();
  const rows = json.value || [];
  if (rows.length === 0) throw new Error('BCB PTAX returned no data.');

  // dataHoraCotacao is already "YYYY-MM-DD HH:mm:ss..." in Brasília local
  // time (BCB is a Brazilian government service), so the first 10 chars
  // are the date key directly — no timezone conversion needed.
  const series = rows
    .map((r) => ({ date: r.dataHoraCotacao.slice(0, 10), bid: Number(r.cotacaoVenda) }))
    .filter((p) => Number.isFinite(p.bid));

  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const pctChange = prev ? ((last.bid - prev.bid) / prev.bid) * 100 : 0;

  return {
    updatedAt: new Date().toISOString(),
    current: { bid: last.bid, pctChange },
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
      // BCB failed — serve the last known-good quote instead of erroring
      // outright, even if it's older than the TTL.
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
