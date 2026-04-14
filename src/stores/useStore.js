import { create } from 'zustand'
import { loadAllData } from '../api/mosaic'
import { deduplicateInventory, groupByStore } from '../utils/calculations'

const DEFAULT_SIM_PARAMS = {
  coverage_days: 30,
  safety_stock_pct: 15,
  seasonality_factor: 1.0,
  lead_time_override: null,
  selected_supplier: null,
  product_demands: {}, // { "store__product" → daily_demand }
}

export const SCENARIO_PRESETS = {
  normal: {
    label: 'Business as usual',
    icon: '📊',
    params: {
      coverage_days: 30,
      safety_stock_pct: 15,
      seasonality_factor: 1.0,
    },
  },
  preSales: {
    label: 'Pre-saldi estivi',
    icon: '☀️',
    params: {
      coverage_days: 45,
      safety_stock_pct: 25,
      seasonality_factor: 1.8,
    },
  },
  christmas: {
    label: 'Natale',
    icon: '🎄',
    params: {
      coverage_days: 60,
      safety_stock_pct: 30,
      seasonality_factor: 2.5,
    },
  },
  lowSeason: {
    label: 'Low season',
    icon: '🌧️',
    params: {
      coverage_days: 14,
      safety_stock_pct: 10,
      seasonality_factor: 0.6,
    },
  },
}

export const useStore = create((set, get) => ({
  // ─── Data ────────────────────────────────────────────────────────────────
  inventory: [],      // array deduplicated items
  stores: [],         // array store aggregates
  suppliers: [],      // array supplier objects
  sales: [],          // array sales per store+product

  // ─── UI State ────────────────────────────────────────────────────────────
  loading: false,
  loadingMessage: '',
  error: null,
  dataLoaded: false,

  // ─── Navigation state ────────────────────────────────────────────────────
  selectedStore: null,  // store name string
  selectedProduct: null, // product name for chart focus

  // ─── Simulation params ───────────────────────────────────────────────────
  simParams: { ...DEFAULT_SIM_PARAMS },

  // ─── Actions ─────────────────────────────────────────────────────────────
  loadData: async () => {
    const { dataLoaded } = get()
    if (dataLoaded) return

    set({ loading: true, error: null, loadingMessage: 'Inizializzazione...' })

    try {
      const { inventory: rawInventory, suppliers, sales } = await loadAllData((msg) => {
        set({ loadingMessage: msg })
      })

      const inventory = deduplicateInventory(rawInventory)
      const stores = groupByStore(inventory)

      // Calcola domande default dai dati di vendita
      const product_demands = {}
      for (const sale of sales) {
        const key = `${sale.store}__${sale.product}`
        // Assumi ~90 giorni di dati
        const demand = sale.total_qty_sold ? Number(sale.total_qty_sold) / 90 : 2
        product_demands[key] = Math.max(0.1, Math.round(demand * 10) / 10)
      }

      set({
        inventory,
        stores,
        suppliers,
        sales,
        loading: false,
        dataLoaded: true,
        loadingMessage: '',
        simParams: {
          ...DEFAULT_SIM_PARAMS,
          product_demands,
        },
      })
    } catch (err) {
      set({
        loading: false,
        error: err.message || 'Errore nel caricamento dei dati',
        loadingMessage: '',
      })
    }
  },

  retryLoad: () => {
    set({ dataLoaded: false, error: null })
    get().loadData()
  },

  setSelectedStore: (storeName) => set({ selectedStore: storeName }),

  setSelectedProduct: (productName) => set({ selectedProduct: productName }),

  updateSimParams: (params) =>
    set((state) => ({
      simParams: { ...state.simParams, ...params },
    })),

  applyScenario: (scenarioKey) => {
    const scenario = SCENARIO_PRESETS[scenarioKey]
    if (!scenario) return
    set((state) => ({
      simParams: { ...state.simParams, ...scenario.params },
    }))
  },

  updateProductDemand: (store, product, demand) =>
    set((state) => ({
      simParams: {
        ...state.simParams,
        product_demands: {
          ...state.simParams.product_demands,
          [`${store}__${product}`]: demand,
        },
      },
    })),

  resetSimParams: () =>
    set((state) => ({
      simParams: {
        ...DEFAULT_SIM_PARAMS,
        product_demands: state.simParams.product_demands,
      },
    })),

  // Seleziona fornitore e aggiorna lead time
  selectSupplier: (supplier) =>
    set((state) => ({
      simParams: {
        ...state.simParams,
        selected_supplier: supplier.supplier,
        lead_time_override: supplier.lead_time,
      },
    })),

  // Helpers derivati
  getStoreByName: (name) => get().stores.find((s) => s.name === name),

  getProductDemand: (store, product) => {
    const key = `${store}__${product}`
    return get().simParams.product_demands[key] ?? 2
  },

  getEffectiveLeadTime: (supplierName) => {
    const { simParams, suppliers } = get()
    if (simParams.lead_time_override !== null) return simParams.lead_time_override
    const sup = suppliers.find((s) => s.supplier === supplierName)
    return sup?.lead_time ?? 14
  },
}))
