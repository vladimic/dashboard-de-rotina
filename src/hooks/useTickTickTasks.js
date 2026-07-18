import { useCallback, useEffect, useState } from 'react';

const EMPTY = { groups: [], total: 0, updatedAt: null, notConnected: false };

// Fetches TickTick tasks due today or overdue, grouped by project, from the
// /api/ticktick-tasks serverless function, which reads the OAuth token
// stored by api/ticktick-auth-callback.js. The token stays server-side.
export function useTickTickTasks() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(EMPTY);
    try {
      const res = await fetch(`/api/ticktick-tasks?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load TickTick tasks');
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
