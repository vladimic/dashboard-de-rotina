export function formatTodayLong(date = new Date()) {
  const str = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatClock(date) {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatHourLabel(hour) {
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const AGENDA_TIMEZONE = 'America/Sao_Paulo';

// Fantastical for Mac registers this URL scheme to launch the app.
export const FANTASTICAL_APP_URL = 'x-fantastical3://';

// Runs the named Shortcut on-demand (Mac or iPhone) — the Shortcut must be
// named exactly "Sincronizar Lembretes" for this link to find it.
//
// x-success (auto-return to this page once the Shortcut finishes) is only
// added on iOS. There, running the Shortcut fully backgrounds the installed
// PWA, so x-success is what brings the user back. On Mac the app window
// never loses focus while the Shortcut runs in the background — adding
// x-success there only spawns a redundant new Chrome tab with the dashboard
// reloaded in it. Background polling already refreshes the open window.
export function syncRemindersShortcutUrl() {
  const base = 'shortcuts://x-callback-url/run-shortcut?name=Sincronizar%20Lembretes';
  const isIOS = /iP(hone|od|ad)/.test(navigator.platform) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
  if (!isIOS) return base;
  const returnUrl = encodeURIComponent(window.location.href);
  return `${base}&x-success=${returnUrl}`;
}

// Reminders for Mac/iOS registers this URL scheme to launch the app.
export const REMINDERS_APP_URL = 'x-apple-reminderkit://';

// Notion desktop/mobile app registers this URL scheme; substituting it in
// for https://app.notion.com opens the same page directly in the app instead
// of the browser — positioned on the "Hoje" view of "Todas as Atividades".
export const NOTION_WEEKLY_APP_URL =
  'notion://www.notion.so/Todas-as-Atividades-30a05418964481c7a8ecd45e4dad4ebc?source=copy_link';

// TickTick for Mac/iOS registers this URL scheme to launch the app.
export const TICKTICK_APP_URL = 'ticktick://';

export function hourFloatInAgendaTZ(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AGENDA_TIMEZONE,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(date));
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const min = Number(parts.find((p) => p.type === 'minute').value);
  return h + min / 60;
}

const WEEK_RESET_WEEKDAY = 5; // Friday (Sun=0 .. Sat=6)
const WEEK_RESET_HOUR = 14;

// A stable "YYYY-MM-DD" key for the most recent Friday-14:00 boundary that
// has already passed, in AGENDA_TIMEZONE — changes only once a week, right
// at the reset instant, so it can be compared against a stored value to
// know whether this week's "Ending Week" reset is still due.
export function currentWeekResetKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AGENDA_TIMEZONE,
    weekday: 'short',
    hourCycle: 'h23',
    hour: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
  const hour = Number(map.hour);

  let daysSinceReset = (weekdayIndex - WEEK_RESET_WEEKDAY + 7) % 7;
  if (daysSinceReset === 0 && hour < WEEK_RESET_HOUR) daysSinceReset = 7;

  // Anchored at UTC noon on "today" (per AGENDA_TIMEZONE) so stepping back
  // whole days never crosses a DST boundary within the calculation itself.
  const anchor = new Date(`${map.year}-${map.month}-${map.day}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - daysSinceReset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(anchor);
}

// "YYYY-MM-DD" for "today" in AGENDA_TIMEZONE, regardless of the device's
// own timezone.
export function dateKeySaoPaulo(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AGENDA_TIMEZONE }).format(date);
}

// Calendar-day arithmetic anchored at UTC noon (same trick as
// currentWeekResetKey above) so it never slips a day across a DST boundary —
// operates purely on the "YYYY-MM-DD" string, not on wall-clock time.
export function shiftDateKey(key, days) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(d);
}

// Last n date keys ending in "today" (per AGENDA_TIMEZONE), oldest first —
// the habit tracker's 7-day strip uses this with the last entry as today.
export function lastNDateKeys(n, date = new Date()) {
  const todayKey = dateKeySaoPaulo(date);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) keys.push(shiftDateKey(todayKey, -i));
  return keys;
}
