import { useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useStore } from './stores/useStore'
import Dashboard from './components/Dashboard'
import StoreDetail from './components/StoreDetail'
import Simulator from './components/Simulator'

// ─── Loading Overlay ─────────────────────────────────────────────────────────
function LoadingOverlay({ message }) {
  const steps = [
    'Connessione a Mosaic...',
    'Caricamento fornitori...',
    'Analisi vendite...',
    'Analisi risposta...',
    'Inizializzazione...',
  ]

  return (
    <div className="fixed inset-0 bg-navy/95 flex flex-col items-center justify-center z-50 animate-fade-in">
      <div className="text-center max-w-sm">
        <h1 className="font-serif text-gold text-4xl tracking-[0.3em] mb-2">GUCCI</h1>
        <p className="text-muted text-xs tracking-[0.2em] uppercase mb-10">
          Replenishment Intelligence
        </p>

        <div className="flex justify-center mb-8">
          <div className="loading-spinner" />
        </div>

        <div className="space-y-2 text-left">
          {steps.map((step) => {
            const isDone = steps.indexOf(step) < steps.indexOf(message)
            const isActive = step === message
            return (
              <div
                key={step}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  isDone ? 'text-emerald-400' : isActive ? 'text-gold' : 'text-muted/30'
                }`}
              >
                <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                  {isDone ? '✓' : isActive ? '○' : '·'}
                </span>
                {step}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Error State ─────────────────────────────────────────────────────────────
function ErrorState({ error, onRetry }) {
  const isTokenError = error && (
    error.includes('MOSAIC_TOKEN') ||
    error.includes('token') ||
    error.includes('unauthorized') ||
    error.includes('401') ||
    error.includes('403')
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-charcoal/60 border border-red-500/30 rounded-lg p-8 text-center animate-fade-in">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="font-serif text-gold text-xl mb-3">Errore di connessione</h2>
        <p className="text-muted text-sm mb-2">
          Non è stato possibile caricare i dati da Mosaic.
        </p>
        <div className="bg-navy/60 rounded p-3 mb-4 text-left">
          <p className="text-red-400 text-xs font-mono break-all">{error}</p>
        </div>
        {isTokenError && (
          <a
            href="/api/auth"
            className="block w-full px-6 py-2.5 bg-gold text-navy font-semibold rounded hover:bg-gold-light transition-colors mb-3"
          >
            → Accedi con Strategy Studio
          </a>
        )}
        <button
          onClick={onRetry}
          className="w-full px-6 py-2.5 bg-charcoal border border-gold/30 text-gold rounded hover:bg-gold/10 transition-colors text-sm"
        >
          ↺ Riprova
        </button>
      </div>
    </div>
  )
}

// ─── Connection Status LED ────────────────────────────────────────────────────
function StatusLED({ loading, error, dataLoaded }) {
  if (loading) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-400">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Caricamento
      </span>
    )
  }
  if (error) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        Errore
      </span>
    )
  }
  if (dataLoaded) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
        Connesso
      </span>
    )
  }
  return null
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function NavBar() {
  const location = useLocation()
  const { loading, error, dataLoaded } = useStore()

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: '◈' },
    { to: '/simulator', label: 'Simulatore', icon: '⚡' },
  ]

  return (
    <header className="sticky top-0 z-40 bg-navy/80 backdrop-blur-md border-b border-gold/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="font-serif text-gold text-xl tracking-[0.25em] font-semibold">
            GUCCI
          </span>
          <span className="hidden sm:block text-gold/30 text-xs font-light tracking-widest uppercase">
            Replenishment
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              link.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`
                  px-4 py-2 text-sm rounded transition-colors flex items-center gap-1.5
                  ${isActive
                    ? 'text-gold bg-gold/10 border border-gold/20'
                    : 'text-muted hover:text-off-white hover:bg-gold/5'
                  }
                `}
              >
                <span className="text-xs">{link.icon}</span>
                {link.label}
              </Link>
            )
          })}
        </nav>

        <StatusLED loading={loading} error={error} dataLoaded={dataLoaded} />
      </div>
    </header>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { loadData, loading, loadingMessage, error, retryLoad } = useStore()

  // Load data on first mount
  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return <LoadingOverlay message={loadingMessage} />
  }

  if (error) {
    return <ErrorState error={error} onRetry={retryLoad} />
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/store/:storeId" element={<StoreDetail />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/simulator/:storeId" element={<Simulator />} />
          <Route
            path="*"
            element={
              <div className="text-center py-20 animate-fade-in">
                <p className="text-4xl mb-4">404</p>
                <p className="text-muted mb-6">Pagina non trovata</p>
                <Link to="/" className="text-gold hover:text-gold-light underline">
                  Torna alla Dashboard
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
