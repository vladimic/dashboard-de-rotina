// One serverless function for all TickTick routes (Vercel Hobby allows 12
// functions per deployment). vercel.json rewrites keep the old URLs working:
//   /api/ticktick-tasks -> ?action=tasks, /api/ticktick-auth-start -> ?action=start,
//   /api/ticktick-auth-callback -> ?action=callback (registered in TickTick).
import tasks from './_lib/routes/ticktick-tasks.js';
import start from './_lib/routes/ticktick-auth-start.js';
import callback from './_lib/routes/ticktick-auth-callback.js';

const ROUTES = { tasks, start, callback };

export default function handler(req, res) {
  const route = ROUTES[req.query?.action || 'tasks'];
  if (!route) return res.status(404).json({ error: 'Unknown action' });
  return route(req, res);
}
