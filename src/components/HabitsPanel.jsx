import { useCallback } from 'react';
import { useConfirm } from './ConfirmContext';
import HabitTrackerCard from './HabitTrackerCard';

function useHabitListHandlers(dispatch, listKey, newTextKey, newLinkKey, confirm) {
  return {
    onUpdateText: useCallback((id, value) => dispatch({ type: 'UPDATE_ITEM_TEXT', listKey, id, value }), [dispatch, listKey]),
    onUpdateLink: useCallback((id, value) => dispatch({ type: 'UPDATE_ITEM_LINK', listKey, id, value }), [dispatch, listKey]),
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
    onNewLinkChange: useCallback((value) => dispatch({ type: 'SET_TEXT_FIELD', key: newLinkKey, value }), [dispatch, newLinkKey]),
    onAddItem: useCallback(
      () => dispatch({ type: 'ADD_HABITO', listKey, textKey: newTextKey, linkKey: newLinkKey }),
      [dispatch, listKey, newTextKey, newLinkKey]
    ),
  };
}

// The Hábitos card wired to the dashboard state — the same panel (same
// marks, same edit mode) on Hoje and on Saúde. `alwaysOpen` drops the
// collapse toggle and splits the two lists into columns (Saúde shows it as
// a fixed-size grid cell).
export default function HabitsPanel({ state, dispatch, habitTracker, alwaysOpen = false }) {
  const confirm = useConfirm();
  const bons = useHabitListHandlers(dispatch, 'habitosBons', 'newHabitoBomText', 'newHabitoBomLink', confirm);
  const ruins = useHabitListHandlers(dispatch, 'habitosRuins', 'newHabitoRuimText', 'newHabitoRuimLink', confirm);
  const onCycleMark = useCallback((habitId, dateKey) => dispatch({ type: 'CYCLE_HABITO_MARK', habitId, dateKey }), [dispatch]);

  return (
    <HabitTrackerCard
      open={alwaysOpen || state.habitosOpen}
      collapsible={!alwaysOpen}
      twoColumns={alwaysOpen}
      edit={state.habitosEdit}
      onToggleOpen={() => dispatch({ type: 'TOGGLE_FLAG', key: 'habitosOpen' })}
      onToggleEdit={() => dispatch({ type: 'TOGGLE_FLAG', key: 'habitosEdit' })}
      days={habitTracker.days}
      bons={habitTracker.bons}
      ruins={habitTracker.ruins}
      onCycleMark={onCycleMark}
      newBomText={state.newHabitoBomText}
      onNewBomTextChange={bons.onNewTextChange}
      newBomLink={state.newHabitoBomLink}
      onNewBomLinkChange={bons.onNewLinkChange}
      onAddBom={bons.onAddItem}
      onUpdateBomText={bons.onUpdateText}
      onUpdateBomLink={bons.onUpdateLink}
      onRemoveBom={bons.onRemoveItem}
      onDragStartBom={bons.onDragStart}
      onDropBom={bons.onDrop}
      newRuimText={state.newHabitoRuimText}
      onNewRuimTextChange={ruins.onNewTextChange}
      newRuimLink={state.newHabitoRuimLink}
      onNewRuimLinkChange={ruins.onNewLinkChange}
      onAddRuim={ruins.onAddItem}
      onUpdateRuimText={ruins.onUpdateText}
      onUpdateRuimLink={ruins.onUpdateLink}
      onRemoveRuim={ruins.onRemoveItem}
      onDragStartRuim={ruins.onDragStart}
      onDropRuim={ruins.onDrop}
    />
  );
}
