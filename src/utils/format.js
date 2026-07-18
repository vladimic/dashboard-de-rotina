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
export const SYNC_REMINDERS_SHORTCUT_URL = 'shortcuts://run-shortcut?name=Sincronizar%20Lembretes';

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
