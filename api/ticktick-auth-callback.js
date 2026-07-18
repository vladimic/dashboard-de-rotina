// Vercel serverless function. TickTick redirects here after the user
// approves access (see api/ticktick-auth-start.js). Exchanges the
// authorization code for an access token and stores it in Supabase
// (ticktick_auth, single row) so api/ticktick-tasks.js can use it —
// following the same single-row-cache pattern as reminders_cache.

import { createClient } from '@supabase/supabase-js';

const SCOPE = 'tasks:read tasks:write';

export default async function handler(req, res) {
  const { code, error: oauthError } = req.query;

  if (oauthError) {
    res.status(400).send(`Autorização do TickTick falhou: ${oauthError}`);
    return;
  }
  if (!code) {
    res.status(400).send('Faltou o parâmetro "code" no redirecionamento do TickTick.');
    return;
  }

  const clientId = process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) {
    res.status(500).send('Servidor incompleto: falta TICKTICK_CLIENT_ID/SECRET ou as variáveis do Supabase.');
    return;
  }

  const redirectUri = `https://${req.headers.host}/api/ticktick-auth-callback`;

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://ticktick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        scope: SCOPE,
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      res.status(500).send(`Troca do código por token falhou (${tokenRes.status}): ${tokenText}`);
      return;
    }
    const tokenData = JSON.parse(tokenText);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase.from('ticktick_auth').upsert(
      {
        id: 'default',
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw new Error(error.message);

    res.status(200).send('TickTick conectado com sucesso! Pode fechar esta aba e voltar ao Cockpit.');
  } catch (err) {
    console.error(err);
    res.status(500).send(`Erro ao conectar o TickTick: ${err.message}`);
  }
}
