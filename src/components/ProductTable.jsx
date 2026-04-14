import SeverityBadge, { POBadge } from './SeverityBadge'
import { getGapSeverity, getPOType, suggestedOrderQty } from '../utils/calculations'
import { formatCurrency } from '../utils/formatting'

export default function ProductTable({ products, suppliers = [], compact = false }) {
  if (!products?.length) {
    return (
      <div className="text-center text-muted py-8 text-sm">
        Nessun prodotto trovato
      </div>
    )
  }

  // Fornitore consigliato: il primo con lead time più basso
  const bestSupplier = suppliers.length > 0
    ? suppliers.reduce((a, b) => (a.lead_time <= b.lead_time ? a : b))
    : null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gold/20">
            {[
              'Prodotto',
              'Categoria',
              'Stock',
              'Reorder Pt.',
              'Gap',
              compact ? null : 'Prezzo',
              'Qtà suggerita',
              'PO',
              compact ? null : 'Fornitore',
              compact ? null : 'ETA',
            ]
              .filter(Boolean)
              .map((h) => (
                <th
                  key={h}
                  className="text-left py-2.5 px-3 text-xs text-muted uppercase tracking-wider font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {products.map((item, idx) => {
            const stock = Number(item.stock) || 0
            const reorder_pt = Number(item.reorder_pt) || 0
            const gap = Number(item.gap ?? stock - reorder_pt)
            const severity = getGapSeverity(gap)
            const poType = getPOType(gap)
            const qty = suggestedOrderQty(stock, reorder_pt)
            const leadTime = bestSupplier?.lead_time ?? 14

            // Row background by stock level
            let rowClass = 'border-b border-gold/10 transition-colors hover:bg-gold/5'
            if (stock <= 3) rowClass += ' bg-red-500/5'
            else if (gap < 0) rowClass += ' bg-amber-500/5'

            const eta = new Date()
            eta.setDate(eta.getDate() + leadTime)
            const etaStr = eta.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })

            return (
              <tr key={`${item.store}-${item.product}-${idx}`} className={rowClass}>
                {/* Prodotto */}
                <td className="py-2.5 px-3 text-off-white font-medium max-w-[180px]">
                  <span className="truncate block" title={item.product}>
                    {item.product}
                  </span>
                </td>

                {/* Categoria */}
                <td className="py-2.5 px-3">
                  <span className="text-muted text-xs">{item.category}</span>
                </td>

                {/* Stock */}
                <td className="py-2.5 px-3 text-center">
                  <span className={`font-semibold ${stock <= 3 ? 'text-red-400' : 'text-off-white'}`}>
                    {stock}
                  </span>
                </td>

                {/* Reorder Point */}
                <td className="py-2.5 px-3 text-center text-muted">{reorder_pt}</td>

                {/* Gap */}
                <td className="py-2.5 px-3 text-center">
                  <SeverityBadge severity={gap >= 0 ? 'OK' : severity} />
                  <span className={`ml-1.5 text-xs font-semibold ${gap < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {gap > 0 ? '+' : ''}{gap}
                  </span>
                </td>

                {/* Prezzo */}
                {!compact && (
                  <td className="py-2.5 px-3 text-muted text-right whitespace-nowrap">
                    {formatCurrency(item.price)}
                  </td>
                )}

                {/* Quantità suggerita */}
                <td className="py-2.5 px-3 text-center">
                  {qty > 0 ? (
                    <span className="text-gold font-semibold">{qty}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                {/* PO Type */}
                <td className="py-2.5 px-3 text-center">
                  {qty > 0 && <POBadge type={poType} />}
                </td>

                {/* Fornitore */}
                {!compact && (
                  <td className="py-2.5 px-3 text-muted text-xs max-w-[140px]">
                    <span className="truncate block" title={bestSupplier?.supplier}>
                      {bestSupplier?.supplier ?? '—'}
                    </span>
                  </td>
                )}

                {/* ETA */}
                {!compact && (
                  <td className="py-2.5 px-3 text-muted text-xs whitespace-nowrap">
                    {qty > 0 ? etaStr : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
