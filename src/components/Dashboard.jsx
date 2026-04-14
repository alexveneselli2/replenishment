import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import KPICard from './KPICard'
import SeverityBadge from './SeverityBadge'
import FilterBar from './FilterBar'
import { computeDashboardKPIs } from '../utils/calculations'
import { formatCurrency, formatNumber } from '../utils/formatting'

export default function Dashboard() {
  const { stores, inventory, loading } = useStore()
  const navigate = useNavigate()

  const [filters, setFilters] = useState({
    search: '',
    severity: 'Tutti',
    category: 'Tutte',
  })

  const kpis = useMemo(() => computeDashboardKPIs(inventory), [inventory])

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const searchTerm = filters.search.toLowerCase()
      const matchSearch =
        !searchTerm ||
        store.name.toLowerCase().includes(searchTerm) ||
        store.city.toLowerCase().includes(searchTerm)

      const matchSeverity =
        filters.severity === 'Tutti' || store.severity === filters.severity

      // Category filter: check if store has at least one product in that category below reorder
      const matchCategory =
        filters.category === 'Tutte' ||
        store.products.some(
          (p) => p.category === filters.category && Number(p.gap ?? p.stock - p.reorder_pt) < 0
        )

      return matchSearch && matchSeverity && matchCategory
    })
  }, [stores, filters])

  const handleStoreClick = (store) => {
    useStore.getState().setSelectedStore(store.name)
    navigate(`/store/${encodeURIComponent(store.name)}`)
  }

  const handleSimulateStore = (e, store) => {
    e.stopPropagation()
    useStore.getState().setSelectedStore(store.name)
    navigate(`/simulator/${encodeURIComponent(store.name)}`)
  }

  if (loading) return null // Loading gestito in App.jsx

  return (
    <div className="animate-slide-up">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Negozi in allerta"
          value={formatNumber(kpis.storesInAlert)}
          sub={`su ${stores.length} totali`}
          icon="🏪"
          color="critical"
        />
        <KPICard
          label="SKU sotto soglia"
          value={formatNumber(kpis.skusBelowReorder)}
          sub="prodotti da riordinare"
          icon="📦"
          color="high"
        />
        <KPICard
          label="Gap stock totale"
          value={formatNumber(kpis.totalGap)}
          sub="pezzi mancanti aggregati"
          icon="📉"
          color="gold"
        />
        <KPICard
          label="Valore a rischio"
          value={formatCurrency(kpis.valueAtRisk, true)}
          sub="gap × prezzo retail"
          icon="💶"
          color="medium"
        />
      </div>

      {/* Filtri */}
      <div className="mb-6">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Header lista */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-gold text-lg">
          Negozi ({filteredStores.length})
        </h2>
        <span className="text-xs text-muted">Ordinati per criticità</span>
      </div>

      {/* Lista store */}
      {filteredStores.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-4xl mb-3">🔍</p>
          <p>Nessun negozio corrisponde ai filtri selezionati</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStores.map((store, idx) => (
            <StoreRow
              key={store.name}
              store={store}
              rank={idx + 1}
              onClick={() => handleStoreClick(store)}
              onSimulate={(e) => handleSimulateStore(e, store)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StoreRow({ store, rank, onClick, onSimulate }) {
  const isAlert = store.severity !== 'OK'

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-4 p-4 rounded-lg border cursor-pointer
        transition-all duration-200 hover:scale-[1.005] hover:shadow-gold
        ${isAlert
          ? 'bg-charcoal/60 border-gold/20 hover:border-gold/40'
          : 'bg-surface/30 border-gold/10 hover:border-gold/20'
        }
      `}
    >
      {/* Rank */}
      <span className="text-muted/50 text-xs font-mono w-6 text-right flex-shrink-0">
        {rank}
      </span>

      {/* Severity indicator */}
      <div className="flex-shrink-0">
        <SeverityBadge severity={store.severity} />
      </div>

      {/* Store name + city */}
      <div className="flex-1 min-w-0">
        <p className="text-off-white font-medium truncate">{store.name}</p>
        <p className="text-muted text-xs">{store.city}</p>
      </div>

      {/* SKU sotto reorder */}
      <div className="text-center flex-shrink-0 hidden sm:block">
        <p className="text-xs text-muted">SKU sotto soglia</p>
        <p className={`font-semibold text-sm ${store.skusBelowReorder > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {store.skusBelowReorder}
        </p>
      </div>

      {/* Gap totale */}
      <div className="text-center flex-shrink-0 w-20">
        <p className="text-xs text-muted hidden sm:block">Gap totale</p>
        <p className={`font-semibold ${store.totalGap < -20 ? 'text-red-400' : store.totalGap < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {store.totalGap < 0 ? store.totalGap : '+' + store.totalGap}
        </p>
      </div>

      {/* Capacity bar */}
      {store.capacity > 0 && (
        <div className="hidden lg:block w-24">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gold/60 rounded-full"
                style={{
                  width: `${Math.min(100, (store.products.length / store.capacity) * 100)}%`,
                }}
              />
            </div>
            <span className="text-muted text-xs">{store.products.length}/{store.capacity}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onSimulate}
          className="
            px-3 py-1.5 text-xs border border-gold/30 text-gold rounded
            hover:bg-gold/10 hover:border-gold/60 transition-colors
            hidden sm:block
          "
        >
          Simula
        </button>
        <span className="text-gold/40 self-center">›</span>
      </div>
    </div>
  )
}
