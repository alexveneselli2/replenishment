import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { generateStockProjection } from '../utils/calculations'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-charcoal border border-gold/30 rounded p-3 text-xs shadow-gold">
      <p className="text-muted mb-1">Giorno {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {Math.round(p.value)} pz
        </p>
      ))}
    </div>
  )
}

export default function StockChart({ product, params }) {
  if (!product) {
    return (
      <div className="h-64 flex items-center justify-center text-muted text-sm">
        Seleziona un prodotto per visualizzare la proiezione
      </div>
    )
  }

  const { data, order_qty, safety_stock, reorder_pt } = generateStockProjection(product, params)

  const adjusted_demand = (params.daily_demand ?? 2) * (params.seasonality_factor ?? 1)
  const lead_time = params.lead_time ?? 14
  const yMax = Math.max(product.stock + order_qty + 5, reorder_pt + 10)

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gold inline-block" />
          Stock proiettato
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-amber-400 inline-block border-dashed" style={{ borderTop: '2px dashed' }} />
          Reorder point
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-red-400 inline-block" style={{ borderTop: '2px dashed' }} />
          Safety stock
        </span>
        {order_qty > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3 bg-blue-400 inline-block" />
            Arrivo ordine (gg {lead_time})
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,169,110,0.08)" />

          <XAxis
            dataKey="day"
            stroke="#A09D97"
            tick={{ fill: '#A09D97', fontSize: 11 }}
            label={{ value: 'Giorni', position: 'insideBottom', offset: -2, fill: '#A09D97', fontSize: 11 }}
            tickFormatter={(v) => v % 15 === 0 ? `${v}` : ''}
          />

          <YAxis
            stroke="#A09D97"
            tick={{ fill: '#A09D97', fontSize: 11 }}
            tickFormatter={(v) => `${v}`}
            width={36}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Zona rossa sotto reorder point */}
          <ReferenceArea
            y1={0}
            y2={reorder_pt}
            fill="rgba(239,68,68,0.05)"
            fillOpacity={1}
          />

          {/* Linea reorder point */}
          <ReferenceLine
            y={reorder_pt}
            stroke="#F59E0B"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `Reorder ${reorder_pt}`, position: 'insideTopRight', fill: '#F59E0B', fontSize: 10 }}
          />

          {/* Linea safety stock */}
          {safety_stock > 0 && (
            <ReferenceLine
              y={safety_stock}
              stroke="#EF4444"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: `Safety ${Math.round(safety_stock)}`, position: 'insideTopRight', fill: '#EF4444', fontSize: 10 }}
            />
          )}

          {/* Linea verticale: data di arrivo ordine */}
          {order_qty > 0 && (
            <ReferenceLine
              x={lead_time}
              stroke="#60A5FA"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `+${order_qty} pz`, position: 'top', fill: '#60A5FA', fontSize: 10 }}
            />
          )}

          {/* Linea stock */}
          <Line
            type="monotone"
            dataKey="stock"
            stroke="#C9A96E"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#C9A96E', stroke: '#E8D5A3', strokeWidth: 1 }}
            name="Stock"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Riepilogo */}
      <div className="grid grid-cols-3 gap-3 mt-4 text-center">
        <div className="bg-surface/40 rounded p-2">
          <p className="text-muted text-xs">Ordine suggerito</p>
          <p className="text-gold font-serif text-lg">{order_qty} pz</p>
        </div>
        <div className="bg-surface/40 rounded p-2">
          <p className="text-muted text-xs">Domanda giorn. adj.</p>
          <p className="text-off-white font-serif text-lg">{adjusted_demand.toFixed(1)}</p>
        </div>
        <div className="bg-surface/40 rounded p-2">
          <p className="text-muted text-xs">Arrivo previsto</p>
          <p className="text-off-white font-serif text-lg">Gg {lead_time}</p>
        </div>
      </div>
    </div>
  )
}
