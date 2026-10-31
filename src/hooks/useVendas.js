import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Daily photos of the sales funnel, from /api/vendas (protected by the
// logged-in session's token). The server takes today's photo when it's missing.
export function useVendas(days = 90) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      const res = await fetch(`/api/vendas?days=${days}&t=${Date.now()}`, {
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
    }
  }, [days]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
