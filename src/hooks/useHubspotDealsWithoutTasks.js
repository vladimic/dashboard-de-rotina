import { useCallback, useEffect, useState } from 'react';

const EMPTY = { groups: [], total: 0, updatedAt: null };

// Fetches deals with no open task, grouped by pipeline stage, from the
// /api/hubspot-deals-without-tasks serverless function.
export function useHubspotDealsWithoutTasks() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hubspot-deals-without-tasks?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load deals without tasks');
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
