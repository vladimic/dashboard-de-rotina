// Vercel serverless function. Apple's CalDAV interface only exposes stale
// legacy placeholder reminder lists for accounts that migrated to the newer
// Reminders engine (real reminders aren't reachable that way at all), so
// this reads instead from a small Supabase cache that a Shortcuts
// automation on the user's own device pushes to periodically via
// /api/reminders-webhook. This endpoint just re-buckets whatever was pushed
// most recently into overdue / due-today-no-time / due-today-with-time.

import { createClient } from '@supabase/supabase-js';

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';

const ISO_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

// Reads the reminder's own local date/time exactly as the Shortcut wrote it,
// instead of reprojecting the absolute instant into a fixed app timezone.
// This matters while traveling: the Shortcut serializes the reminder's due
// date using the device's *current* timezone offset, so converting that
// instant into a different fixed zone (e.g. always America/Sao_Paulo) can
// shift the displayed clock time and even push a "due today" reminder to
// before or after the fixed zone's midnight, misclassifying it as overdue.
function parseReminderLocal(dueDateStr, due) {
  const match = ISO_WITH_OFFSET.exec(dueDateStr);
  if (!match) {
    // Fallback for unexpected formats: project through the fixed app timezone.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(due);
    const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
    return {
      dateKey: dtf.format(due),
      hour: parts.find((p) => p.type === 'hour').value,
      minute: parts.find((p) => p.type === 'minute').value,
      todayKey: dtf.format(new Date()),
    };
  }

  const [, y, mo, d, h, mi, , offsetRaw] = match;
  let offsetMinutes = 0;
  if (offsetRaw !== 'Z') {
    const sign = offsetRaw[0] === '-' ? -1 : 1;
    const oh = Number(offsetRaw.slice(1, 3));
    const om = Number(offsetRaw.slice(-2));
    offsetMinutes = sign * (oh * 60 + om);
  }

  // "Today" is judged in that same offset, so a reminder set while traveling
  // lines up with the day the Reminders app itself shows on that device.
  const shifted = new Date(Date.now() + offsetMinutes * 60000);
  const todayKey = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;

  return { dateKey: `${y}-${mo}-${d}`, hour: h, minute: mi, todayKey };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured on the server.' });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: row, error } = await supabase.from('reminders_cache').select('data, updated_at').eq('id', 'default').maybeSingle();
    if (error) throw new Error(error.message);

    const rawReminders = Array.isArray(row?.data) ? row.data : [];

    // Overdue is judged against the moment the Shortcut last synced, not the
    // live clock — a reminder that was still upcoming as of the last sync
    // shouldn't silently flip to "vencido" just because time passed before
    // the next sync runs.
    const parsedUpdatedAt = row?.updated_at ? new Date(row.updated_at).getTime() : NaN;
    const now = Number.isNaN(parsedUpdatedAt) ? Date.now() : parsedUpdatedAt;

    const vencidas = [];
    const hojeSemHorario = [];
    const hojeComHorario = [];

    for (const r of rawReminders) {
      if (r.completed || !r.dueDate) continue;
      const due = new Date(r.dueDate);
      if (Number.isNaN(due.getTime())) continue;
      const dueMs = due.getTime();

      const entry = { id: r.id || r.title, title: r.title || '(sem título)', dueMs };
      const { dateKey, hour, minute, todayKey } = parseReminderLocal(r.dueDate, due);

      if (dateKey < todayKey) {
        vencidas.push(entry);
      } else if (dateKey === todayKey) {
        // No reliable "has time" flag comes from Shortcuts, so a reminder
        // due at exactly midnight local time is treated as date-only — true
        // for the vast majority of real reminders, but a reminder genuinely
        // due at 00:00 sharp would be misclassified.
        const hasTime = !(hour === '00' && minute === '00');
        if (hasTime) {
          const timed = { ...entry, timeLabel: `${hour}:${minute}` };
          // Already past its time as of the last sync — belongs in Vencidos,
          // not Hoje Programado.
          if (dueMs < now) vencidas.push(timed);
          else hojeComHorario.push(timed);
        } else {
          hojeSemHorario.push(entry);
        }
      }
    }

    vencidas.sort((a, b) => a.dueMs - b.dueMs);
    hojeSemHorario.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    hojeComHorario.sort((a, b) => a.dueMs - b.dueMs);

    const groups = [
      {
        projectLabel: 'Vencidos',
        tasks: vencidas.map((r) => ({
          id: r.id,
          label: r.timeLabel ? `${r.timeLabel} · ${r.title}` : r.title,
          overdue: true,
        })),
      },
      {
        projectLabel: 'Hoje Programado',
        tasks: hojeComHorario.map((r) => ({ id: r.id, label: `${r.timeLabel} · ${r.title}` })),
      },
      { projectLabel: 'Hoje Sem Horário', tasks: hojeSemHorario.map((r) => ({ id: r.id, label: r.title })) },
    ].filter((g) => g.tasks.length > 0);

    res.status(200).json({
      updatedAt: row?.updated_at || null,
      total: vencidas.length + hojeComHorario.length + hojeSemHorario.length,
      groups,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error reading reminders cache.' });
  }
}
