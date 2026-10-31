// Vercel cron (see vercel.json): takes the day's photo of the sales funnel at
// ~23h São Paulo. When CRON_SECRET is set on the project, Vercel sends it as
// "Authorization: Bearer <secret>" and anything else is refused; without it,
// only requests from Vercel's cron user agent are accepted.

import { takeSnapshot } from './_lib/vendasSnapshot.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.CRON_SECRET;
  const fromCron = String(req.headers['user-agent'] || '').startsWith('vercel-cron/');
  const authorized = secret ? req.headers.authorization === `Bearer ${secret}` : fromCron;
  if (!authorized) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // The scheduled run is the day's final photo: it replaces an earlier one.
    res.status(200).json(await takeSnapshot({ force: true }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not take the photo.' });
  }
}
