/**
 * Formatta un numero come valuta EUR.
 */
export function formatCurrency(value, compact = false) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  if (compact && Math.abs(value) >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(1)}M`
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `€${(value / 1_000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Formatta un numero intero con separatore delle migliaia.
 */
export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return new Intl.NumberFormat('it-IT').format(Math.round(value))
}

/**
 * Formatta una data in formato italiano.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Aggiunge N giorni a una data e restituisce la data formattata.
 */
export function addDaysFormatted(days) {
  const d = new Date()
  d.setDate(d.getDate() + Math.round(days))
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Abbrevia un nome lungo per la visualizzazione.
 */
export function truncate(str, maxLen = 32) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}
