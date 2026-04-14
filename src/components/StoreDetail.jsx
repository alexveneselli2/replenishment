import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import ProductTable from './ProductTable'
import SeverityBadge from './SeverityBadge'
import { suggestedOrderQty } from '../utils/calculations'
import { formatCurrency, formatNumber } from '../utils/formatting'

export default function StoreDetail() {
  const { storeId } = useParams()
  const navigate = useNavigate()
  const { stores, suppliers, setSelectedStore } = useStore()

  const storeName = decodeURIComponent(storeId ?? '')
  const store = stores.find((s) => s.name === storeName)

  if (!store) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <p className="text-4xl mb-4">🏪</p>
        <p className="text-off-white text-lg mb-2">Negozio non trovato</p>
        <p className="text-muted mb-6">"{storeName}"</p>
        <Link to="/" className="btn-gold px-6 py-2 rounded text-sm">
          ← Torna alla Dashboard
        </Link>
      </div>
    )
  }

  const handleSimulate = () => {
    setSelectedStore(store.name)
    navigate(`/simulator/${encodeURIComponent(store.name)}`)
  }

  // Ordine totale suggerito
  const orderSummary = useMemo(() => {
    let totalQty = 0
    let totalValue = 0
    for (const p of store.products) {
      const qty = suggestedOrderQty(Number(p.stock) || 0, Number(p.reorder_pt) || 0)
      totalQty += qty
      totalValue += qty * (Number(p.price) || 0)
    }
    return { totalQty, totalValue }
  }, [store.products])

  const productsBelow = store.products.filter(
    (p) => Number(p.gap ?? p.stock - p.reorder_pt) < 0
  )
  const productsOk = store.products.filter(
    (p) => Number(p.gap ?? p.stock - p.reorder_pt) >= 0
  )

  return (
    <div className="animate-slide-up">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted mb-6">
        <Link to="/" className="hover:text-gold transition-colors">
          Dashboard
        </Link>
        <span>›</span>
        <span className="text-off-white">{store.name}</span>
      </nav>

      {/* Store Header */}
      <div className="bg-charcoal/60 border border-gold/20 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-serif text-gold text-2xl">{store.name}</h1>
              <SeverityBadge severity={store.severity} size="lg" />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted">
              <span>📍 {store.city}</span>
              {store.lat && store.lon && (
                <span className="font-mono text-xs">
                  {Number(store.lat).toFixed(4)}, {Number(store.lon).toFixed(4)}
                </span>
              )}
              {store.capacity > 0 && (
                <span>🏬 Capacità {formatNumber(store.capacity)} pz</span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSimulate}
              className="
                px-5 py-2.5 bg-gold text-navy font-semibold text-sm rounded
                hover:bg-gold-light transition-colors
              "
            >
              ⚡ Simula Replenishment
            </button>
          </div>
        </div>

        {/* Stats rapide */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gold/10">
          <StatMini label="SKU totali" value={store.products.length} />
          <StatMini
            label="SKU sotto soglia"
            value={store.skusBelowReorder}
            highlight={store.skusBelowReorder > 0}
          />
          <StatMini
            label="Pezzi da ordinare"
            value={formatNumber(orderSummary.totalQty)}
            highlight={orderSummary.totalQty > 0}
          />
          <StatMini
            label="Valore ordine stimato"
            value={formatCurrency(orderSummary.totalValue, true)}
            highlight={orderSummary.totalValue > 0}
          />
        </div>
      </div>

      {/* Prodotti critici */}
      {productsBelow.length > 0 && (
        <section className="mb-6">
          <h2 className="font-serif text-gold text-lg mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Prodotti sotto reorder point ({productsBelow.length})
          </h2>
          <div className="bg-charcoal/60 border border-gold/20 rounded-lg overflow-hidden">
            <ProductTable products={productsBelow} suppliers={suppliers} />
          </div>
        </section>
      )}

      {/* Prodotti ok */}
      {productsOk.length > 0 && (
        <section>
          <h2 className="font-serif text-gold/60 text-lg mb-3">
            Prodotti nella norma ({productsOk.length})
          </h2>
          <div className="bg-charcoal/40 border border-gold/10 rounded-lg overflow-hidden">
            <ProductTable products={productsOk} suppliers={suppliers} />
          </div>
        </section>
      )}

      {/* Order summary footer */}
      {orderSummary.totalQty > 0 && (
        <div className="mt-6 bg-gold/10 border border-gold/30 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-muted text-xs uppercase tracking-wider mb-1">Riepilogo ordine consigliato</p>
            <p className="text-off-white">
              <span className="text-gold font-serif text-xl mr-2">{formatNumber(orderSummary.totalQty)} pz</span>
              <span className="text-muted text-sm">·</span>
              <span className="text-gold font-semibold ml-2">{formatCurrency(orderSummary.totalValue)}</span>
            </p>
          </div>
          <button
            onClick={handleSimulate}
            className="px-6 py-2.5 bg-gold text-navy font-semibold text-sm rounded hover:bg-gold-light transition-colors"
          >
            Ottimizza con il simulatore →
          </button>
        </div>
      )}
    </div>
  )
}

function StatMini({ label, value, highlight }) {
  return (
    <div>
      <p className="text-muted text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`font-semibold text-lg ${highlight ? 'text-gold' : 'text-off-white'}`}>
        {value}
      </p>
    </div>
  )
}
