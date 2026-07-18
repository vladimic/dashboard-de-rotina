import { formatHourLabel, hourFloatInAgendaTZ } from './format';

const DAY_START = 7;
const DAY_END = 22;
const HOUR_HEIGHT = 40;
const MAX_SLEEP = 9;
const SLEEP_GOOD_THRESHOLD = 7.5;

// Assigns each event a column + total-column-count so overlapping events
// split the available width evenly side by side, instead of stacking on
// top of each other. Standard greedy interval-column assignment: events are
// grouped into overlap clusters, then within a cluster each event claims the
// first column whose previous occupant has already ended.
function layoutOverlappingEvents(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const result = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    const columnEnds = [];
    const placed = [];
    for (const ev of cluster) {
      let colIndex = columnEnds.findIndex((end) => end <= ev.start);
      if (colIndex === -1) {
        colIndex = columnEnds.length;
        columnEnds.push(ev.end);
      } else {
        columnEnds[colIndex] = ev.end;
      }
      placed.push({ ev, colIndex });
    }
    const totalCols = columnEnds.length;
    for (const { ev, colIndex } of placed) {
      result.push({ ...ev, leftPct: (100 * colIndex) / totalCols, widthPct: 100 / totalCols });
    }
    cluster = [];
  }

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.start >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.end);
  }
  flushCluster();

  return result;
}

export function computeAgenda(state, calendarData) {
  const agendaHeight = (DAY_END - DAY_START) * HOUR_HEIGHT;
  const agendaHours = [];
  for (let h = DAY_START; h <= DAY_END; h++) {
    agendaHours.push({ label: `${String(h).padStart(2, '0')}:00`, top: (h - DAY_START) * HOUR_HEIGHT });
  }
  const source = state.agendaDay === 'amanha' ? calendarData.agendaTomorrow : calendarData.agenda;
  const positioned = source.map((ev) => ({
    ...ev,
    top: (ev.start - DAY_START) * HOUR_HEIGHT,
    height: Math.max((ev.end - ev.start) * HOUR_HEIGHT - 4, 22),
    timeLabel: `${formatHourLabel(ev.start)}–${formatHourLabel(ev.end)}`,
  }));
  const agenda = layoutOverlappingEvents(positioned);

  let nowLineTop = null;
  let nowLineLabel = null;
  if (state.agendaDay !== 'amanha' && calendarData.updatedAt) {
    const hourFloat = hourFloatInAgendaTZ(calendarData.updatedAt);
    if (hourFloat >= DAY_START && hourFloat <= DAY_END) {
      nowLineTop = (hourFloat - DAY_START) * HOUR_HEIGHT;
      nowLineLabel = formatHourLabel(hourFloat);
    }
  }

  return {
    agendaHeight,
    agendaHours,
    agenda,
    agendaTitle: state.agendaDay === 'amanha' ? 'Agenda de Amanhã' : 'Agenda de Hoje',
    agendaToggleLabel: state.agendaDay === 'amanha' ? 'Ver hoje' : 'Ver amanhã',
    nowLineTop,
    nowLineLabel,
  };
}

const ENDING_DAY_UNLOCK_HOUR = 17.5; // 17:30 — before this, Ending Day counts as zero in the header/Geral, but not in its own checklist card.

export function computeCounts(state, hubspotTotal = 0, remindersTotal = 0, notionTotal = 0, ticktickTotal = 0) {
  const manhaPend = state.manha.filter((m) => !m.done).length;
  const noitePend = state.noite.filter((m) => !m.done).length;
  const noiteTotal = state.noite.length;
  const endingDayUnlocked = hourFloatInAgendaTZ(Date.now()) >= ENDING_DAY_UNLOCK_HOUR;
  const noitePendSummary = endingDayUnlocked ? noitePend : 0;
  const noiteTotalSummary = endingDayUnlocked ? noiteTotal : 0;
  const meuDiaCount = state.notes.length;
  const geralTotal =
    meuDiaCount +
    manhaPend +
    noitePendSummary +
    hubspotTotal +
    remindersTotal +
    ticktickTotal +
    notionTotal;
  return {
    meuDiaCount,
    manhaTotal: state.manha.length,
    manhaPend,
    noiteTotal,
    noitePend,
    noiteTotalSummary,
    noitePendSummary,
    hubspotTotal,
    geralTotal,
  };
}

export function computeHabits(state) {
  return state.habits.map((h) => ({
    ...h,
    pct: `${Math.round((100 * h.streak) / 7)}%`,
    color: h.done ? '#c3b3c9' : '#5b4a63',
    barColor: h.done ? '#c48fce' : '#e3cdea',
  }));
}

export function computeSleepWeek(state) {
  const sleepWeek = state.sleepWeek.map((s) => ({
    ...s,
    barHeight: `${Math.round((100 * s.hours) / MAX_SLEEP)}%`,
    barColor: s.hours >= SLEEP_GOOD_THRESHOLD ? '#6fa3d1' : '#c9dcec',
  }));
  const sleepAvg = (state.sleepWeek.reduce((a, s) => a + s.hours, 0) / state.sleepWeek.length).toFixed(1);
  return { sleepWeek, sleepAvg };
}

export function computeGoals(state) {
  return state.goalsList.map((g) => ({
    ...g,
    pct: `${Math.round((100 * g.current) / g.target)}%`,
  }));
}
