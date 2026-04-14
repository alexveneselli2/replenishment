/**
 * Frontend API client — chiama il backend Express/Vercel su /api/query.
 * Le credenziali Anthropic e Mosaic rimangono solo lato server.
 */

async function queryAPI(sql) {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(json.error || `Errore server: ${res.status}`)
  }

  return json.data ?? []
}

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

export async function loadAllData(onProgress) {
  onProgress?.('Connessione a Mosaic...')
  const inventory = await queryAPI(SQL_INVENTORY)

  onProgress?.('Caricamento fornitori...')
  const suppliers = await queryAPI(SQL_SUPPLIERS)

  onProgress?.('Analisi vendite...')
  const sales = await queryAPI(SQL_SALES)

  onProgress?.('Analisi risposta...')

  return { inventory, suppliers, sales }
}
