import { useCallback, useEffect, useState } from 'react';

const EMPTY = { tasks: [], updatedAt: null };

// Fetches Notion tasks due today or overdue from the /api/notion-tasks
// serverless function, which authenticates to the Notion API. The
// integration token stays server-side.
export function useNotionTasks() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notion-tasks?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load Notion tasks');
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
