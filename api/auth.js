/**
 * /api/auth — avvia il flusso OAuth Authorization Code con PKCE
 * Redirect verso Strategy Studio per il login utente.
 */

import { randomBytes, createHash } from 'crypto'

const BASE_URL = process.env.MOSAIC_BASE_URL || 'https://studio.strategy.com'
const AUTH_ENDPOINT = `${BASE_URL}/MicroStrategyLibrary/oauth2/authorize`
const CLIENT_ID = process.env.MOSAIC_CLIENT_ID || ''

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export default function handler(req, res) {
  if (!CLIENT_ID) {
    res.status(500).send('MOSAIC_CLIENT_ID non configurato su Vercel.')
    return
  }

  // PKCE
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())

  // Costruisci redirect URI dinamicamente dall'host della richiesta
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const redirectUri = `${proto}://${host}/api/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid offline_access',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: verifier, // usiamo il verifier come state per ritrovarlo nel callback
  })

  // Salva verifier in cookie httpOnly per il callback
  res.setHeader('Set-Cookie', `pkce_verifier=${verifier}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`)
  res.redirect(`${AUTH_ENDPOINT}?${params}`)
}
