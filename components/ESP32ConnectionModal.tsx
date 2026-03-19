import React, { useEffect } from 'react'
import { useESP32Connection } from '../hooks/useESP32Connection'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface ESP32ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConnected: () => void
}

export default function ESP32ConnectionModal({ isOpen, onClose, onConnected }: ESP32ConnectionModalProps) {
  const { isConnected, isWaiting, error, connect, reset } = useESP32Connection()

  // Close modal when connection succeeds
  useEffect(() => {
    if (isConnected && isOpen) {
      setTimeout(() => {
        onConnected()
        onClose()
      }, 1000)
    }
  }, [isConnected, isOpen, onConnected, onClose])

  // Handle ESC key to close
  useEscapeKey(isOpen, onClose)

  // Reset state when modal closes
  const handleClose = () => {
    if (!isWaiting) {
      reset()
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Connect to Transplanter</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
            disabled={isWaiting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Display */}
        {isConnected && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-6 flex items-center gap-3 text-center">
            <div className="flex-1">
              <svg className="w-6 h-6 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-400 text-sm font-bold">Connected!</p>
              <p className="text-green-300 text-xs">Ready to use the app</p>
            </div>
          </div>
        )}

        {isWaiting && (
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="flex-1">
              <p className="text-amber-400 text-sm font-medium">Detecting connection...</p>
              <p className="text-amber-300/70 text-xs">Auto-detecting in background</p>
            </div>
          </div>
        )}

        {error && !isConnected && !isWaiting && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <div className="flex-1">
              <p className="text-red-400 text-sm font-medium">Connection failed</p>
              <p className="text-red-300/70 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-blue-300 text-sm font-semibold mb-3">📱 Follow these steps:</p>
          <ol className="text-blue-200 text-sm space-y-2 ml-4 list-decimal">
            <li>Open your phone&apos;s WiFi settings</li>
            <li>Find and connect to network: <span className="font-mono font-bold text-blue-100">&quot;Transplanter&quot;</span></li>
            <li>Enter password: <span className="font-mono font-bold text-blue-100">12345678</span></li>
            <li>Return to this app and click below</li>
          </ol>
        </div>

        {/* Action Button */}
        <button
          onClick={connect}
          disabled={isWaiting || isConnected}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
            isConnected
              ? 'bg-green-600 text-white'
              : isWaiting
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-xl hover:scale-[1.02] active:scale-95'
          }`}
        >
          {isConnected ? '✓ Connected' : isWaiting ? 'Checking...' : "I'm Connected"}
        </button>

        {/* Help Text */}
        <div className="mt-4 text-center">
          <p className="text-gray-500 text-xs leading-relaxed">
            Make sure your phone and the Transplanter device are both connected to the <span className="font-semibold">&quot;Transplanter&quot;</span> hotspot network.
          </p>
        </div>
      </div>
    </div>
  )
}
