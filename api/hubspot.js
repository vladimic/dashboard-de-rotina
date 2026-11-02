// HubSpot routes (tasks, deals without tasks, Vendas funnel + daily snapshot)
// in one serverless function. vercel.json rewrites keep the old URLs:
//   /api/hubspot-tasks -> ?action=tasks
//   /api/hubspot-deals-without-tasks -> ?action=deals-without-tasks
//   /api/vendas -> ?action=vendas (the cron calls /api/vendas?snapshot=1)
import tasks from './_lib/routes/hubspot-tasks.js';
import dealsWithoutTasks from './_lib/routes/hubspot-deals-without-tasks.js';
import vendas from './_lib/routes/vendas.js';

const ROUTES = { tasks, 'deals-without-tasks': dealsWithoutTasks, vendas };

export default function handler(req, res) {
  const route = ROUTES[req.query?.action];
  if (!route) return res.status(404).json({ error: 'Unknown action' });
  return route(req, res);
}
