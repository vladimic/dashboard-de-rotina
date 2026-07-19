import { useCallback, useEffect, useRef } from 'react';
import { useDashboardState } from './state/useDashboardState';
import { useConfirm } from './components/ConfirmContext';
import { useHubspotTasks } from './hooks/useHubspotTasks';
import { useHubspotDealsWithoutTasks } from './hooks/useHubspotDealsWithoutTasks';
import { useCalendarEvents } from './hooks/useCalendarEvents';
import { useReminders } from './hooks/useReminders';
import { useNotionTasks } from './hooks/useNotionTasks';
import { useTickTickTasks } from './hooks/useTickTickTasks';
import { useAppBadge } from './hooks/useAppBadge';
import { computeAgenda, computeCounts, computeHabits, computeSleepWeek, computeGoals } from './utils/derived';
import { formatTodayLong, formatClock, syncRemindersShortcutUrl, currentWeekResetKey } from './utils/format';
import Header from './components/Header';
import SummaryStrip from './components/SummaryStrip';
import HojeView from './views/HojeView';
import SaudeView from './views/SaudeView';
import BacklogView from './views/BacklogView';
import styles from './App.module.css';

const CARD_BG = {
  hoje: '#fbf7f2',
  saude: '#f2f8f4',
  backlog: '#f6f1fb',
};

