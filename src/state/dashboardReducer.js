import { NOTE_COLORS } from '../data/seedData';

export function dashboardReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'GO_PAGE':
      return { ...state, page: action.page };

    case 'SET_NEW_NOTE_TEXT':
      return { ...state, newNoteText: action.value };

    case 'ADD_NOTE': {
      const text = (state.newNoteText || '').trim();
      if (!text) return state;
      const idx = state.notes.length % NOTE_COLORS.length;
      const { bg, tc } = NOTE_COLORS[idx];
      const note = { id: Date.now(), text, bg, tc };
      return { ...state, newNoteText: '', notes: [note, ...state.notes] };
    }

    case 'REMOVE_NOTE':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };

    case 'UPDATE_NOTE_TEXT':
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, text: action.value } : n)),
      };

    case 'UPDATE_NOTE_COLOR':
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, bg: action.bg, tc: action.tc } : n)),
      };

    case 'TOGGLE_LIST_ITEM':
      return {
        ...state,
        [action.listKey]: state[action.listKey].map((m) =>
          m.id === action.id ? { ...m, done: !m.done } : m
        ),
      };

    case 'TOGGLE_AGENDA_DAY':
      return { ...state, agendaDay: state.agendaDay === 'hoje' ? 'amanha' : 'hoje' };

    case 'TOGGLE_FLAG':
      return { ...state, [action.key]: !state[action.key] };

    case 'REFRESH':
      return { ...state, [action.key]: Date.now() };

    case 'REFRESH_ALL':
      return {
        ...state,
        downloadsUpdated: Date.now(),
        backlogUpdated: Date.now(),
        fotosUpdated: Date.now(),
        lembretesVencidasUpdated: Date.now(),
        lembretesHojeUpdated: Date.now(),
        ticktickUpdated: Date.now(),
      };

    case 'UPDATE_ITEM_TEXT':
      return {
        ...state,
        [action.listKey]: state[action.listKey].map((m) =>
          m.id === action.id ? { ...m, label: action.value } : m
        ),
      };

    case 'UPDATE_ITEM_LINK':
      return {
        ...state,
        [action.listKey]: state[action.listKey].map((m) =>
          m.id === action.id ? { ...m, link: action.value } : m
        ),
      };

    case 'REMOVE_ITEM':
      return {
        ...state,
        [action.listKey]: state[action.listKey].filter((m) => m.id !== action.id),
      };

    case 'DRAG_START':
      return { ...state, dragList: action.listKey, dragId: action.id };

    case 'DROP_ON': {
      const { dragList, dragId } = state;
      if (dragList !== action.listKey || dragId == null || dragId === action.targetId) {
        return state;
      }
      const list = state[action.listKey].slice();
      const fromIdx = list.findIndex((m) => m.id === dragId);
      const toIdx = list.findIndex((m) => m.id === action.targetId);
      if (fromIdx < 0 || toIdx < 0) return state;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { ...state, [action.listKey]: list, dragId: null, dragList: null };
    }

    case 'ADD_LIST_ITEM': {
      const text = (state[action.textKey] || '').trim();
      if (!text) return state;
      const link = action.linkKey ? (state[action.linkKey] || '').trim() : '';
      const item = { id: Date.now(), label: text, done: false, ...(link ? { link } : {}) };
      return {
        ...state,
        [action.listKey]: [...state[action.listKey], item],
        [action.textKey]: '',
        ...(action.linkKey ? { [action.linkKey]: '' } : {}),
      };
    }

    case 'SET_TEXT_FIELD':
      return { ...state, [action.key]: action.value };

    case 'TOGGLE_HABIT':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? { ...h, done: !h.done } : h)),
      };

    case 'LOG_WEIGHT': {
      const val = parseFloat((state.newWeightText || '').replace(',', '.'));
      if (!val || Number.isNaN(val)) return state;
      const entry = {
        date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        value: val,
      };
      return {
        ...state,
        weight: val,
        newWeightText: '',
        weightLog: [entry, ...state.weightLog],
      };
    }

    // Asked once per day (see DashboardApp's daily-reset effect) — if the
    // user says yes, Starting Day/Ending Day come back unchecked; if no,
    // they're left exactly as they were until the next day's prompt.
    case 'APPLY_DAILY_RESET': {
      const todayKey = new Date().toDateString();
      if (!action.reset) return { ...state, lastResetDate: todayKey };
      return {
        ...state,
        lastResetDate: todayKey,
        manha: state.manha.map((m) => ({ ...m, done: false })),
        noite: state.noite.map((m) => ({ ...m, done: false })),
      };
    }

    default:
      return state;
  }
}
