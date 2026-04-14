/**
 * OAuth 2.0 Authorization Code + PKCE flow per Strategy Studio MCP.
 *
 * Discovery: https://studio.strategy.com/collaboration/.well-known/oauth-authorization-server
 * Token endpoint auth method: client_secret_post
 * Scopes: mcp:stream openid
 */

const AUTH_ENDPOINT  = 'https://studio.strategy.com/collaboration/authorize'
const TOKEN_ENDPOINT = 'https://studio.strategy.com/collaboration/token'
const SCOPE          = 'mcp:stream openid'

const CLIENT_ID      = import.meta.env.VITE_MOSAIC_CLIENT_ID
const CLIENT_SECRET  = import.meta.env.VITE_MOSAIC_CLIENT_SECRET

const SK_TOKEN        = 'mosaic_access_token'
const SK_EXPIRY       = 'mosaic_token_expiry'
const SK_VERIFIER     = 'pkce_code_verifier'
const SK_STATE        = 'oauth_state'

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function generateVerifier() {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function deriveChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ─── Token storage ───────────────────────────────────────────────────────────

export function getStoredToken() {
  const token  = sessionStorage.getItem(SK_TOKEN)
  const expiry = sessionStorage.getItem(SK_EXPIRY)
  if (!token) return null
  if (expiry && Date.now() > Number(expiry)) {
    sessionStorage.removeItem(SK_TOKEN)
    sessionStorage.removeItem(SK_EXPIRY)
    return null
  }
  return token
}

export function clearToken() {
  sessionStorage.removeItem(SK_TOKEN)
  sessionStorage.removeItem(SK_EXPIRY)
}

// ─── Step 1: redirect to authorization endpoint ──────────────────────────────

export async function initiateLogin() {
  const verifier   = generateVerifier()
  const challenge  = await deriveChallenge(verifier)
  const state      = generateVerifier().slice(0, 16)
  const redirectUri = getRedirectUri()

  sessionStorage.setItem(SK_VERIFIER, verifier)
  sessionStorage.setItem(SK_STATE, state)

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          redirectUri,
    scope:                 SCOPE,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
  })

  window.location.href = `${AUTH_ENDPOINT}?${params}`
}

// ─── Step 2: exchange auth code for access token ─────────────────────────────

export async function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search)
  const code      = urlParams.get('code')
  const state     = urlParams.get('state')

  if (!code) return false

  const storedState   = sessionStorage.getItem(SK_STATE)
  const codeVerifier  = sessionStorage.getItem(SK_VERIFIER)

  if (!storedState || state !== storedState) {
    throw new Error('OAuth state mismatch — possibile attacco CSRF')
  }

  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  getRedirectUri(),
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: codeVerifier,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.status)
    throw new Error(`Token exchange fallito (${res.status}): ${err}`)
  }

  const data = await res.json()

  sessionStorage.setItem(SK_TOKEN, data.access_token)
  if (data.expires_in) {
    sessionStorage.setItem(SK_EXPIRY, String(Date.now() + data.expires_in * 1000))
  }

  // Cleanup
  sessionStorage.removeItem(SK_VERIFIER)
  sessionStorage.removeItem(SK_STATE)

  // Rimuovi ?code=... dall'URL senza ricaricare la pagina
  window.history.replaceState(
    {},
    '',
    window.location.origin + window.location.pathname + window.location.hash,
  )

  return true
}

// ─── Helper ──────────────────────────────────────────────────────────────────

export function isOAuthCallback() {
  return new URLSearchParams(window.location.search).has('code')
}

function getRedirectUri() {
  // origin + pathname senza hash (es. https://alexveneselli2.github.io/replenishment/)
  return window.location.origin + window.location.pathname
}