export default function DashboardApp({ userId, userEmail, onSignOut }) {
  const [state, dispatch, status] = useDashboardState(userId);
  const hubspot = useHubspotTasks();
  const dealsWithoutTasks = useHubspotDealsWithoutTasks();
  const calendar = useCalendarEvents();
  const reminders = useReminders();
  const notion = useNotionTasks();
  const ticktick = useTickTickTasks();
  const confirm = useConfirm();

  // Fires the Atalho, re-fetches the cache it just filled, and polls a few
  // more times afterward since coming back to this tab doesn't reliably
  // trigger a visibilitychange event on every OS/browser combo.
  const refreshReminders = reminders.refresh;
  const syncReminders = useCallback(() => {
    refreshReminders();
    window.location.href = syncRemindersShortcutUrl();
    [3000, 6000, 10000, 15000].forEach((delay) => setTimeout(refreshReminders, delay));
  }, [refreshReminders]);

  // Also catches the moment the round-trip to the Atalhos app returns here.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refreshReminders();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshReminders]);

  // Force a sync as soon as the dashboard opens, not just on manual clicks.
  // Gated by a localStorage timestamp (not just the ref below) because the
  // Atalho's x-success round-trip can land on a brand-new window/tab (seen
  // on Mac) — a fresh mount there would otherwise re-trigger this effect,
  // re-run the Atalho, and loop forever across new windows.
  const AUTO_SYNC_COOLDOWN_MS = 60000;
  const syncedOnLoadRef = useRef(false);
  useEffect(() => {
    if (syncedOnLoadRef.current) return;
    syncedOnLoadRef.current = true;
    const lastAutoSyncAt = Number(localStorage.getItem('reminders:lastAutoSyncAt') || 0);
    if (Date.now() - lastAutoSyncAt < AUTO_SYNC_COOLDOWN_MS) return;
    localStorage.setItem('reminders:lastAutoSyncAt', String(Date.now()));
    syncReminders();
  }, [syncReminders]);

  // ?forceReset=1 bypasses the "already done today/this week" gates below —
  // a one-off manual trigger, not something meant to stay in a bookmark.
  const forceReset = new URLSearchParams(window.location.search).get('forceReset') === '1';

  // First load of the day only — ask before wiping Starting Day/Ending Day.
  // Saying no leaves them exactly as-is until tomorrow's prompt.
  const askedRef = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || askedRef.current) return;
    const todayKey = new Date().toDateString();
    if (!forceReset && state.lastResetDate === todayKey) return;
    askedRef.current = true;
    (async () => {
      const reset = await confirm('Reiniciar as checklists "Starting Day" e "Ending Day" de hoje?', 'Reiniciar', 'Deixar como está');
      dispatch({ type: 'APPLY_DAILY_RESET', reset });
    })();
  }, [status, state.lastResetDate, confirm, dispatch, forceReset]);

  // First load after the Friday-14:00 boundary passes — ask before wiping
  // "Ending Week". Saying no leaves it as-is until next week's prompt.
  const weekAskedRef = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || weekAskedRef.current) return;
    const weekKey = currentWeekResetKey();
    if (state.lastWeekResetDate === weekKey) return;
    weekAskedRef.current = true;
    (async () => {
      const reset = await confirm('Reiniciar a checklist "Ending Week" desta semana?', 'Reiniciar', 'Deixar como está');
      dispatch({ type: 'APPLY_WEEK_RESET', reset, key: weekKey });
    })();
  }, [status, state.lastWeekResetDate, confirm, dispatch]);

  const anyLoading =
    status !== 'ready' ||
    hubspot.loading ||
    dealsWithoutTasks.loading ||
    calendar.loading ||
    reminders.loading ||
    notion.loading ||
    ticktick.loading;

  const agenda = computeAgenda(state, calendar);
  const counts = computeCounts(
    state,
    hubspot.vencidas + hubspot.hoje + dealsWithoutTasks.total,
    reminders.total,
    notion.total,
    ticktick.total
  );
  useAppBadge(counts.geralTotal);

  // Freezes today's starting workload the first time every source has
  // finished its first load AND at least 16s have passed since mount —
  // /api/reminders resolves fast regardless of freshness, but the
  // sync-on-load Atalho round-trip (see syncReminders) only lands via its
  // own polling through 15s, so waiting on loading flags alone captures a
  // stale Reminders count. A source that's still genuinely loading (e.g.
  // Notion's multi-database query) keeps blocking past that 16s floor —
  // only the 30s ceiling below overrides a source stuck for real.
  const MIN_WAIT_MS = 16000;
  const MAX_WAIT_MS = 30000;
  const allSourcesLoaded =
    status === 'ready' && !hubspot.loading && !dealsWithoutTasks.loading && !reminders.loading && !notion.loading && !ticktick.loading;
  const baselineCapturedRef = useRef(false);
  const geralTotalRef = useRef(counts.geralTotal);
  geralTotalRef.current = counts.geralTotal;
  const mountedAtRef = useRef(Date.now());

  const captureBaseline = useCallback(() => {
    if (baselineCapturedRef.current) return;
    baselineCapturedRef.current = true;
    const todayKey = new Date().toDateString();
    if (!forceReset && state.dayProgressDate === todayKey) return;
    dispatch({ type: 'SET_DAY_PROGRESS_BASELINE', date: todayKey, baseline: geralTotalRef.current });
  }, [state.dayProgressDate, dispatch, forceReset]);

  useEffect(() => {
    if (baselineCapturedRef.current) return undefined;
    let interval;
    const check = () => {
      const elapsed = Date.now() - mountedAtRef.current;
      if ((allSourcesLoaded && elapsed >= MIN_WAIT_MS) || elapsed >= MAX_WAIT_MS) {
        captureBaseline();
        clearInterval(interval);
      }
    };
    check();
    interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [allSourcesLoaded, captureBaseline]);

  const dayProgressBaseline = state.dayProgressDate === new Date().toDateString() ? state.dayProgressBaseline : 0;
  const dayProgressDone = Math.max(0, dayProgressBaseline - counts.geralTotal);
  const dayProgressPercent =
    dayProgressBaseline > 0 ? Math.max(0, Math.min(100, Math.round((dayProgressDone / dayProgressBaseline) * 100))) : 0;
  const habits = computeHabits(state);
  const { sleepWeek, sleepAvg } = computeSleepWeek(state);
  const goals = computeGoals(state);

  const todayLong = formatTodayLong();
  const updatedAt = formatClock(Date.now());

  if (status === 'loading') {
    return (
      <div className={styles.card} style={{ background: CARD_BG.hoje }}>
        <div className={styles.loading}>Carregando seus dados...</div>
      </div>
    );
  }

  return (
    <div className={styles.card} style={{ background: CARD_BG[state.page] }}>
      <Header
        page={state.page}
        todayLong={todayLong}
        updatedAt={updatedAt}
        loading={anyLoading}
        userEmail={userEmail}
        onGoPage={(page) => dispatch({ type: 'GO_PAGE', page })}
        onRefreshAll={() => {
          dispatch({ type: 'REFRESH_ALL' });
          hubspot.refresh();
          dealsWithoutTasks.refresh();
          calendar.refresh();
          reminders.refresh();
          notion.refresh();
          ticktick.refresh();
        }}
        onSignOut={onSignOut}
      />

      <SummaryStrip
        page={state.page}
        counts={counts}
        habits={habits}
        water={state.water}
        waterTarget={state.waterTarget}
        sleepHours={state.sleepHours}
        weight={state.weight}
        lists={{
          lembretesTotal: reminders.total,
          hubspotTasksTotal: hubspot.vencidas + hubspot.hoje,
          hubspotDealsTotal: dealsWithoutTasks.total,
          ticktickTotal: ticktick.total,
          notionTotal: notion.total,
        }}
        dayProgress={{ percent: dayProgressPercent, done: dayProgressDone, total: dayProgressBaseline }}
      />

      {state.page === 'hoje' && (
        <HojeView
          state={state}
          dispatch={dispatch}
          agenda={agenda}
          counts={counts}
          hubspot={hubspot}
          dealsWithoutTasks={dealsWithoutTasks}
          calendar={calendar}
          reminders={reminders}
          onSyncReminders={syncReminders}
          notion={notion}
          ticktick={ticktick}
        />
      )}
      {state.page === 'saude' && (
        <SaudeView state={state} dispatch={dispatch} habits={habits} sleepWeek={sleepWeek} sleepAvg={sleepAvg} goals={goals} />
      )}
      {state.page === 'backlog' && <BacklogView state={state} dispatch={dispatch} />}
    </div>
  );
}
