import { extractTableText, parseMarkdownTable } from './parser'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

function getMosaicServer() {
  const token = import.meta.env.VITE_MOSAIC_TOKEN
  const clientId = import.meta.env.VITE_MOSAIC_CLIENT_ID
  const clientSecret = import.meta.env.VITE_MOSAIC_CLIENT_SECRET

  const server = {
    type: 'url',
    url: 'https://studio.strategy.com/collaboration/mcp/mosaic',
    name: 'mosaic',
  }

  // Usa il token diretto se disponibile, altrimenti il client_secret come Bearer
  if (token) {
    server.authorization_token = token
  } else if (clientSecret) {
    server.authorization_token = clientSecret
  }

  return server
}

const SYSTEM_PROMPT =
  "Sei un assistente dati. Usa il tool Mosaic MCP per eseguire le query SQL fornite. " +
  "Schema: 'shared studio'. Restituisci solo il risultato della query come tabella markdown, nessun commento aggiuntivo."

// Queries SQL
export const QUERIES = {
  inventory: `
SELECT
  "store (store name)" AS store,
  "city (city)" AS city,
  "city (latitude)" AS lat,
  "city (longitude)" AS lon,
  "product (product name)" AS product,
  "product category (product category)" AS category,
  SUM("stock level") AS stock,
  SUM("reorder point") AS reorder_pt,
  SUM("stock level") - SUM("reorder point") AS gap,
  SUM("product price") AS price,
  SUM("store capacity") AS capacity,
  MAX("last count date (last count date)") AS last_count
FROM "gucci fashion retail inventory and replenishment"
GROUP BY 1,2,3,4,5,6
ORDER BY gap ASC
  `.trim(),

  suppliers: `
SELECT
  "supplier (supplier name)" AS supplier,
  "contact name (contact name)" AS contact,
  SUM("lead time days") AS lead_time
FROM "gucci fashion retail inventory and replenishment"
GROUP BY 1,2
ORDER BY lead_time ASC
  `.trim(),

  sales: `
SELECT
  "store (store name)" AS store,
  "product (product name)" AS product,
  SUM("quantity sold") AS total_qty_sold,
  COUNT("sale (sale id)") AS num_transactions
FROM "gucci fashion retail inventory and replenishment"
GROUP BY 1,2
ORDER BY total_qty_sold DESC
  `.trim(),
}

/**
 * Chiama l'API Anthropic con MCP Mosaic per eseguire una query SQL.
 * Restituisce l'array di oggetti parsed dalla tabella markdown.
 */
export async function queryMosaic(sqlQuery, onProgress) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'mcp-client-2025-04-04',
    'anthropic-dangerous-direct-browser-access': 'true',
  }

  if (apiKey) {
    headers['x-api-key'] = apiKey
  }

  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Esegui questa query SQL: ${sqlQuery}` }],
    mcp_servers: [getMosaicServer()],
  }

  onProgress?.('Connessione a Mosaic...')

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Errore sconosciuto')
    throw new Error(`Errore API Anthropic (${response.status}): ${errorText}`)
  }

  onProgress?.('Analisi risposta...')
  const data = await response.json()

  const tableText = extractTableText(data)
  if (!tableText) {
    // Prova a estrarre il testo di errore dal contenuto
    const textBlock = data.content?.find(b => b.type === 'text')
    throw new Error(
      `Nessuna tabella nella risposta. ${textBlock?.text ? 'Risposta: ' + textBlock.text.slice(0, 200) : ''}`
    )
  }

  return parseMarkdownTable(tableText)
}

/**
 * Carica tutti i dati necessari in sequenza.
 */
export async function loadAllData(onProgress) {
  onProgress?.('Connessione a Mosaic...')
  const inventory = await queryMosaic(QUERIES.inventory, onProgress)

  onProgress?.('Caricamento fornitori...')
  const suppliers = await queryMosaic(QUERIES.suppliers, onProgress)

  onProgress?.('Analisi vendite...')
  const sales = await queryMosaic(QUERIES.sales, onProgress)

  return { inventory, suppliers, sales }
}
