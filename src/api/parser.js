/**
 * Estrae il testo della tabella markdown dalla risposta API Anthropic + Mosaic MCP.
 * La risposta può contenere blocchi di tipo mcp_tool_result o text con tabelle markdown.
 */
export function extractTableText(apiResponse) {
  if (!apiResponse?.content) return null

  // Prima cerca nei blocchi mcp_tool_result
  for (const block of apiResponse.content) {
    if (block.type === 'mcp_tool_result' && block.content) {
      for (const inner of block.content) {
        if (inner.text && inner.text.includes('|')) return inner.text
      }
    }
    // Formato alternativo: tool_result con content array
    if (block.type === 'tool_result' && Array.isArray(block.content)) {
      for (const inner of block.content) {
        if (inner.type === 'text' && inner.text?.includes('|')) return inner.text
      }
    }
  }

  // Fallback: cerca nei blocchi text
  for (const block of apiResponse.content) {
    if (block.type === 'text' && block.text?.includes('|')) {
      // Verifica che sia effettivamente una tabella
      const lines = block.text.split('\n').filter(l => l.trim().startsWith('|'))
      if (lines.length > 2) return block.text
    }
  }

  return null
}

/**
 * Converte una tabella markdown in array di oggetti.
 * Gestisce separatori decimali con virgola (es. "2,950" → 2950).
 */
export function parseMarkdownTable(tableText) {
  if (!tableText) return []

  // Estrai solo le righe che contengono pipe
  const lines = tableText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'))

  if (lines.length < 3) return []

  // Parse header
  const headers = splitRow(lines[0])

  // Salta la riga separatore (contiene solo -, : e |)
  const dataLines = lines.slice(1).filter(l => !isSeparatorRow(l))

  return dataLines
    .map(line => {
      const cells = splitRow(line)
      const obj = {}
      headers.forEach((header, i) => {
        const raw = (cells[i] ?? '').trim()
        obj[header] = parseCell(raw)
      })
      return obj
    })
    .filter(row => Object.values(row).some(v => v !== '' && v !== null))
}

function splitRow(line) {
  return line
    .slice(1, -1)          // rimuovi | iniziale e finale
    .split('|')
    .map(cell => cell.trim())
}

function isSeparatorRow(line) {
  // Una riga separatore contiene solo -, :, spazi e |
  return /^[\|\s\-:]+$/.test(line)
}

function parseCell(raw) {
  if (raw === '' || raw === 'NULL' || raw === 'null') return null

  // Rimuovi separatori delle migliaia e prova a convertire in numero
  const cleaned = raw.replace(/,(?=\d{3}(\D|$))/g, '')
  const num = Number(cleaned)

  if (!isNaN(num) && cleaned !== '') return num

  return raw
}
