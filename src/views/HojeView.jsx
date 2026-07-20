import { useCallback } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import AgendaCard from '../components/AgendaCard';
import MeuDiaCard from '../components/MeuDiaCard';
import HabitTrackerCard from '../components/HabitTrackerCard';
import ChecklistCard from '../components/ChecklistCard';
import HubSpotCard from '../components/HubSpotCard';
import HubSpotDealsWithoutTasksCard from '../components/HubSpotDealsWithoutTasksCard';
import GroupedTaskCard from '../components/GroupedTaskCard';
import {
  formatClock,
  FANTASTICAL_APP_URL,
  REMINDERS_APP_URL,
  NOTION_WEEKLY_APP_URL,
  TICKTICK_APP_URL,
} from '../utils/format';
import styles from './HojeView.module.css';

function useChecklistHandlers(dispatch, listKey, editKey, openKey, newTextKey, newLinkKey, confirm) {
  return {
    onToggleOpen: useCallback(() => dispatch({ type: 'TOGGLE_FLAG', key: openKey }), [dispatch, openKey]),
    onToggleEdit: useCallback(() => dispatch({ type: 'TOGGLE_FLAG', key: editKey }), [dispatch, editKey]),
    onToggleItem: useCallback((id) => dispatch({ type: 'TOGGLE_LIST_ITEM', listKey, id }), [dispatch, listKey]),
    onUpdateText: useCallback((id, value) => dispatch({ type: 'UPDATE_ITEM_TEXT', listKey, id, value }), [dispatch, listKey]),
    onUpdateLink: useCallback((id, value) => dispatch({ type: 'UPDATE_ITEM_LINK', listKey, id, value }), [dispatch, listKey]),
    onRemoveItem: useCallback(
      async (id) => {
        if (!(await confirm('Remover este item?'))) return;
        dispatch({ type: 'REMOVE_ITEM', listKey, id });
      },
      [dispatch, listKey, confirm]
    ),
    onDragStart: useCallback((id) => dispatch({ type: 'DRAG_START', listKey, id }), [dispatch, listKey]),
    onDrop: useCallback((targetId) => dispatch({ type: 'DROP_ON', listKey, targetId }), [dispatch, listKey]),
    onNewTextChange: useCallback((value) => dispatch({ type: 'SET_TEXT_FIELD', key: newTextKey, value }), [dispatch, newTextKey]),
    onNewLinkChange: useCallback((value) => dispatch({ type: 'SET_TEXT_FIELD', key: newLinkKey, value }), [dispatch, newLinkKey]),
    onAddItem: useCallback(
      () => dispatch({ type: 'ADD_LIST_ITEM', listKey, textKey: newTextKey, linkKey: newLinkKey }),
      [dispatch, listKey, newTextKey, newLinkKey]
    ),
  };
}

function useHabitListHandlers(dispatch, listKey, newTextKey, confirm) {
  return {
    onUpdateText: useCallback((id, value) => dispatch({ type: 'UPDATE_ITEM_TEXT', listKey, id, value }), [dispatch, listKey]),
    onRemoveItem: useCallback(
      async (id) => {
        if (!(await confirm('Remover este hábito?'))) return;
        dispatch({ type: 'REMOVE_ITEM', listKey, id });
      },
      [dispatch, listKey, confirm]
    ),
    onDragStart: useCallback((id) => dispatch({ type: 'DRAG_START', listKey, id }), [dispatch, listKey]),
    onDrop: useCallback((targetId) => dispatch({ type: 'DROP_ON', listKey, targetId }), [dispatch, listKey]),
    onNewTextChange: useCallback((value) => dispatch({ type: 'SET_TEXT_FIELD', key: newTextKey, value }), [dispatch, newTextKey]),
    onAddItem: useCallback(() => dispatch({ type: 'ADD_HABITO', listKey, textKey: newTextKey }), [dispatch, listKey, newTextKey]),
  };
}

