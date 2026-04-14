import { queryMosaic } from '../server/mosaic.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { sql } = req.body || {}
  if (!sql || typeof sql !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "sql" field' })
    return
  }

  console.log('[query] SQL:', sql.slice(0, 120).replace(/\n/g, ' '))

  try {
    const data = await queryMosaic(sql)
    res.json({ data })
  } catch (err) {
    console.error('[query] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
