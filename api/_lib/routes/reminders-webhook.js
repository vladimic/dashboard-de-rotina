// Vercel serverless function. Receives a fresh snapshot of reminders pushed
// by a Shortcuts automation running on the user's own Mac/iPhone (the only
// way to reach real, current Reminders data — see api/reminders.js for why
// CalDAV can't). Protected by a shared-secret bearer token, not a Supabase
// session, since the Shortcut has no login flow.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, use POST.' });
    return;
  }

  const expectedSecret = process.env.REMINDERS_WEBHOOK_SECRET;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expectedSecret || provided !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured on the server.' });
    return;
  }

  const reminders = Array.isArray(req.body?.reminders) ? req.body.reminders : null;
  if (!reminders) {
    res.status(400).json({ error: 'Expected a JSON body shaped like { "reminders": [...] }.' });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase
      .from('reminders_cache')
      .upsert({ id: 'default', data: reminders, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) throw new Error(error.message);

    res.status(200).json({ ok: true, count: reminders.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error saving reminders cache.' });
  }
}
