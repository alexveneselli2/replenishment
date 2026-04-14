/**
 * Browser-side Anthropic API caller with Mosaic MCP.
 * Credentials are baked in at build time via Vite env vars.
 */

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MOSAIC_TOKEN = import.meta.env.VITE_MOSAIC_TOKEN
const MOSAIC_MCP_URL = 'https://studio.strategy.com/collaboration/mcp/mosaic'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

// ─── SQL queries ──────────────────────────────────────────────────────────────
const SQL_INVENTORY = `
SELECT
  "store (store name)"           AS store,
  "city (city)"                  AS city,
  "city (latitude)"              AS lat,
  "city (longitude)"             AS lon,
  "product (product name)"       AS product,
  "product category (product category)" AS category,
  SUM("stock level")             AS stock,
  SUM("reorder point")           AS reorder_pt,
  SUM("stock level") - SUM("reorder point") AS gap,
  SUM("product price")           AS price,
  SUM("store capacity")          AS capacity,
  MAX("last count date (last count date)") AS last_count
FROM "gucci fashion retail inventory and replenishment"
GROUP BY 1,2,3,4,5,6
ORDER BY gap ASC
`.trim()

const SQL_SUPPLIERS = `
SELECT
  "supplier (supplier name)"     AS supplier,
  "contact name (contact name)"  AS contact,
  SUM("lead time days")          AS lead_time
FROM "gucci fashion retail inventory and replenishment"
GROUP BY 1,2
ORDER BY lead_time ASC
`.trim()

const SQL_SALES = `
SELECT
  "store (store name)"           AS store,
  "product (product name)"       AS product,
  SUM("quantity sold")           AS total_qty_sold,
  COUNT("sale (sale id)")        AS num_transactions
FROM "gucci fashion retail inventory and replenishment"
GROUP BY 1,2
ORDER BY total_qty_sold DESC
`.trim()

// ─── Markdown table parser ────────────────────────────────────────────────────
function parseMarkdownTable(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const headerIdx = lines.findIndex((l) => l.startsWith('|') && l.endsWith('|'))
  if (headerIdx === -1) return []

  const parseRow = (line) =>
    line.split('|').slice(1, -1).map((c) => c.trim())

  const headers = parseRow(lines[headerIdx]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_')
  )

  const rows = []
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('|')) break
    const cells = parseRow(line)
    const obj = {}
    headers.forEach((h, idx) => {
      const raw = cells[idx] ?? ''
      const num = Number(raw.replace(/,/g, ''))
      obj[h] = raw !== '' && !isNaN(num) && raw !== '-' ? num : raw
    })
    rows.push(obj)
  }
  return rows
}

// ─── Core query ───────────────────────────────────────────────────────────────
async function queryMosaic(sql) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY non configurata.')
  }

  const body = {
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content:
          'Execute this SQL query against the Gucci replenishment dataset and return ONLY a markdown table — no commentary.\n\nSQL:\n' +
          sql,
      },
    ],
    mcp_servers: [
      {
        type: 'url',
        url: MOSAIC_MCP_URL,
        name: 'mosaic',
        ...(MOSAIC_TOKEN ? { authorization_token: MOSAIC_TOKEN } : {}),
      },
    ],
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'mcp-client-2025-11-20',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json)
    throw new Error(`Anthropic API (${res.status}): ${msg}`)
  }

  const textBlock = (json.content || []).find((b) => b.type === 'text')
  if (!textBlock) throw new Error('Nessuna risposta testuale da Anthropic.')

  const rows = parseMarkdownTable(textBlock.text)
  if (rows.length === 0) {
    throw new Error(
      'Nessuna tabella nella risposta. Risposta: ' + textBlock.text.slice(0, 200)
    )
  }
  return rows
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function loadAllData(onProgress) {
  onProgress?.('Connessione a Mosaic...')
  const inventory = await queryMosaic(SQL_INVENTORY)

  onProgress?.('Interrogazione inventario...')
  const suppliers = await queryMosaic(SQL_SUPPLIERS)

  onProgress?.('Caricamento fornitori...')
  const sales = await queryMosaic(SQL_SALES)

  onProgress?.('Analisi vendite...')

  return { inventory, suppliers, sales }
}
