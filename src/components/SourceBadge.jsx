const SOURCE_CONFIG = {
  inmuebles24: {
    label: 'Inmuebles24',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  vivanuncios: {
    label: 'Vivanuncios',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  lamudi: {
    label: 'Lamudi',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
}

export default function SourceBadge({ source, size = 'sm' }) {
  const config = SOURCE_CONFIG[source]
  if (!config) return null

  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${config.color} ${sizeClass}`}
    >
      {config.label}
    </span>
  )
}

export { SOURCE_CONFIG }
