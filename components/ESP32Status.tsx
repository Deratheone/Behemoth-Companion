import { useState, useEffect, useRef } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'

interface ESP32StatusProps {
  ip: string
  lastUpdate?: number | null
  onDisconnect: () => void
}

export default function ESP32Status({ ip, lastUpdate, onDisconnect }: ESP32StatusProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, showDropdown, () => setShowDropdown(false))

  // Update time since last update
  useEffect(() => {
    if (!lastUpdate) {
      setTimeSinceUpdate('--')
      return
    }

    const updateTime = () => {
      const now = Date.now()
      const diff = Math.floor((now - lastUpdate) / 1000)

      if (diff < 5) setTimeSinceUpdate('just now')
      else if (diff < 60) setTimeSinceUpdate(`${diff}s ago`)
      else if (diff < 3600) setTimeSinceUpdate(`${Math.floor(diff / 60)}m ago`)
      else setTimeSinceUpdate('offline')
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [lastUpdate])

  const isConnected = lastUpdate && (Date.now() - lastUpdate < 10000)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white transition-colors shadow-lg ${
          isConnected
            ? 'bg-cyan-600 hover:bg-cyan-500'
            : 'bg-gray-700 hover:bg-gray-600'
        }`}
      >
        {/* Status Dot */}
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`}
        />

        {/* Label */}
        <span className="font-medium hidden sm:inline">
          {isConnected ? 'ESP32' : 'Disconnected'}
        </span>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs text-gray-400 mb-1">Connected to</p>
            <p className="text-sm text-white font-mono">{ip}</p>
            <p className="text-xs text-gray-500 mt-1">Last update: {timeSinceUpdate}</p>
          </div>

          <button
            onClick={() => {
              setShowDropdown(false)
              onDisconnect()
            }}
            className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
