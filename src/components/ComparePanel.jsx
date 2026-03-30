import SourceBadge from './SourceBadge.jsx'

function formatPrice(price) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

function Row({ label, values }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2.5 pr-4 text-xs text-gray-500 font-medium whitespace-nowrap w-24">{label}</td>
      {values.map((val, i) => (
        <td key={i} className="py-2.5 px-3 text-sm text-[#111827] text-center">
          {val ?? <span className="text-gray-300">—</span>}
        </td>
      ))}
    </tr>
  )
}

export default function ComparePanel({ listings, onRemove }) {
  if (listings.length === 0) return null

  const pad = 3 - listings.length
  const cols = [...listings, ...Array(pad).fill(null)]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#111827]">
            Comparando {listings.length} {listings.length === 1 ? 'propiedad' : 'propiedades'}
            <span className="text-gray-400 font-normal"> (máx. 3)</span>
          </h3>
          <button
            onClick={() => listings.forEach((_, i) => onRemove(i))}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Limpiar todo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <td className="w-24" />
                {cols.map((listing, i) =>
                  listing ? (
                    <th key={i} className="px-3 pb-2 text-center">
                      <div className="relative">
                        <button
                          onClick={() => onRemove(i)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 flex items-center justify-center text-[10px] leading-none"
                        >
                          ×
                        </button>
                        <SourceBadge source={listing.source} size="xs" />
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-[120px] mx-auto">
                          {listing.neighborhood}
                        </p>
                      </div>
                    </th>
                  ) : (
                    <th key={i} className="px-3 pb-2 text-center">
                      <div className="border border-dashed border-gray-200 rounded h-10 flex items-center justify-center">
                        <span className="text-xs text-gray-300">Vacío</span>
                      </div>
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              <Row
                label="Precio"
                values={cols.map((l) => l && <span className="font-bold text-[#6366f1]">{formatPrice(l.price)}</span>)}
              />
              <Row label="Recámaras" values={cols.map((l) => l?.bedrooms != null ? `${l.bedrooms} rec.` : null)} />
              <Row label="Tamaño" values={cols.map((l) => l?.size != null ? `${l.size} m²` : null)} />
              <Row label="Colonia" values={cols.map((l) => l?.neighborhood)} />
              <Row
                label="Ver"
                values={cols.map((l) =>
                  l ? (
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6366f1] text-xs underline"
                    >
                      Abrir
                    </a>
                  ) : null
                )}
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
