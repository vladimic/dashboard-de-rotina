import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Supabase caps a single select at 1000 rows; the full weight history can be
// several thousand, so it's read in pages.
const PAGE_SIZE = 1000;

// Apple Health samples of one type (pushed by the "Sincronizar Saúde"
// Shortcut through /api/health-webhook), read straight from Supabase with
// the logged-in session — RLS limits it to this user's own rows. `days`
// limits it to the recent past (sleep only charts the last 30 nights).
export function useHealthSamples(type, days = 0) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase.from('health_samples').select('start_at, end_at, value, unit, source').eq('type', type);
        if (days) query = query.gte('start_at', new Date(Date.now() - days * 86400000).toISOString());
        const { data, error: err } = await query.order('start_at', { ascending: true }).range(from, from + PAGE_SIZE - 1);
        if (err) throw new Error(err.message);
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
      }
      setSamples(
        all.map((r) => ({
          t: new Date(r.start_at).getTime(),
          end: r.end_at ? new Date(r.end_at).getTime() : null,
          value: r.value,
          unit: r.unit,
          source: r.source,
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type, days]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { samples, loading, error, refresh };
}
