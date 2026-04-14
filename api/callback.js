/**
 * /api/callback — riceve il code OAuth, scambia con access+refresh token,
 * mostra i token all'utente con istruzioni per configurare Vercel.
 */

const BASE_URL = process.env.MOSAIC_BASE_URL || 'https://studio.strategy.com'
const TOKEN_ENDPOINT = `${BASE_URL}/MicroStrategyLibrary/oauth2/token`
const CLIENT_ID = process.env.MOSAIC_CLIENT_ID || ''

function parseCookies(req) {
  const cookies = {}
  for (const pair of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = pair.trim().split('=')
    if (k) cookies[k.trim()] = v.join('=').trim()
  }
  return cookies
}

export default async function handler(req, res) {
  const { code, error, error_description } = req.query || {}

  if (error) {
    return res.status(400).send(errorPage(error, error_description))
  }

  if (!code) {
    return res.status(400).send(errorPage('missing_code', 'Nessun codice OAuth ricevuto.'))
  }

  const cookies = parseCookies(req)
  const verifier = cookies.pkce_verifier

  if (!verifier) {
    return res.status(400).send(errorPage('missing_verifier', 'Cookie PKCE scaduto. Riprova il login.'))
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const redirectUri = `${proto}://${host}/api/callback`

  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    })

    const json = await tokenRes.json()

    if (!tokenRes.ok || !json.access_token) {
      return res.status(500).send(errorPage('token_error', JSON.stringify(json)))
    }

    // Cancella cookie PKCE
    res.setHeader('Set-Cookie', 'pkce_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
    res.send(successPage(json.access_token, json.refresh_token, json.expires_in))
  } catch (err) {
    res.status(500).send(errorPage('fetch_error', err.message))
  }
}

// ─── HTML pages ───────────────────────────────────────────────────────────────
function successPage(accessToken, refreshToken, expiresIn) {
  const expMin = Math.round((expiresIn || 3600) / 60)
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Token Mosaic</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0e1a; color: #e8e0d0; padding: 2rem; max-width: 700px; margin: auto; }
    h1 { color: #c9a84c; font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { color: #8a8070; font-size: 0.9rem; }
    .card { background: #161c2e; border: 1px solid #c9a84c33; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }
    label { display: block; font-size: 0.75rem; color: #c9a84c; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.1em; }
    textarea { width: 100%; background: #0a0e1a; color: #4ade80; border: 1px solid #333; border-radius: 4px; padding: 0.75rem; font-family: monospace; font-size: 0.75rem; resize: none; }
    button { margin-top: 0.5rem; padding: 0.5rem 1.2rem; background: #c9a84c; color: #0a0e1a; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.85rem; }
    button:hover { background: #d4b96a; }
    .step { display: flex; gap: 0.75rem; margin: 0.6rem 0; align-items: flex-start; font-size: 0.85rem; }
    .num { background: #c9a84c; color: #0a0e1a; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; font-size: 0.75rem; }
    a { color: #c9a84c; }
  </style>
</head>
<body>
  <h1>✓ Autenticazione completata</h1>
  <p>Copia il token e salvalo su Vercel come variabile d'ambiente.</p>

  <div class="card">
    <label>MOSAIC_TOKEN (access token — scade in ~${expMin} min)</label>
    <textarea id="at" rows="4" readonly>${accessToken}</textarea>
    <button onclick="copy('at')">Copia</button>
  </div>

  ${refreshToken ? `
  <div class="card">
    <label>MOSAIC_REFRESH_TOKEN (lunga durata — consigliato)</label>
    <textarea id="rt" rows="3" readonly>${refreshToken}</textarea>
    <button onclick="copy('rt')">Copia</button>
  </div>` : ''}

  <div class="card">
    <p style="margin-top:0"><strong style="color:#e8e0d0">Come configurare Vercel:</strong></p>
    <div class="step"><span class="num">1</span><span>Vai su <a href="https://vercel.com/dashboard" target="_blank">vercel.com</a> → il tuo progetto → Settings → Environment Variables</span></div>
    ${refreshToken
      ? `<div class="step"><span class="num">2</span><span>Aggiungi <code>MOSAIC_REFRESH_TOKEN</code> con il valore sopra (si rinnova automaticamente)</span></div>
         <div class="step"><span class="num">3</span><span>Tieni anche <code>MOSAIC_CLIENT_ID</code> già configurato</span></div>`
      : `<div class="step"><span class="num">2</span><span>Aggiungi <code>MOSAIC_TOKEN</code> con il valore sopra</span></div>`
    }
    <div class="step"><span class="num">${refreshToken ? 4 : 3}</span><span>Vai su Deployments → clicca <strong>Redeploy</strong></span></div>
    <div class="step"><span class="num">${refreshToken ? 5 : 4}</span><span>Torna all'app — i dati si caricheranno automaticamente</span></div>
  </div>

  <script>
    function copy(id) {
      navigator.clipboard.writeText(document.getElementById(id).value)
        .then(() => alert('Copiato!'))
    }
  </script>
</body>
</html>`
}

function errorPage(code, detail) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Errore OAuth</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0e1a; color: #e8e0d0; padding: 2rem; max-width: 600px; margin: auto; }
    h1 { color: #f87171; }
    pre { background: #161c2e; padding: 1rem; border-radius: 6px; font-size: 0.8rem; color: #f87171; white-space: pre-wrap; word-break: break-all; }
    a { color: #c9a84c; }
  </style>
</head>
<body>
  <h1>⚠ Errore OAuth</h1>
  <p><strong>${code}</strong></p>
  <pre>${detail || ''}</pre>
  <p><a href="/api/auth">↺ Riprova il login</a></p>
</body>
</html>`
}
