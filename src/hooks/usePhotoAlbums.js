import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const CHUNK = 500;
// Reserved row: totals of the whole library (albums overlap, so they cannot be summed).
const LIBRARY_ROW = '__biblioteca__';

// Albums of the latest import (table photo_albums, RLS keeps it to this user).
// `save` writes an import day: new rows are upserted, then rows of that day from
// an earlier import (albums that are gone) are removed — never the other way.
export function usePhotoAlbums() {
  const [state, setState] = useState({ day: null, importedAt: null, albums: [], library: null, history: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const { data: last, error: e1 } = await supabase.from('photo_albums').select('day').order('day', { ascending: false }).limit(1);
      if (e1) throw new Error(e1.message);
      if (!last?.length) {
        setState({ day: null, importedAt: null, albums: [], library: null, history: [] });
        return;
      }
      const { data, error: e2 } = await supabase.from('photo_albums').select('album, items, bytes, imported_at').eq('day', last[0].day).limit(5000);
      if (e2) throw new Error(e2.message);
      // One point per import day (the library row): items and bytes over time.
      const { data: hist, error: e3 } = await supabase.from('photo_albums').select('day, items, bytes').eq('album', LIBRARY_ROW).order('day', { ascending: true }).limit(2000);
      if (e3) throw new Error(e3.message);
      setState({
        history: hist.map((r) => ({ day: r.day, items: r.items, bytes: Number(r.bytes) })),
        day: last[0].day,
        importedAt: data.reduce((m, r) => (r.imported_at > m ? r.imported_at : m), ''),
        albums: data.filter((r) => r.album !== LIBRARY_ROW).map((r) => ({ name: r.album, items: r.items, bytes: Number(r.bytes) })),
        library: data.filter((r) => r.album === LIBRARY_ROW).map((r) => ({ items: r.items, bytes: Number(r.bytes) }))[0] ?? null,
      });
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

  const save = useCallback(
    async (day, albums, library = null) => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user?.id;
      if (!userId) throw new Error('Sessão expirada: entre de novo.');
      const stamp = new Date().toISOString();
      const all = library ? [...albums, { name: LIBRARY_ROW, items: library.items, bytes: library.bytes }] : albums;
      const rows = all.map((a) => ({ user_id: userId, day, album: a.name, items: a.items, bytes: a.bytes, imported_at: stamp }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error: err } = await supabase.from('photo_albums').upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,day,album' });
        if (err) throw new Error(err.message);
      }
      const { error: delErr } = await supabase.from('photo_albums').delete().eq('day', day).lt('imported_at', stamp);
      if (delErr) throw new Error(delErr.message);
      await refresh();
    },
    [refresh]
  );

  return { ...state, loading, refreshing, error, refresh, save };
}
