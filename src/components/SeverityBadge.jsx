const SEVERITY_CONFIG = {
  Critico: {
    classes: 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-critical',
    dot: 'bg-red-400',
    label: 'Critico',
  },
  Alto: {
    classes: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-high',
    dot: 'bg-amber-400',
    label: 'Alto',
  },
  Medio: {
    classes: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-medium',
    dot: 'bg-emerald-400',
    label: 'Medio',
  },
  OK: {
    classes: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dot: 'bg-blue-400',
    label: 'OK',
  },
}

export default function SeverityBadge({ severity, size = 'sm' }) {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.Medio
  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded font-medium
        ${sizeClasses} ${config.classes}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse-slow`} />
      {config.label}
    </span>
  )
}

export function POBadge({ type }) {
  const map = {
    FAST: 'bg-red-500/20 text-red-300 border border-red-500/30',
    STD: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    ECO: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded font-semibold tracking-wide ${map[type] ?? map.STD}`}>
      {type}
    </span>
  )
}
