import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { dashboardReducer } from './dashboardReducer';
import { createSeedState } from '../data/seedData';
import { supabase } from '../lib/supabaseClient';

const SAVE_DEBOUNCE_MS = 600;

// View-only fields that always start fresh when the dashboard is opened,
// regardless of what the last session left saved (e.g. the Agenda always
// opens on today, even if it was left on "amanhã").
const OPEN_RESET = { agendaDay: 'hoje' };

function cacheKey(userId) {
  return `dashboard-de-rotina/state/v1/${userId}`;
}

// Merged with createSeedState() so a cache saved before a new field existed
// (e.g. an older session, from before this session's feature work) can't
// leave that field undefined on the very first paint, ahead of the
// Supabase fetch below (which already merges the same way).
function loadCache(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? { ...createSeedState(), ...JSON.parse(raw), ...OPEN_RESET } : null;
  } catch {
    return null;
  }
}

const LOAD_ATTEMPTS = 3;
const LOAD_RETRY_MS = 1500;
const HISTORY_KEEP_DAYS = 90;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reads the saved row, retrying transient failures. Returns
// { ok: true, data } — data is null only when the read worked and the user
// really has no row yet — or { ok: false, error } when every attempt failed.
// A failed read must never be mistaken for "no row": that was how a flaky
// connection used to replace the saved state with the sample seed.
async function fetchSavedState(userId) {
  let lastError = null;
  for (let attempt = 0; attempt < LOAD_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(LOAD_RETRY_MS * attempt);
    const { data, error } = await supabase
      .from('dashboard_state')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error) return { ok: true, data: data?.data ?? null };
    lastError = error;
  }
  return { ok: false, error: lastError };
}

// Best-effort daily copy of the state in `dashboard_state_history`
// (supabase/dashboard_state_history.sql), so one bad save is never the only
// copy. Never blocks or breaks the dashboard if the table isn't there.
export async function saveHistorySnapshot(userId, data, source = 'daily') {
  try {
    const { error } = await supabase
      .from('dashboard_state_history')
      .insert({ user_id: userId, data, source });
    if (error) console.warn('Could not save state snapshot:', error.message);
  } catch (e) {
    console.warn('Could not save state snapshot:', e);
  }
}

async function snapshotOncePerDay(userId, data) {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: rows, error } = await supabase
      .from('dashboard_state_history')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'daily')
      .gte('created_at', startOfDay.toISOString())
      .limit(1);
    if (error || rows?.length) return;
    await saveHistorySnapshot(userId, data, 'daily');
    const cutoff = new Date(Date.now() - HISTORY_KEEP_DAYS * 86400000).toISOString();
    await supabase.from('dashboard_state_history').delete().eq('user_id', userId).lt('created_at', cutoff);
  } catch (e) {
    console.warn('Daily snapshot skipped:', e);
  }
}

// Loads/saves dashboard state from Supabase (source of truth, shared across
// devices), with a per-user localStorage cache for instant paint. The
// dashboard only becomes editable once the saved state was read
// successfully (or confirmed not to exist); on a failed read it stays in the
// 'error' status and writes nothing — neither to Supabase nor to the cache.
export function useDashboardState(userId) {
  const [state, dispatch] = useReducer(
    dashboardReducer,
    undefined,
    () => loadCache(userId) || createSeedState()
  );
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadAttempt, setLoadAttempt] = useState(0);
  const saveTimer = useRef(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    skipNextSave.current = true;

    (async () => {
      const result = await fetchSavedState(userId);
      if (cancelled) return;

      if (!result.ok) {
        console.error('Failed to load dashboard state:', result.error);
        setStatus('error');
        return;
      }

      if (result.data) {
        dispatch({ type: 'HYDRATE', state: { ...createSeedState(), ...result.data, ...OPEN_RESET } });
        snapshotOncePerDay(userId, result.data);
      } else {
        // Confirmed first use: create the row, but never overwrite one that
        // another device created in the meantime.
        const seed = createSeedState();
        dispatch({ type: 'HYDRATE', state: seed });
        const { error: insertError } = await supabase
          .from('dashboard_state')
          .upsert({ user_id: userId, data: seed }, { onConflict: 'user_id', ignoreDuplicates: true });
        if (insertError) {
          console.error('Failed to create dashboard state row:', insertError);
          if (!cancelled) setStatus('error');
          return;
        }
      }
      if (!cancelled) setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, loadAttempt]);

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
    const result = await fetchSavedState(userId);
    if (!result.ok) {
      console.error('Failed to refresh dashboard state:', result.error);
      return;
    }
    if (result.data) {
      skipNextSave.current = true;
      dispatch({ type: 'HYDRATE', state: { ...createSeedState(), ...result.data } });
    }
  }, [userId]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  return [state, dispatch, status, refresh, retryLoad];
}
