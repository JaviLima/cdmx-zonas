import SourceBadge from './SourceBadge.jsx'

function formatPrice(price) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export default function ListingCard({ listing, selected, onToggleSelect }) {
  const { title, price, neighborhood, size, bedrooms, image, url, source } = listing

  return (
    <div
      className={`border rounded-lg overflow-hidden cursor-pointer transition-colors ${
        selected
          ? 'border-[#6366f1] ring-1 ring-[#6366f1]'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onToggleSelect}
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-100 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <SourceBadge source={source} size="xs" />
        </div>
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 bg-[#6366f1] rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-lg font-bold text-[#111827]">{formatPrice(price)}<span className="text-xs font-normal text-gray-400">/mes</span></p>
        <p className="text-sm text-gray-600 mt-0.5 truncate">{title}</p>

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {bedrooms != null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {bedrooms} rec.
            </span>
          )}
          {size != null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              {size} m²
            </span>
          )}
          {neighborhood && (
            <span className="truncate flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{neighborhood}</span>
            </span>
          )}
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 block text-center text-xs text-[#6366f1] border border-[#6366f1] rounded py-1.5 hover:bg-indigo-50 transition-colors"
        >
          Ver anuncio →
        </a>
      </div>
    </div>
  )
}
