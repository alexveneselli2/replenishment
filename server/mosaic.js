/**
 * Mosaic MCP client — chiama il server MCP direttamente via HTTP
 * senza passare da Anthropic. Più veloce, nessun token LLM consumato.
 *
 * Schema: "shared studio"
 * Tool:   "query" { schema, query }
 */

import { getAccessToken } from './auth.js'

const MOSAIC_MCP_URL = 'https://studio.strategy.com/collaboration/mcp/mosaic'
const MOSAIC_SCHEMA = 'shared studio'

// ─── SSE parser ───────────────────────────────────────────────────────────────
function parseSse(text) {
  for (const chunk of text.split('\n\n')) {
    const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '))
    if (dataLine) {
      try { return JSON.parse(dataLine.slice(6)) } catch {}
    }
  }
  return null
}

// ─── Generic MCP POST ────────────────────────────────────────────────────────
async function mcpPost(token, body, sessionId = null) {
  const res = await fetch(MOSAIC_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`,
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok && res.status !== 202) {
    const text = await res.text()
    throw new Error(`MCP ${res.status}: ${text.slice(0, 300)}`)
  }

  const newSessionId = res.headers.get('mcp-session-id')
  const ct = res.headers.get('content-type') || ''

  let json = null
  if (res.status !== 202) {
    const text = await res.text()
    if (text) {
      json = ct.includes('text/event-stream') ? parseSse(text) : JSON.parse(text)
    }
  }

  return { json, sessionId: newSessionId }
}

// ─── Markdown table parser ────────────────────────────────────────────────────
function parseMarkdownTable(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const headerIdx = lines.findIndex((l) => l.startsWith('|') && l.endsWith('|'))
  if (headerIdx === -1) return []

  const parseRow = (line) => line.split('|').slice(1, -1).map((c) => c.trim())
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

// ─── Public API ───────────────────────────────────────────────────────────────
export async function queryMosaic(sql) {
  const token = await getAccessToken()

  // 1. Initialize session
  const { json: initJson, sessionId } = await mcpPost(token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'gucci-replenishment', version: '1.0.0' },
    },
  })

  const sid = sessionId || initJson?.result?.sessionId
  if (!sid) throw new Error('MCP: nessun session ID ricevuto durante initialize')

  // 2. Initialized notification (no response expected)
  await mcpPost(token, { jsonrpc: '2.0', method: 'notifications/initialized' }, sid)

  // 3. Call the query tool
  const { json: callJson } = await mcpPost(
    token,
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'query',
        arguments: { schema: MOSAIC_SCHEMA, query: sql },
      },
    },
    sid
  )

  if (callJson?.error) {
    throw new Error(callJson.error.message || JSON.stringify(callJson.error))
  }

  const toolResult = callJson?.result
  if (toolResult?.isError) {
    throw new Error(toolResult.content?.[0]?.text || 'Query Mosaic fallita')
  }

  const textBlock = (toolResult?.content || []).find((c) => c.type === 'text')
  if (!textBlock?.text) throw new Error('Nessun contenuto testuale nella risposta Mosaic')

  const rows = parseMarkdownTable(textBlock.text)
  if (rows.length === 0) {
    throw new Error(`Nessun dato. Risposta: ${textBlock.text.slice(0, 200)}`)
  }
  return rows
}
