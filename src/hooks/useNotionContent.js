import { useCallback, useEffect, useRef, useState } from 'react';

// Every "Conteúdo Digital" idea by Status and Responsável, from
// /api/notion-tasks?scope=content. Loads once when enabled, then on refresh();
// the data on screen stays while a refresh runs.
export function useNotionContent(enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/notion-tasks?scope=content&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load Conteúdo Digital');
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
