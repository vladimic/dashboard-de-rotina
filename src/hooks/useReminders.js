import { useCallback, useEffect, useRef, useState } from 'react';

const EMPTY = { groups: [], total: 0, updatedAt: null };

// A single "sync" (button tap, or returning from the Shortcut) fires refresh
// several times in quick succession on purpose — see DashboardApp.jsx — to
// make sure the data lands even if one trigger is unreliable. Calls within
// this window of each other are the same sync attempt, not independent
// requests, so they're coalesced into one fetch.
const MIN_REFRESH_INTERVAL_MS = 2000;

// Fetches Apple Reminders (overdue / due-today) from the /api/reminders
// serverless function, which authenticates to iCloud's CalDAV server. The
// Apple ID + app-specific password stay server-side.
export function useReminders() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < MIN_REFRESH_INTERVAL_MS) return;
    lastRefreshAtRef.current = now;
    setLoading(true);
    setError(null);
    // Keep showing the last-known list while this fetch is in flight —
    // clearing to EMPTY here made the card flash empty and re-populate on
    // every background refresh, resetting whatever the user had expanded.
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
