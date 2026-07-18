import { useCallback } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import AgendaCard from '../components/AgendaCard';
import MeuDiaCard from '../components/MeuDiaCard';
import ChecklistCard from '../components/ChecklistCard';
import HubSpotCard from '../components/HubSpotCard';
import HubSpotDealsWithoutTasksCard from '../components/HubSpotDealsWithoutTasksCard';
import TaskListCard from '../components/TaskListCard';
import GroupedTaskCard from '../components/GroupedTaskCard';
import RemindersHojeCard from '../components/RemindersHojeCard';
import {
  formatClock,
  FANTASTICAL_APP_URL,
  SYNC_REMINDERS_SHORTCUT_URL,
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

export default function HojeView({
  state,
  dispatch,
  agenda,
  counts,
  onRefreshMeuDia,
  hubspot,
  dealsWithoutTasks,
  calendar,
  reminders,
  notion,
  ticktick,
}) {
  const confirm = useConfirm();
  const manhaHandlers = useChecklistHandlers(dispatch, 'manha', 'manhaEdit', 'manhaOpen', 'newManhaText', 'newManhaLink', confirm);
  const noiteHandlers = useChecklistHandlers(dispatch, 'noite', 'noiteEdit', 'noiteOpen', 'newNoiteText', 'newNoiteLink', confirm);

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
          onRefresh={onRefreshMeuDia}
          onDragStart={(id) => dispatch({ type: 'DRAG_START', listKey: 'notes', id })}
          onDrop={(targetId) => dispatch({ type: 'DROP_ON', listKey: 'notes', targetId })}
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
        />
        <HubSpotDealsWithoutTasksCard
          groups={dealsWithoutTasks.groups}
          total={dealsWithoutTasks.total}
          loading={dealsWithoutTasks.loading}
          error={dealsWithoutTasks.error}
          onRefresh={dealsWithoutTasks.refresh}
          updatedLabel={dealsWithoutTasks.updatedAt ? formatClock(dealsWithoutTasks.updatedAt) : '—'}
        />
      </div>

      <div className={styles.col}>
        <TaskListCard
          title="Vencidas · Lembretes"
          titleColor="#6b3f4a"
          itemColor="#5b4a63"
          tasks={reminders.vencidas.map((r) => ({ id: r.id, label: r.title }))}
          onRefresh={reminders.refresh}
          updatedLabel={reminders.updatedAt ? formatClock(reminders.updatedAt) : '—'}
          extraLink={{
            label: 'Sincronizar',
            href: SYNC_REMINDERS_SHORTCUT_URL,
            title: 'Rodar o Atalho que envia os Lembretes atualizados',
          }}
        />
        <RemindersHojeCard
          semHorario={reminders.hojeSemHorario}
          comHorario={reminders.hojeComHorario}
          loading={reminders.loading}
          error={reminders.error}
          onRefresh={reminders.refresh}
          updatedLabel={reminders.updatedAt ? formatClock(reminders.updatedAt) : '—'}
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
