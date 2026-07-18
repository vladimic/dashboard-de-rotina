import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { dashboardReducer } from './dashboardReducer';
import { createSeedState } from '../data/seedData';
import { supabase } from '../lib/supabaseClient';

const SAVE_DEBOUNCE_MS = 600;

function cacheKey(userId) {
  return `dashboard-de-rotina/state/v1/${userId}`;
}

function loadCache(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Loads/saves dashboard state from Supabase (source of truth, shared across
// devices), with a per-user localStorage cache for instant paint and offline
// resilience.
export function useDashboardState(userId) {
  const [state, dispatch] = useReducer(
    dashboardReducer,
    undefined,
    () => loadCache(userId) || createSeedState()
  );
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready'
  const saveTimer = useRef(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    skipNextSave.current = true;

    (async () => {
      const { data, error } = await supabase
        .from('dashboard_state')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Failed to load dashboard state:', error);
      }

      if (data?.data) {
        dispatch({ type: 'HYDRATE', state: { ...createSeedState(), ...data.data } });
      } else {
        const seed = createSeedState();
        dispatch({ type: 'HYDRATE', state: seed });
        const { error: upsertError } = await supabase
          .from('dashboard_state')
          .upsert({ user_id: userId, data: seed }, { onConflict: 'user_id' });
        if (upsertError) console.error('Failed to create dashboard state row:', upsertError);
      }
      dispatch({ type: 'MAYBE_DAILY_RESET' });
      if (!cancelled) setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (status !== 'ready') return;
    localStorage.setItem(cacheKey(userId), JSON.stringify(state));

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase
        .from('dashboard_state')
        .upsert(
          { user_id: userId, data: state, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save dashboard state:', error);
        });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(saveTimer.current);
  }, [state, status, userId]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('dashboard_state')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to refresh dashboard state:', error);
      return;
    }
    if (data?.data) {
      skipNextSave.current = true;
      dispatch({ type: 'HYDRATE', state: { ...createSeedState(), ...data.data } });
    }
  }, [userId]);

  return [state, dispatch, status, refresh];
}
