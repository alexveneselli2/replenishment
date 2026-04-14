import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore, SCENARIO_PRESETS } from '../stores/useStore'
import StockChart from './StockChart'
import SeverityBadge from './SeverityBadge'
import { simulateProduct, aggregateSimKPIs } from '../utils/calculations'
import { formatCurrency, formatNumber, addDaysFormatted } from '../utils/formatting'

// Slider con label
function ParamSlider({ label, value, min, max, step = 1, unit = '', onChange, format }) {
  const display = format ? format(value) : `${value}${unit}`
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted uppercase tracking-wider">{label}</span>
        <span className="text-gold font-semibold">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none bg-surface rounded-full cursor-pointer accent-gold"
      />
      <div className="flex justify-between text-muted/50 text-xs">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export default function Simulator() {
  const { storeId } = useParams()
  const { stores, suppliers, simParams, updateSimParams, applyScenario, getProductDemand } = useStore()

  const storeName = storeId ? decodeURIComponent(storeId) : null
  const store = storeName ? stores.find((s) => s.name === storeName) : null
  const products = store?.products ?? []

  // Se non c'è uno store nel path, usa il primo store con problemi
  const activeProducts = products.length > 0
    ? products
    : stores[0]?.products ?? []

  const activeStoreName = store?.name ?? stores[0]?.name ?? ''

  const [selectedProductIdx, setSelectedProductIdx] = useState(0)
  const selectedProduct = activeProducts[selectedProductIdx] ?? null

  const selectedSupplier = suppliers.find(s => s.supplier === simParams.selected_supplier)
  const effectiveLeadTime = simParams.lead_time_override ??
    selectedSupplier?.lead_time ?? 14

  // Domanda del prodotto selezionato
  const productDemand = selectedProduct
    ? getProductDemand(activeStoreName, selectedProduct.product)
    : 2

  // Params per questo prodotto
  const productParams = {
    daily_demand: simParams.product_demands[`${activeStoreName}__${selectedProduct?.product}`] ?? productDemand,
    coverage_days: simParams.coverage_days,
    safety_stock_pct: simParams.safety_stock_pct,
    lead_time: effectiveLeadTime,
    seasonality_factor: simParams.seasonality_factor,
  }

  // Simula tutti i prodotti
  const simResults = useMemo(() => {
    return activeProducts.map((p) => {
      const demand = simParams.product_demands[`${activeStoreName}__${p.product}`] ?? 2
      return simulateProduct(p, {
        daily_demand: demand,
        coverage_days: simParams.coverage_days,
        safety_stock_pct: simParams.safety_stock_pct,
        lead_time: effectiveLeadTime,
        seasonality_factor: simParams.seasonality_factor,
      })
    })
  }, [activeProducts, simParams, effectiveLeadTime, activeStoreName])

  const kpis = useMemo(() => aggregateSimKPIs(simResults), [simResults])

  const handleDemandChange = (val) => {
    if (!selectedProduct) return
    updateSimParams({
      product_demands: {
        ...simParams.product_demands,
        [`${activeStoreName}__${selectedProduct.product}`]: val,
      },
    })
  }

  return (
    <div className="animate-slide-up">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted mb-6">
        <Link to="/" className="hover:text-gold transition-colors">Dashboard</Link>
        {store && (
          <>
            <span>›</span>
            <Link
              to={`/store/${encodeURIComponent(store.name)}`}
              className="hover:text-gold transition-colors"
            >
              {store.name}
            </Link>
          </>
        )}
        <span>›</span>
        <span className="text-off-white">Simulatore</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-gold text-2xl">Simulatore Replenishment</h1>
          {activeStoreName && (
            <p className="text-muted text-sm mt-1">📍 {activeStoreName}</p>
          )}
        </div>
      </div>

      {/* Scenario presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(SCENARIO_PRESETS).map(([key, scenario]) => (
          <button
            key={key}
            onClick={() => applyScenario(key)}
            className="
              px-4 py-2 text-xs border border-gold/30 text-gold/80 rounded
              hover:bg-gold/10 hover:border-gold/60 hover:text-gold
              transition-colors flex items-center gap-1.5
            "
          >
            <span>{scenario.icon}</span>
            {scenario.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Colonna sinistra: Parametri ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-charcoal/60 border border-gold/20 rounded-lg p-5">
            <h3 className="font-serif text-gold text-sm uppercase tracking-widest mb-4">
              Parametri Simulazione
            </h3>

            <div className="space-y-5">
              {/* Domanda giornaliera prodotto selezionato */}
              <ParamSlider
                label="Domanda giornaliera (prodotto selezionato)"
                value={productParams.daily_demand}
                min={0}
                max={20}
                step={0.5}
                unit=" pz/g"
                onChange={handleDemandChange}
              />

              {/* Giorni copertura */}
              <ParamSlider
                label="Giorni di copertura target"
                value={simParams.coverage_days}
                min={7}
                max={90}
                unit=" gg"
                onChange={(v) => updateSimParams({ coverage_days: v })}
              />

              {/* Safety stock */}
              <ParamSlider
                label="Safety stock"
                value={simParams.safety_stock_pct}
                min={0}
                max={50}
                unit="%"
                onChange={(v) => updateSimParams({ safety_stock_pct: v })}
              />

              {/* Lead time */}
              <ParamSlider
                label="Lead time override"
                value={effectiveLeadTime}
                min={1}
                max={45}
                unit=" gg"
                onChange={(v) => updateSimParams({ lead_time_override: v })}
              />

              {/* Stagionalità */}
              <ParamSlider
                label="Fattore stagionalità"
                value={simParams.seasonality_factor}
                min={0.5}
                max={3.0}
                step={0.1}
                format={(v) => `${v.toFixed(1)}×`}
                onChange={(v) => updateSimParams({ seasonality_factor: v })}
              />
            </div>

            <button
              onClick={() => updateSimParams({
                coverage_days: 30,
                safety_stock_pct: 15,
                seasonality_factor: 1.0,
                lead_time_override: null,
              })}
              className="mt-4 w-full text-xs text-muted border border-gold/10 rounded py-1.5 hover:border-gold/30 hover:text-off-white transition-colors"
            >
              ↺ Ripristina parametri
            </button>
          </div>

          {/* Selezione fornitore */}
          <div className="bg-charcoal/60 border border-gold/20 rounded-lg p-5">
            <h3 className="font-serif text-gold text-sm uppercase tracking-widest mb-3">
              Fornitore
            </h3>
            <select
              value={simParams.selected_supplier ?? ''}
              onChange={(e) => {
                const sup = suppliers.find(s => s.supplier === e.target.value)
                if (sup) {
                  updateSimParams({
                    selected_supplier: sup.supplier,
                    lead_time_override: sup.lead_time,
                  })
                } else {
                  updateSimParams({ selected_supplier: null, lead_time_override: null })
                }
              }}
              className="w-full px-3 py-2 text-sm bg-surface/60 border border-gold/20 rounded text-off-white focus:outline-none focus:border-gold/50 transition-colors"
            >
              <option value="" className="bg-charcoal">— Nessun fornitore selezionato —</option>
              {suppliers.map((s) => (
                <option key={s.supplier} value={s.supplier} className="bg-charcoal">
                  {s.supplier} ({s.lead_time} gg)
                </option>
              ))}
            </select>
            {selectedSupplier && (
              <div className="mt-3 text-xs text-muted space-y-1 bg-surface/30 rounded p-3">
                <p><span className="text-gold">Lead time:</span> {selectedSupplier.lead_time} giorni</p>
                <p><span className="text-gold">Contatto:</span> {selectedSupplier.contact}</p>
                <p><span className="text-gold">Consegna stimata:</span> {addDaysFormatted(selectedSupplier.lead_time)}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Colonna destra: Chart + KPI ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPI simulazione */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SimKPI label="Costo ordine" value={formatCurrency(kpis.total_cost, true)} />
            <SimKPI label="Pezzi totali" value={formatNumber(kpis.total_qty)} />
            <SimKPI label="Copertura media" value={`${kpis.avg_coverage} gg`} />
            <SimKPI
              label="% prodotti critici"
              value={`${kpis.critical_pct}%`}
              highlight={kpis.critical_pct > 30}
            />
          </div>

          {/* Selezione prodotto */}
          {activeProducts.length > 0 && (
            <div className="bg-charcoal/60 border border-gold/20 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-gold text-sm uppercase tracking-widest">
                  Proiezione Stock
                </h3>
                <select
                  value={selectedProductIdx}
                  onChange={(e) => setSelectedProductIdx(Number(e.target.value))}
                  className="text-xs bg-surface/60 border border-gold/20 rounded px-2 py-1 text-off-white focus:outline-none focus:border-gold/50"
                >
                  {activeProducts.map((p, i) => (
                    <option key={p.product} value={i} className="bg-charcoal">
                      {p.product}
                    </option>
                  ))}
                </select>
              </div>
              <StockChart product={selectedProduct} params={productParams} />
            </div>
          )}

          {/* Tabella risultati */}
          <div className="bg-charcoal/60 border border-gold/20 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-gold/10">
              <h3 className="font-serif text-gold text-sm uppercase tracking-widest">
                Risultati per prodotto
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/10">
                    {['Prodotto', 'Stock', 'Ordine', 'Stockout (gg)', 'Urgenza', 'Costo'].map((h) => (
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
                  {simResults.map((r, idx) => (
                    <tr
                      key={r.product}
                      onClick={() => setSelectedProductIdx(idx)}
                      className={`
                        border-b border-gold/10 cursor-pointer transition-colors
                        hover:bg-gold/5
                        ${idx === selectedProductIdx ? 'bg-gold/10' : ''}
                      `}
                    >
                      <td className="py-2.5 px-3 text-off-white max-w-[160px]">
                        <span className="truncate block text-xs" title={r.product}>{r.product}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted">{r.stock}</td>
                      <td className="py-2.5 px-3 text-center">
                        {r.order_qty > 0
                          ? <span className="text-gold font-semibold">{r.order_qty}</span>
                          : <span className="text-muted">—</span>
                        }
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {r.days_until_stockout !== null
                          ? <span className={r.days_until_stockout < effectiveLeadTime ? 'text-red-400 font-semibold' : 'text-muted'}>
                              {r.days_until_stockout}
                            </span>
                          : <span className="text-emerald-400">∞</span>
                        }
                      </td>
                      <td className="py-2.5 px-3">
                        <SeverityBadge severity={r.urgency} />
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted whitespace-nowrap">
                        {r.total_cost > 0 ? formatCurrency(r.total_cost) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gold/30 bg-gold/5">
                    <td colSpan={2} className="py-3 px-3 text-gold font-semibold text-xs uppercase tracking-wider">
                      Totale
                    </td>
                    <td className="py-3 px-3 text-center text-gold font-bold">
                      {formatNumber(kpis.total_qty)}
                    </td>
                    <td colSpan={2} />
                    <td className="py-3 px-3 text-right text-gold font-bold whitespace-nowrap">
                      {formatCurrency(kpis.total_cost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SimKPI({ label, value, highlight }) {
  return (
    <div className="bg-charcoal/60 border border-gold/20 rounded-lg p-3 text-center">
      <p className="text-muted text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-serif text-lg ${highlight ? 'text-red-400' : 'text-gold'}`}>
        {value}
      </p>
    </div>
  )
}
