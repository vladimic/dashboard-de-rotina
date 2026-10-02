import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Supabase caps a single select at 1000 rows; the full weight history can be
// several thousand, so it's read in pages.
const PAGE_SIZE = 1000;

// Apple Health samples of one type (pushed by the "Sincronizar Saúde"
// Shortcut through /api/health-webhook), read straight from Supabase with
// the logged-in session — RLS limits it to this user's own rows.
export function useHealthSamples(type) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error: err } = await supabase
          .from('health_samples')
          .select('start_at, value, source')
          .eq('type', type)
          .order('start_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (err) throw new Error(err.message);
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
      }
      setSamples(all.map((r) => ({ t: new Date(r.start_at).getTime(), value: r.value, source: r.source })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { samples, loading, error, refresh };
}
