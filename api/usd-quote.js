// Vercel serverless function. Fetches the USD/BRL quote (current + daily
// closes for the last year) from AwesomeAPI (economia.awesomeapi.com.br) —
// a free, key-less market data API. UOL's own cambio page was the original
// target, but it sits behind an Akamai WAF that returns a 403 "Access
// Denied" to any non-browser request (confirmed even with a real browser
// User-Agent), so it can't be scraped reliably from a serverless function.
// AwesomeAPI tracks the same underlying market rate.

export default async function handler(req, res) {
  // Vercel's serverless functions share outbound IPs across many unrelated
  // projects, so AwesomeAPI's rate limit (429) can trip from barely any
  // traffic of our own. Letting Vercel's edge cache this response for a few
  // minutes — instead of "no-store" — cuts real upstream calls down to
  // roughly one per window regardless of how often the dashboard is opened
  // or the refresh button is clicked; stale-while-revalidate keeps serving
  // the last good quote instead of erroring while a fresh one is fetched in
  // the background. A stale-by-a-few-minutes FX quote is fine for this use.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');

  try {
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

    res.status(200).json({
      updatedAt: Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : new Date().toISOString(),
      current: {
        bid: Number(quote.bid),
        pctChange: Number(quote.pctChange),
      },
      series,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error fetching USD quote.' });
  }
}
