const SOURCES = [
  { id: 'inmuebles24', label: 'Inmuebles24', color: 'text-indigo-600' },
  { id: 'vivanuncios', label: 'Vivanuncios', color: 'text-emerald-600' },
  { id: 'lamudi', label: 'Lamudi', color: 'text-amber-600' },
]

const BEDROOM_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: '1', label: '1 rec.' },
  { value: '2', label: '2 rec.' },
  { value: '3', label: '3 rec.' },
  { value: '4', label: '4+ rec.' },
]

function formatMXN(n) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export default function FilterBar({ filters, onChange, neighborhoods, priceRange }) {
  const { neighborhood, minPrice, maxPrice, bedrooms, sources } = filters

  function handleSourceToggle(sourceId) {
    const next = sources.includes(sourceId)
      ? sources.filter((s) => s !== sourceId)
      : [...sources, sourceId]
    onChange({ ...filters, sources: next })
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap gap-4 items-end">
      {/* Neighborhood */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs text-gray-500 font-medium">Colonia</label>
        <select
          value={neighborhood}
          onChange={(e) => onChange({ ...filters, neighborhood: e.target.value })}
          className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white text-[#111827] focus:outline-none focus:border-[#6366f1]"
        >
          <option value="">Todas las colonias</option>
          {neighborhoods.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* Price range */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <label className="text-xs text-gray-500 font-medium">
          Precio: {formatMXN(minPrice)} – {formatMXN(maxPrice)}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={priceRange.min}
            max={priceRange.max}
            step={500}
            value={minPrice}
            onChange={(e) =>
              onChange({ ...filters, minPrice: Math.min(Number(e.target.value), maxPrice - 500) })
            }
            className="flex-1 accent-[#6366f1]"
          />
          <input
            type="range"
            min={priceRange.min}
            max={priceRange.max}
            step={500}
            value={maxPrice}
            onChange={(e) =>
              onChange({ ...filters, maxPrice: Math.max(Number(e.target.value), minPrice + 500) })
            }
            className="flex-1 accent-[#6366f1]"
          />
        </div>
      </div>

      {/* Bedrooms */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Recámaras</label>
        <select
          value={bedrooms}
          onChange={(e) => onChange({ ...filters, bedrooms: e.target.value })}
          className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white text-[#111827] focus:outline-none focus:border-[#6366f1]"
        >
          {BEDROOM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sources */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Plataforma</label>
        <div className="flex gap-3">
          {SOURCES.map((src) => (
            <label key={src.id} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sources.includes(src.id)}
                onChange={() => handleSourceToggle(src.id)}
                className="accent-[#6366f1]"
              />
              <span className={`text-xs font-medium ${src.color}`}>{src.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
