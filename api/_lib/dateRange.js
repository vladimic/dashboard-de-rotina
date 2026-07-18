// Shared "start/end of day N, in a given IANA timezone" helper, used by both
// the HubSpot day-bucketing and the calendar day-window logic so "hoje" means
// the same thing everywhere regardless of the server's own UTC clock.

export function getDayBoundsMs(offsetDays, timeZone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year').value);
  const m = Number(parts.find((p) => p.type === 'month').value);
  const d = Number(parts.find((p) => p.type === 'day').value);

  const localMidnightUTC = new Date(Date.UTC(y, m - 1, d + offsetDays));
  const tzOffsetMs = getTzOffsetMs(now, timeZone);
  const startOfDay = localMidnightUTC.getTime() - tzOffsetMs;
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
  return { startOfDay, endOfDay };
}

function getTzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  // asUTC is only ever second-precision (Intl has no sub-second formatting),
  // so date.getTime() must be floored to whole seconds too — otherwise the
  // offset (and everything computed from it, like day boundaries) drifts by
  // up to ~1s depending on what millisecond this happened to run at.
  const dateFlooredToSecond = Math.floor(date.getTime() / 1000) * 1000;
  return asUTC - dateFlooredToSecond;
}
