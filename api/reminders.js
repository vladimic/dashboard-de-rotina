// Reminders list/sync and the Shortcuts webhook share one serverless function.
// vercel.json rewrites /api/reminders-webhook -> /api/reminders?action=webhook.
import list from './_lib/routes/reminders.js';
import webhook from './_lib/routes/reminders-webhook.js';

export default function handler(req, res) {
  return req.query?.action === 'webhook' ? webhook(req, res) : list(req, res);
}
