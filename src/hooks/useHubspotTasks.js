import { useCallback, useEffect, useState } from 'react';

const EMPTY = { groups: [], vencidas: 0, hoje: 0, updatedAt: null };

// Fetches overdue + due-today HubSpot tasks (grouped by deal pipeline stage)
// from the /api/hubspot-tasks serverless function. The HubSpot token stays
// server-side; this hook only ever talks to our own API route.
export function useHubspotTasks() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(EMPTY);
    try {
      const res = await fetch(`/api/hubspot-tasks?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load HubSpot tasks');
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
