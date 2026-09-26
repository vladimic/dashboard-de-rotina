import { useCallback, useEffect, useState } from 'react';

const EMPTY = { current: null, series: [], updatedAt: null };

// Fetches the USD/BRL quote + historical daily closes from the
// /api/usd-quote serverless function. Only on mount (dashboard open) and
// on manual refresh — no polling interval, per the header's "atualizado
// quando eu quiser" behavior shared with the other summary cards.
export function useUsdQuote() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No cache-busting query param here (unlike the other hooks) — the
      // stable URL is what lets Vercel's edge cache shield the AwesomeAPI
      // rate limit (see api/usd-quote.js). "Refresh" still re-renders with
      // whatever's currently cached; a genuinely new quote shows up once
      // that cache window rolls over.
      const res = await fetch('/api/usd-quote');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load USD quote');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
