import { useState } from 'react'
import MapView from './pages/MapView.jsx'
import SearchView from './pages/SearchView.jsx'

const TABS = [
  { id: 'map', label: 'Mapa de Rentas' },
  { id: 'search', label: 'Buscar y Comparar' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('map')

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#111827] tracking-tight">CDMX Zonas</span>
            <span className="hidden sm:inline text-xs text-gray-400 font-normal">
              Comparador de Rentas
            </span>
          </div>

          {/* Tab bar */}
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-none ${
                  activeTab === tab.id
                    ? 'text-[#6366f1]'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6366f1]" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <div className={`h-full tab-fade ${activeTab === 'map' ? 'block' : 'hidden'}`}>
          <MapView />
        </div>
        <div className={`h-full tab-fade ${activeTab === 'search' ? 'block' : 'hidden'}`}>
          <SearchView />
        </div>
      </main>
    </div>
  )
}
