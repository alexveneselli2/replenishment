export default function KPICard({ label, value, sub, icon, color = 'gold', trend }) {
  const colorMap = {
    gold: 'border-gold/30 shadow-gold',
    critical: 'border-red-500/30 shadow-critical',
    high: 'border-amber-500/30 shadow-high',
    medium: 'border-emerald-500/30 shadow-medium',
  }

  const iconBgMap = {
    gold: 'bg-gold/10 text-gold',
    critical: 'bg-red-500/10 text-red-400',
    high: 'bg-amber-500/10 text-amber-400',
    medium: 'bg-emerald-500/10 text-emerald-400',
  }

  return (
    <div
      className={`
        relative bg-charcoal/60 backdrop-blur-sm border rounded-lg p-5
        transition-all duration-300 hover:scale-[1.02] animate-fade-in
        ${colorMap[color]}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-muted text-xs font-medium uppercase tracking-widest mb-1">
            {label}
          </p>
          <p className="text-2xl font-serif text-off-white leading-tight truncate">
            {value}
          </p>
          {sub && (
            <p className="text-muted text-xs mt-1 truncate">{sub}</p>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${iconBgMap[color]}`}>
            {icon}
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`absolute bottom-3 right-4 text-xs font-medium ${trend >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}