export default function HojeView({
  state,
  dispatch,
  agenda,
  counts,
  hubspot,
  dealsWithoutTasks,
  calendar,
  reminders,
  onSyncReminders,
  notion,
  ticktick,
  habitTracker,
}) {
  const confirm = useConfirm();
  const manhaHandlers = useChecklistHandlers(dispatch, 'manha', 'manhaEdit', 'manhaOpen', 'newManhaText', 'newManhaLink', confirm);
  const noiteHandlers = useChecklistHandlers(dispatch, 'noite', 'noiteEdit', 'noiteOpen', 'newNoiteText', 'newNoiteLink', confirm);
  const semanaHandlers = useChecklistHandlers(dispatch, 'semana', 'semanaEdit', 'semanaOpen', 'newSemanaText', 'newSemanaLink', confirm);
  const semanaPend = state.semana.filter((s) => !s.done).length;

  const habitosBonsHandlers = useHabitListHandlers(dispatch, 'habitosBons', 'newHabitoBomText', confirm);
  const habitosRuinsHandlers = useHabitListHandlers(dispatch, 'habitosRuins', 'newHabitoRuimText', confirm);
  const onCycleHabitoMark = useCallback(
    (habitId, dateKey) => dispatch({ type: 'CYCLE_HABITO_MARK', habitId, dateKey }),
    [dispatch]
  );

  return (
    <div className={styles.columns}>
      <div className={styles.col}>
        <AgendaCard
          title={agenda.agendaTitle}
          toggleLabel={agenda.agendaToggleLabel}
          onToggleDay={() => dispatch({ type: 'TOGGLE_AGENDA_DAY' })}
          onRefresh={calendar.refresh}
          updatedLabel={calendar.updatedAt ? formatClock(calendar.updatedAt) : '—'}
          height={agenda.agendaHeight}
          hours={agenda.agendaHours}
          events={agenda.agenda}
          error={calendar.error}
          nowLineTop={agenda.nowLineTop}
          nowLineLabel={agenda.nowLineLabel}
          calendarAppUrl={FANTASTICAL_APP_URL}
        />
      </div>

      <div className={styles.col}>
        <MeuDiaCard
          notes={state.notes}
          newNoteText={state.newNoteText}
          onNoteTextChange={(v) => dispatch({ type: 'SET_TEXT_FIELD', key: 'newNoteText', value: v })}
          onAddNote={() => dispatch({ type: 'ADD_NOTE' })}
          onRemoveNote={async (id) => {
            if (!(await confirm('Remover esta nota?'))) return;
            dispatch({ type: 'REMOVE_NOTE', id });
          }}
          onUpdateNoteText={(id, value) => dispatch({ type: 'UPDATE_NOTE_TEXT', id, value })}
          onUpdateNoteColor={(id, bg, tc) => dispatch({ type: 'UPDATE_NOTE_COLOR', id, bg, tc })}
          onDragStart={(id) => dispatch({ type: 'DRAG_START', listKey: 'notes', id })}
          onDrop={(targetId) => dispatch({ type: 'DROP_ON', listKey: 'notes', targetId })}
          open={state.meuDiaOpen}
          onToggleOpen={() => dispatch({ type: 'TOGGLE_FLAG', key: 'meuDiaOpen' })}
        />
        <HabitTrackerCard
          open={state.habitosOpen}
          edit={state.habitosEdit}
          onToggleOpen={() => dispatch({ type: 'TOGGLE_FLAG', key: 'habitosOpen' })}
          onToggleEdit={() => dispatch({ type: 'TOGGLE_FLAG', key: 'habitosEdit' })}
          days={habitTracker.days}
          bons={habitTracker.bons}
          ruins={habitTracker.ruins}
          onCycleMark={onCycleHabitoMark}
          newBomText={state.newHabitoBomText}
          onNewBomTextChange={habitosBonsHandlers.onNewTextChange}
          onAddBom={habitosBonsHandlers.onAddItem}
          onUpdateBomText={habitosBonsHandlers.onUpdateText}
          onRemoveBom={habitosBonsHandlers.onRemoveItem}
          onDragStartBom={habitosBonsHandlers.onDragStart}
          onDropBom={habitosBonsHandlers.onDrop}
          newRuimText={state.newHabitoRuimText}
          onNewRuimTextChange={habitosRuinsHandlers.onNewTextChange}
          onAddRuim={habitosRuinsHandlers.onAddItem}
          onUpdateRuimText={habitosRuinsHandlers.onUpdateText}
          onRemoveRuim={habitosRuinsHandlers.onRemoveItem}
          onDragStartRuim={habitosRuinsHandlers.onDragStart}
          onDropRuim={habitosRuinsHandlers.onDrop}
        />
        <ChecklistCard
          title="Starting Day"
          items={state.manha}
          pend={counts.manhaPend}
          total={counts.manhaTotal}
          open={state.manhaOpen}
          edit={state.manhaEdit}
          newText={state.newManhaText}
          newLink={state.newManhaLink}
          {...manhaHandlers}
        />
        <ChecklistCard
          title="Ending Day"
          items={state.noite}
          pend={counts.noitePend}
          total={counts.noiteTotal}
          open={state.noiteOpen}
          edit={state.noiteEdit}
          newText={state.newNoiteText}
          newLink={state.newNoiteLink}
          {...noiteHandlers}
        />
        <ChecklistCard
          title="Ending Week"
          items={state.semana}
          pend={semanaPend}
          total={state.semana.length}
          open={state.semanaOpen}
          edit={state.semanaEdit}
          newText={state.newSemanaText}
          newLink={state.newSemanaLink}
          {...semanaHandlers}
        />
      </div>

      <div className={styles.col}>
        <HubSpotCard
          groups={hubspot.groups}
          vencidas={hubspot.vencidas}
          hoje={hubspot.hoje}
          loading={hubspot.loading}
          error={hubspot.error}
          onRefresh={hubspot.refresh}
          updatedLabel={hubspot.updatedAt ? formatClock(hubspot.updatedAt) : '—'}
          extraLink={{
            label: 'Hubspot',
            href: hubspot.tasksUrl,
            title: 'Abrir a lista de tarefas pendentes no HubSpot',
          }}
        />
        <HubSpotDealsWithoutTasksCard
          groups={dealsWithoutTasks.groups}
          total={dealsWithoutTasks.total}
          loading={dealsWithoutTasks.loading}
          error={dealsWithoutTasks.error}
          onRefresh={dealsWithoutTasks.refresh}
          updatedLabel={dealsWithoutTasks.updatedAt ? formatClock(dealsWithoutTasks.updatedAt) : '—'}
          extraLink={{
            label: 'Hubspot',
            href: dealsWithoutTasks.dealsUrl,
            title: 'Abrir a página de deals no HubSpot',
          }}
        />
      </div>

      <div className={styles.col}>
        <GroupedTaskCard
          appName="Lembretes"
          appNameColor="#6b3f4a"
          groups={reminders.groups}
          total={reminders.total}
          loading={reminders.loading}
          error={reminders.error}
          onRefresh={onSyncReminders}
          updatedLabel={reminders.updatedAt ? formatClock(reminders.updatedAt) : '—'}
          extraLink={{
            label: 'Lembretes',
            href: REMINDERS_APP_URL,
            title: 'Abrir o app Lembretes',
          }}
        />
        <GroupedTaskCard
          appName="TickTick"
          appNameColor="#3f6b57"
          groups={ticktick.groups}
          total={ticktick.total}
          loading={ticktick.loading}
          error={ticktick.error}
          onRefresh={ticktick.refresh}
          updatedLabel={ticktick.updatedAt ? formatClock(ticktick.updatedAt) : '—'}
          extraLink={{
            label: 'TickTick',
            href: TICKTICK_APP_URL,
            title: 'Abrir o app do TickTick',
          }}
        />
        <GroupedTaskCard
          appName="Notion"
          appNameColor="#8a7a2f"
          groups={notion.groups}
          total={notion.total}
          loading={notion.loading}
          error={notion.error}
          onRefresh={notion.refresh}
          updatedLabel={notion.updatedAt ? formatClock(notion.updatedAt) : '—'}
          extraLink={{
            label: 'Notion',
            href: NOTION_WEEKLY_APP_URL,
            title: 'Abrir a visão semanal "Todas as Atividades" no app do Notion',
          }}
        />
      </div>
    </div>
  );
}
