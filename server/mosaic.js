/**
 * Mosaic MCP query layer.
 * Calls the Anthropic Messages API with the Mosaic MCP server attached,
 * extracts the markdown table from the assistant reply, and parses it
 * into an array of plain objects.
 */

import fetch from 'node-fetch'
import { getAccessToken } from './auth.js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MOSAIC_MCP_URL = 'https://studio.strategy.com/collaboration/mcp/mosaic'
const MODEL = 'claude-opus-4-6'

// ─── Anthropic request ────────────────────────────────────────────────────────
async function callAnthropic(sql, mosaicToken) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY env var')

  const body = {
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Execute this SQL query against the Gucci replenishment dataset and return the results as a markdown table. Do not add commentary — only the table.\n\nSQL:\n${sql}`,
      },
    ],
    mcp_servers: [
      {
        type: 'url',
        url: MOSAIC_MCP_URL,
        name: 'mosaic',
        authorization_token: mosaicToken,
      },
    ],
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'mcp-client-2025-11-20',
    },
    body: JSON.stringify(body),
    timeout: 60_000,
  })

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = {} }

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 400)}`)
  }

  // Extract text from content blocks
  const blocks = json.content || []
  const textBlock = blocks.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text block in Anthropic response')
  return textBlock.text
}

// ─── Markdown table parser ────────────────────────────────────────────────────
function parseMarkdownTable(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // Find the first header line (contains pipes)
  const headerIdx = lines.findIndex((l) => l.startsWith('|') && l.endsWith('|'))
  if (headerIdx === -1) {
    // No table found — return empty
    console.warn('[mosaic] No markdown table found in response. Response snippet:', text.slice(0, 300))
    return []
  }

  const parseRow = (line) =>
    line
      .split('|')
      .slice(1, -1)  // remove leading/trailing empty segments
      .map((c) => c.trim())

  const headers = parseRow(lines[headerIdx]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))

  const rows = []
  for (let i = headerIdx + 2; i < lines.length; i++) {   // skip separator line
    const line = lines[i]
    if (!line.startsWith('|')) break
    const cells = parseRow(line)
    const obj = {}
    headers.forEach((h, idx) => {
      const raw = cells[idx] ?? ''
      // Coerce numeric-looking values
      const num = Number(raw.replace(/,/g, ''))
      obj[h] = raw !== '' && !isNaN(num) && raw !== '-' ? num : raw
    })
    rows.push(obj)
  }

  return rows
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function queryMosaic(sql) {
  const mosaicToken = await getAccessToken()
  const reply = await callAnthropic(sql, mosaicToken)
  return parseMarkdownTable(reply)
}
