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
import { formatTodayLong, formatClock, syncRemindersShortcutUrl } from './utils/format';
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
  const syncedOnLoadRef = useRef(false);
  useEffect(() => {
    if (syncedOnLoadRef.current) return;
    syncedOnLoadRef.current = true;
    syncReminders();
  }, [syncReminders]);

  // First load of the day only — ask before wiping Starting Day/Ending Day.
  // Saying no leaves them exactly as-is until tomorrow's prompt.
  const askedRef = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || askedRef.current) return;
    const todayKey = new Date().toDateString();
    if (state.lastResetDate === todayKey) return;
    askedRef.current = true;
    (async () => {
      const reset = await confirm('Reiniciar as checklists "Starting Day" e "Ending Day" de hoje?', 'Reiniciar', 'Deixar como está');
      dispatch({ type: 'APPLY_DAILY_RESET', reset });
    })();
  }, [status, state.lastResetDate, confirm, dispatch]);

  const agenda = computeAgenda(state, calendar);
  const counts = computeCounts(
    state,
    hubspot.vencidas + hubspot.hoje + dealsWithoutTasks.total,
    reminders.total,
    notion.total,
    ticktick.total
  );
  useAppBadge(counts.geralTotal);
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
