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
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
