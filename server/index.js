/**
 * Express backend for Gucci Replenishment Intelligence.
 *
 * Routes:
 *   POST /api/query  { sql: string } → { data: object[] }
 *   GET  /api/health → { ok: true }
 *
 * In production:
 *   Serves the Vite-built static files from ../dist/
 *   All non-API routes serve index.html (SPA fallback)
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { queryMosaic } from './mosaic.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3001
const IS_PROD = process.env.NODE_ENV === 'production'

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json())

if (!IS_PROD) {
  // In dev, Vite runs on port 5173; allow it to call our API
  app.use(cors({ origin: 'http://localhost:5173' }))
}

// ─── API routes ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

app.post('/api/query', async (req, res) => {
  const { sql } = req.body || {}

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "sql" field in request body' })
  }

  console.log('[query] SQL:', sql.slice(0, 120).replace(/\n/g, ' '))

  try {
    const data = await queryMosaic(sql)
    res.json({ data })
  } catch (err) {
    console.error('[query] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Static files (production) ────────────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))

  // SPA fallback — serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Gucci Replenishment API running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`)
})
