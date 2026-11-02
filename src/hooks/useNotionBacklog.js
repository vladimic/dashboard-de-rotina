import { useCallback, useEffect, useRef, useState } from 'react';

// Every open Notion task counted by category / project and by where its
// deadline falls, from /api/notion-tasks?scope=backlog. Loads once, the first
// time it is enabled (the Backlog tab was opened), then only on refresh(); the
// data on screen stays while a refresh runs.
export function useNotionBacklog(enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/notion-tasks?scope=backlog&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load the Notion backlog');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !started.current) {
      started.current = true;
      load();
    }
  }, [enabled, load]);

  return { data, loading, refreshing, error, refresh: load };
}
