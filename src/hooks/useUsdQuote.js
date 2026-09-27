import { useCallback, useEffect, useState } from 'react';

const AUTO_REFRESH_MS = 60 * 60 * 1000;

const EMPTY = { current: null, series: [], updatedAt: null };

// Fetches the USD/BRL quote + historical daily closes from the
// /api/usd-quote serverless function. On mount, on manual refresh, and
// automatically every hour — unlike the other summary cards, which only
// refresh when asked, the quote keeps itself current while the tab is open.
export function useUsdQuote() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usd-quote?t=${Date.now()}`, { cache: 'no-store' });
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
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
