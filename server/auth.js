/**
 * OAuth2 client_credentials token manager for Strategy Mosaic MCP.
 *
 * Discovery order:
 *  1. MOSAIC_TOKEN_ENDPOINT env var (explicit override)
 *  2. Well-known discovery from MOSAIC_BASE_URL
 *  3. Hardcoded fallback candidates
 *
 * Token is cached in memory with 5-minute pre-expiry renewal.
 */

import fetch from 'node-fetch'

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.MOSAIC_BASE_URL || 'https://studio.strategy.com'
const CLIENT_ID = process.env.MOSAIC_CLIENT_ID || ''
const CLIENT_SECRET = process.env.MOSAIC_CLIENT_SECRET || ''

// Fallback token endpoint candidates (tried in order if discovery fails)
const FALLBACK_ENDPOINTS = [
  `${BASE_URL}/MicroStrategyLibrary/oauth2/token`,
  `${BASE_URL}/collaboration/oauth2/token`,
  `${BASE_URL}/oauth2/token`,
  `${BASE_URL}/auth/token`,
]

// ─── In-memory cache ──────────────────────────────────────────────────────────
let cachedToken = null
let tokenExpiry = 0   // ms epoch

// ─── Discovery ───────────────────────────────────────────────────────────────
async function discoverTokenEndpoint() {
  // Explicit override wins
  if (process.env.MOSAIC_TOKEN_ENDPOINT) {
    console.log('[auth] Using MOSAIC_TOKEN_ENDPOINT from env:', process.env.MOSAIC_TOKEN_ENDPOINT)
    return process.env.MOSAIC_TOKEN_ENDPOINT
  }

  const wellKnownUrls = [
    `${BASE_URL}/.well-known/oauth-authorization-server`,
    `${BASE_URL}/MicroStrategyLibrary/.well-known/oauth-authorization-server`,
    `${BASE_URL}/.well-known/openid-configuration`,
  ]

  for (const url of wellKnownUrls) {
    try {
      const res = await fetch(url, { timeout: 5000 })
      if (res.ok) {
        const doc = await res.json()
        const endpoint = doc.token_endpoint
        if (endpoint) {
          console.log('[auth] Discovered token_endpoint via', url, '->', endpoint)
          return endpoint
        }
      }
    } catch (err) {
      // not found or network error — try next
    }
  }

  console.log('[auth] Discovery failed, will try fallback endpoints')
  return null
}

// ─── Token exchange ───────────────────────────────────────────────────────────
async function tryTokenEndpoint(endpoint) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'openid offline_access',
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    timeout: 10000,
  })

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = {} }

  if (!res.ok) {
    throw new Error(`Token endpoint ${endpoint} returned ${res.status}: ${text.slice(0, 200)}`)
  }

  if (!json.access_token) {
    throw new Error(`No access_token in response from ${endpoint}: ${text.slice(0, 200)}`)
  }

  return {
    token: json.access_token,
    expiresIn: json.expires_in || 3600,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function getAccessToken() {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < tokenExpiry - 300_000) {
    return cachedToken
  }

  console.log('[auth] Fetching new access token...')

  // Credentials check
  if (!CLIENT_ID || !CLIENT_SECRET) {
    // If a static MOSAIC_TOKEN is provided, use it directly (legacy / dev mode)
    if (process.env.MOSAIC_TOKEN) {
      console.log('[auth] Using MOSAIC_TOKEN (static bearer token)')
      cachedToken = process.env.MOSAIC_TOKEN
      tokenExpiry = Date.now() + 365 * 24 * 3600 * 1000  // treat as non-expiring
      return cachedToken
    }
    throw new Error(
      'Missing MOSAIC_CLIENT_ID / MOSAIC_CLIENT_SECRET env vars. ' +
      'Set them or provide MOSAIC_TOKEN for static auth.'
    )
  }

  // Try discovered endpoint first, then fallbacks
  const discovered = await discoverTokenEndpoint()
  const endpoints = discovered
    ? [discovered, ...FALLBACK_ENDPOINTS.filter((e) => e !== discovered)]
    : FALLBACK_ENDPOINTS

  let lastError = null
  for (const endpoint of endpoints) {
    try {
      console.log('[auth] Trying:', endpoint)
      const { token, expiresIn } = await tryTokenEndpoint(endpoint)
      cachedToken = token
      tokenExpiry = Date.now() + expiresIn * 1000
      console.log('[auth] Token obtained, expires in', expiresIn, 's')
      return cachedToken
    } catch (err) {
      console.warn('[auth] Endpoint failed:', err.message)
      lastError = err
    }
  }

  throw new Error(`All token endpoints failed. Last error: ${lastError?.message}`)
}

export function clearTokenCache() {
  cachedToken = null
  tokenExpiry = 0
}
