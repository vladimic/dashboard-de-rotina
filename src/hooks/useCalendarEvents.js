import { useCallback, useEffect, useState } from 'react';

const EMPTY = { agenda: [], agendaTomorrow: [], updatedAt: null };

// Fetches today's + tomorrow's events from the /api/calendar-events
// serverless function, which reads the user's published iCloud calendar.
export function useCalendarEvents() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar-events?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load calendar events');
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
