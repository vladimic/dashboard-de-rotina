import { useCallback, useEffect, useState } from 'react';

const EMPTY = { vencidas: [], hojeSemHorario: [], hojeComHorario: [], updatedAt: null };

// Fetches Apple Reminders (overdue / due-today) from the /api/reminders
// serverless function, which authenticates to iCloud's CalDAV server. The
// Apple ID + app-specific password stay server-side.
export function useReminders() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reminders?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load reminders');
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
