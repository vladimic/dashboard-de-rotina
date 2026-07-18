// Vercel serverless function. Apple's CalDAV interface only exposes stale
// legacy placeholder reminder lists for accounts that migrated to the newer
// Reminders engine (real reminders aren't reachable that way at all), so
// this reads instead from a small Supabase cache that a Shortcuts
// automation on the user's own device pushes to periodically via
// /api/reminders-webhook. This endpoint just re-buckets whatever was pushed
// most recently into overdue / due-today-no-time / due-today-with-time.

import { createClient } from '@supabase/supabase-js';
import { getDayBoundsMs } from './_lib/dateRange.js';

const TIMEZONE = process.env.HUBSPOT_TIMEZONE || 'America/Sao_Paulo';

function formatTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  return {
    hour: parts.find((p) => p.type === 'hour').value,
    minute: parts.find((p) => p.type === 'minute').value,
  };
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
    const { startOfDay, endOfDay } = getDayBoundsMs(0, TIMEZONE);

    const vencidas = [];
    const hojeSemHorario = [];
    const hojeComHorario = [];

    for (const r of rawReminders) {
      if (r.completed || !r.dueDate) continue;
      const due = new Date(r.dueDate);
      if (Number.isNaN(due.getTime())) continue;
      const dueMs = due.getTime();

      const entry = { id: r.id || r.title, title: r.title || '(sem título)', dueMs };

      if (dueMs < startOfDay) {
        vencidas.push(entry);
      } else if (dueMs <= endOfDay) {
        // No reliable "has time" flag comes from Shortcuts, so a reminder
        // due at exactly midnight in the local timezone is treated as
        // date-only — true for the vast majority of real reminders, but a
        // reminder genuinely due at 00:00 sharp would be misclassified.
        const { hour, minute } = formatTimeParts(due, TIMEZONE);
        const hasTime = !(hour === '00' && minute === '00');
        if (hasTime) hojeComHorario.push({ ...entry, timeLabel: `${hour}:${minute}` });
        else hojeSemHorario.push(entry);
      }
    }

    vencidas.sort((a, b) => a.dueMs - b.dueMs);
    hojeSemHorario.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    hojeComHorario.sort((a, b) => a.dueMs - b.dueMs);

    const now = Date.now();
    const groups = [
      { projectLabel: 'Vencidos', tasks: vencidas.map((r) => ({ id: r.id, label: r.title, overdue: true })) },
      {
        projectLabel: 'Hoje Programado',
        tasks: hojeComHorario.map((r) => ({
          id: r.id,
          label: `${r.timeLabel} · ${r.title}`,
          overdue: r.dueMs < now,
        })),
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
