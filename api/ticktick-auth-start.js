// Vercel serverless function. Redirects the browser to TickTick's OAuth
// consent screen. Visit this URL once (e.g. paste it in a browser tab) to
// connect/reconnect the TickTick integration — after approving, TickTick
// redirects to api/ticktick-auth-callback.js, which stores the token.

const SCOPE = 'tasks:read tasks:write';

export default function handler(req, res) {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('TICKTICK_CLIENT_ID not configured on the server.');
    return;
  }

  const redirectUri = `https://${req.headers.host}/api/ticktick-auth-callback`;
  const authUrl = new URL('https://ticktick.com/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', 'dashboard-ticktick-connect');

  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}
