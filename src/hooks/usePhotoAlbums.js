import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const CHUNK = 500;

// Albums of the latest import (table photo_albums, RLS keeps it to this user).
// `save` writes an import day: new rows are upserted, then rows of that day from
// an earlier import (albums that are gone) are removed — never the other way.
export function usePhotoAlbums() {
  const [state, setState] = useState({ day: null, importedAt: null, albums: [] });
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
        setState({ day: null, importedAt: null, albums: [] });
        return;
      }
      const { data, error: e2 } = await supabase.from('photo_albums').select('album, items, bytes, imported_at').eq('day', last[0].day).limit(5000);
      if (e2) throw new Error(e2.message);
      setState({
        day: last[0].day,
        importedAt: data.reduce((m, r) => (r.imported_at > m ? r.imported_at : m), ''),
        albums: data.map((r) => ({ name: r.album, items: r.items, bytes: Number(r.bytes) })),
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
    async (day, albums) => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user?.id;
      if (!userId) throw new Error('Sessão expirada: entre de novo.');
      const stamp = new Date().toISOString();
      const rows = albums.map((a) => ({ user_id: userId, day, album: a.name, items: a.items, bytes: a.bytes, imported_at: stamp }));
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
