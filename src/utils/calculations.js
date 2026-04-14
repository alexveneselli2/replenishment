/**
 * Deduplicazione inventario per store + product.
 * Le righe Mosaic sono moltiplicate per fornitore.
 */
export function deduplicateInventory(items) {
  const seen = new Map()
  for (const item of items) {
    const key = `${item.store}__${item.product}`
    if (!seen.has(key)) {
      seen.set(key, { ...item })
    }
  }
  return Array.from(seen.values())
}

/**
 * Raggruppa gli item di inventario per negozio.
 * Ritorna un array di oggetti store con metriche aggregate.
 */
export function groupByStore(inventoryItems) {
  const storeMap = new Map()

  for (const item of inventoryItems) {
    if (!storeMap.has(item.store)) {
      storeMap.set(item.store, {
        name: item.store,
        city: item.city,
        lat: item.lat,
        lon: item.lon,
        capacity: item.capacity,
        products: [],
        totalGap: 0,
        skusBelowReorder: 0,
        criticalSKUs: 0,
        highSKUs: 0,
      })
    }

    const store = storeMap.get(item.store)
    store.products.push(item)

    const gap = Number(item.gap ?? (item.stock - item.reorder_pt))
    if (gap < 0) {
      store.totalGap += gap
      store.skusBelowReorder++
      if (gap <= -20) store.criticalSKUs++
      else if (gap <= -10) store.highSKUs++
    }
  }

  const stores = Array.from(storeMap.values())

  // Calcola severity per store
  for (const store of stores) {
    if (store.criticalSKUs > 0) {
      store.severity = 'Critico'
    } else if (store.highSKUs > 0) {
      store.severity = 'Alto'
    } else if (store.skusBelowReorder > 0) {
      store.severity = 'Medio'
    } else {
      store.severity = 'OK'
    }
  }

  // Ordina per totalGap ASC (più critico prima)
  return stores.sort((a, b) => a.totalGap - b.totalGap)
}

/**
 * Calcola la severity di un singolo gap prodotto.
 */
export function getGapSeverity(gap) {
  if (gap <= -20) return 'Critico'
  if (gap <= -10) return 'Alto'
  if (gap < 0) return 'Medio'
  return 'OK'
}

/**
 * Calcola il tipo di PO in base alla severity.
 */
export function getPOType(gap) {
  if (gap <= -20) return 'FAST'
  if (gap < 0) return 'STD'
  return 'ECO'
}

/**
 * Calcola la quantità suggerita da ordinare per un prodotto.
 * Buffer di sicurezza: 15% del reorder point.
 */
export function suggestedOrderQty(stock, reorderPt, bufferPct = 15) {
  const target = Math.ceil(reorderPt * (1 + bufferPct / 100))
  return Math.max(0, target - stock)
}

// ─── Simulatore ──────────────────────────────────────────────────────────────

/**
 * Esegue la simulazione di replenishment per un singolo prodotto.
 *
 * @param {object} product - { stock, reorder_pt, price }
 * @param {object} params  - parametri simulazione
 * @returns {object}       - risultati simulazione
 */
export function simulateProduct(product, params) {
  const {
    daily_demand = 2,
    coverage_days = 30,
    safety_stock_pct = 15,
    lead_time = 14,
    seasonality_factor = 1.0,
  } = params

  const stock = Number(product.stock) || 0
  const reorder_pt = Number(product.reorder_pt) || 0
  const price = Number(product.price) || 0

  const adjusted_demand = daily_demand * seasonality_factor
  const safety_stock = reorder_pt * (safety_stock_pct / 100)
  const stock_needed = adjusted_demand * coverage_days + safety_stock
  const order_qty = Math.max(0, Math.ceil(stock_needed - stock))

  const days_until_stockout =
    adjusted_demand > 0 ? stock / adjusted_demand : Infinity

  let urgency
  if (days_until_stockout < lead_time) {
    urgency = 'Critico'
  } else if (days_until_stockout < lead_time * 1.5) {
    urgency = 'Alto'
  } else {
    urgency = 'Medio'
  }

  const total_cost = order_qty * price
  const coverage_after_order =
    adjusted_demand > 0 ? (stock + order_qty - safety_stock) / adjusted_demand : 999

  return {
    product: product.product,
    category: product.category,
    stock,
    reorder_pt,
    price,
    order_qty,
    safety_stock: Math.round(safety_stock),
    days_until_stockout: isFinite(days_until_stockout)
      ? Math.round(days_until_stockout)
      : null,
    urgency,
    total_cost,
    coverage_after_order: Math.round(coverage_after_order),
  }
}

/**
 * Genera i dati per il grafico di proiezione stock (90 giorni).
 */
export function generateStockProjection(product, params) {
  const {
    daily_demand = 2,
    coverage_days = 30,
    safety_stock_pct = 15,
    lead_time = 14,
    seasonality_factor = 1.0,
  } = params

  const stock = Number(product.stock) || 0
  const reorder_pt = Number(product.reorder_pt) || 0

  const adjusted_demand = daily_demand * seasonality_factor
  const safety_stock = reorder_pt * (safety_stock_pct / 100)
  const stock_needed = adjusted_demand * coverage_days + safety_stock
  const order_qty = Math.max(0, Math.ceil(stock_needed - stock))

  const data = []
  for (let day = 0; day <= 90; day++) {
    let level = stock - adjusted_demand * day
    if (day >= lead_time && order_qty > 0) {
      level += order_qty
    }
    data.push({
      day,
      stock: Math.max(0, Math.round(level * 10) / 10),
    })
  }

  return { data, order_qty, safety_stock: Math.round(safety_stock), reorder_pt }
}

/**
 * Calcola KPI aggregati da una lista di simulazioni.
 */
export function aggregateSimKPIs(simResults) {
  const total_cost = simResults.reduce((s, r) => s + (r.total_cost || 0), 0)
  const total_qty = simResults.reduce((s, r) => s + (r.order_qty || 0), 0)
  const avg_coverage =
    simResults.length > 0
      ? simResults.reduce((s, r) => s + (r.coverage_after_order || 0), 0) / simResults.length
      : 0
  const critical_pct =
    simResults.length > 0
      ? (simResults.filter(r => r.urgency === 'Critico').length / simResults.length) * 100
      : 0

  return {
    total_cost,
    total_qty,
    avg_coverage: Math.round(avg_coverage),
    critical_pct: Math.round(critical_pct),
  }
}

// ─── KPI Dashboard ───────────────────────────────────────────────────────────

export function computeDashboardKPIs(inventoryItems) {
  const storesInAlert = new Set()
  let skusBelowReorder = 0
  let totalGap = 0
  let valueAtRisk = 0

  for (const item of inventoryItems) {
    const gap = Number(item.gap ?? (item.stock - item.reorder_pt))
    if (gap < 0) {
      storesInAlert.add(item.store)
      skusBelowReorder++
      totalGap += Math.abs(gap)
      valueAtRisk += Math.abs(gap) * Number(item.price || 0)
    }
  }

  return {
    storesInAlert: storesInAlert.size,
    skusBelowReorder,
    totalGap,
    valueAtRisk,
  }
}
