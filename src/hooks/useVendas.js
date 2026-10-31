import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Daily photos of the sales funnel, from /api/vendas (protected by the
// logged-in session's token). Loads once, the first time it's enabled (the
// Vendas tab was opened) and then only when `refresh()` is called (the card
// buttons / "Atualizar tudo"), which also takes a new photo of now. The data
// on screen stays while a refresh is running.
export function useVendas(days = 90, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const started = useRef(false);

  const load = useCallback(
    async (force) => {
      setRefreshing(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getSession();
        const token = auth.session?.access_token;
        const res = await fetch(`/api/vendas?days=${days}${force ? '&refresh=1' : ''}&t=${Date.now()}`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load the sales funnel');
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days]
  );

  useEffect(() => {
    if (enabled && !started.current) {
      started.current = true;
      load(false);
    }
  }, [enabled, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, refreshing, error, refresh };
}
