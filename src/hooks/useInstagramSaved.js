import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { dateKeySaoPaulo } from '../utils/format';

const HISTORY_DAYS = 400;
const CHUNK = 500;

// Daily imports of the saved Instagram posts (table instagram_saved, read as
// counts through the instagram_saved_daily view — RLS keeps it to this user).
// `previewDiff` compares a file with the previous import; `save` writes it.
export function useInstagramSaved() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const since = dateKeySaoPaulo(new Date(Date.now() - HISTORY_DAYS * 86400000));
      const { data, error: err } = await supabase.from('instagram_saved_daily').select('day, category, n, imported_at').gte('day', since).order('day', { ascending: true });
      if (err) throw new Error(err.message);
      const byDay = new Map();
      for (const r of data) {
        const d = byDay.get(r.day) || { day: r.day, counts: { none: 0, inbox: 0, backlog: 0 }, importedAt: r.imported_at };
        d.counts[r.category] = r.n;
        if (r.imported_at > d.importedAt) d.importedAt = r.imported_at;
        byDay.set(r.day, d);
      }
      setImports([...byDay.values()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Links of the import before `day`, to tell what is new and what left.
  const previewDiff = useCallback(
    async (day, rows) => {
      const prev = [...imports].reverse().find((i) => i.day < day);
      if (!prev) return null;
      const { data, error: err } = await supabase.from('instagram_saved').select('link').eq('day', prev.day).limit(5000);
      if (err) throw new Error(err.message);
      const before = new Set(data.map((r) => r.link));
      const now = new Set(rows.map((r) => r.link));
      return { since: prev.day, prevTotal: Object.values(prev.counts).reduce((a, b) => a + b, 0), added: rows.filter((r) => !before.has(r.link)).length, left: [...before].filter((l) => !now.has(l)).length };
    },
    [imports]
  );

  // Writes the day: new rows are upserted, then the day's rows from an earlier
  // import (posts that are gone) are removed — never the other way round.
  const save = useCallback(
    async (day, rows) => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user?.id;
      if (!userId) throw new Error('Sessão expirada: entre de novo.');
      const stamp = new Date().toISOString();
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, user_id: userId, day, imported_at: stamp }));
        const { error: err } = await supabase.from('instagram_saved').upsert(chunk, { onConflict: 'user_id,day,link' });
        if (err) throw new Error(err.message);
      }
      const { error: delErr } = await supabase.from('instagram_saved').delete().eq('day', day).lt('imported_at', stamp);
      if (delErr) throw new Error(delErr.message);
      await refresh();
    },
    [refresh]
  );

  return { imports, loading, refreshing, error, refresh, previewDiff, save };
}
