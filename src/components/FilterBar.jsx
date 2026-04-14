const CATEGORIES = [
  'Tutte',
  'Accessories',
  'Bags',
  'Beauty',
  'Jewelry',
  'Ready-to-Wear',
  'Shoes',
  'Travel',
  'Watches',
]

const SEVERITIES = ['Tutti', 'Critico', 'Alto', 'Medio']

export default function FilterBar({ filters, onChange }) {
  const { search = '', severity = 'Tutti', category = 'Tutte' } = filters

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Cerca negozio o città…"
          className="
            w-full pl-9 pr-4 py-2 text-sm bg-surface/60 border border-gold/20
            rounded text-off-white placeholder-muted
            focus:outline-none focus:border-gold/50 focus:bg-surface/80
            transition-colors
          "
        />
      </div>

      {/* Severity filter */}
      <select
        value={severity}
        onChange={(e) => onChange({ ...filters, severity: e.target.value })}
        className="
          px-3 py-2 text-sm bg-surface/60 border border-gold/20
          rounded text-off-white
          focus:outline-none focus:border-gold/50
          transition-colors cursor-pointer
        "
      >
        {SEVERITIES.map((s) => (
          <option key={s} value={s} className="bg-charcoal">
            {s === 'Tutti' ? 'Severità: Tutti' : s}
          </option>
        ))}
      </select>

      {/* Category filter */}
      <select
        value={category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
        className="
          px-3 py-2 text-sm bg-surface/60 border border-gold/20
          rounded text-off-white
          focus:outline-none focus:border-gold/50
          transition-colors cursor-pointer
        "
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c} className="bg-charcoal">
            {c === 'Tutte' ? 'Categoria: Tutte' : c}
          </option>
        ))}
      </select>

      {/* Reset */}
      {(search || severity !== 'Tutti' || category !== 'Tutte') && (
        <button
          onClick={() => onChange({ search: '', severity: 'Tutti', category: 'Tutte' })}
          className="px-3 py-2 text-xs text-muted border border-gold/10 rounded hover:border-gold/30 hover:text-off-white transition-colors"
        >
          ✕ Reset
        </button>
      )}
    </div>
  )
}
