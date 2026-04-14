/**
 * Token manager per Strategy Mosaic MCP.
 *
 * Priorità:
 *  1. MOSAIC_TOKEN (token statico, non scade)
 *  2. MOSAIC_REFRESH_TOKEN + MOSAIC_CLIENT_ID → refresh_token grant
 *  3. client_credentials (non supportato da Mosaic, ma tenuto come fallback)
 */

const BASE_URL = process.env.MOSAIC_BASE_URL || 'https://studio.strategy.com'
const TOKEN_ENDPOINT =
  process.env.MOSAIC_TOKEN_ENDPOINT ||
  `${BASE_URL}/MicroStrategyLibrary/oauth2/token`

// ─── In-memory cache ──────────────────────────────────────────────────────────
let cachedToken = null
let tokenExpiry = 0
let cachedRefreshToken = process.env.MOSAIC_REFRESH_TOKEN || null

// ─── refresh_token grant ──────────────────────────────────────────────────────
async function refreshWithToken(refreshToken) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.MOSAIC_CLIENT_ID || '',
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  })

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = {} }

  if (!res.ok || !json.access_token) {
    throw new Error(`refresh_token grant failed (${res.status}): ${text.slice(0, 200)}`)
  }

  // Aggiorna refresh token se ne arriva uno nuovo
  if (json.refresh_token) cachedRefreshToken = json.refresh_token

  return { token: json.access_token, expiresIn: json.expires_in || 3600 }
}

// ─── client_credentials grant (fallback) ─────────────────────────────────────
async function clientCredentials() {
  const clientId = process.env.MOSAIC_CLIENT_ID || ''
  const clientSecret = process.env.MOSAIC_CLIENT_SECRET || ''

  if (!clientId || !clientSecret) {
    throw new Error('MOSAIC_CLIENT_ID / MOSAIC_CLIENT_SECRET non configurati')
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  })

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = {} }

  if (!res.ok || !json.access_token) {
    throw new Error(`client_credentials failed (${res.status}): ${text.slice(0, 200)}`)
  }

  return { token: json.access_token, expiresIn: json.expires_in || 3600 }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function getAccessToken() {
  // Cache valida con buffer 5 minuti
  if (cachedToken && Date.now() < tokenExpiry - 300_000) {
    return cachedToken
  }

  // 1. Token statico (priorità massima)
  if (process.env.MOSAIC_TOKEN) {
    console.log('[auth] Uso MOSAIC_TOKEN statico')
    cachedToken = process.env.MOSAIC_TOKEN
    tokenExpiry = Date.now() + 365 * 24 * 3600 * 1000
    return cachedToken
  }

  // 2. Refresh token
  if (cachedRefreshToken) {
    console.log('[auth] Rinnovo con refresh_token...')
    try {
      const { token, expiresIn } = await refreshWithToken(cachedRefreshToken)
      cachedToken = token
      tokenExpiry = Date.now() + expiresIn * 1000
      console.log('[auth] Token rinnovato, scade in', expiresIn, 's')
      return cachedToken
    } catch (err) {
      console.warn('[auth] refresh_token fallito:', err.message)
      cachedRefreshToken = null  // invalido, non riprovare
    }
  }

  // 3. client_credentials (Mosaic di solito non supporta questo grant)
  console.log('[auth] Provo client_credentials...')
  try {
    const { token, expiresIn } = await clientCredentials()
    cachedToken = token
    tokenExpiry = Date.now() + expiresIn * 1000
    return cachedToken
  } catch (err) {
    throw new Error(
      'Impossibile ottenere il token Mosaic. ' +
      'Imposta MOSAIC_TOKEN (token statico) o MOSAIC_REFRESH_TOKEN su Vercel. ' +
      `Dettaglio: ${err.message}`
    )
  }
}

export function clearTokenCache() {
  cachedToken = null
  tokenExpiry = 0
}
