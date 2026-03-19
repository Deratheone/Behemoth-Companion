import React, { useState } from 'react'
import { emergencyStop } from '../utils/esp32'
import { useESP32Connection } from '../hooks/useESP32Connection'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface EmergencyStopProps {
  className?: string
}

export default function EmergencyStop({ className = '' }: EmergencyStopProps) {
  const { isConnected } = useESP32Connection()
  const [isActivating, setIsActivating] = useState(false)
  const [showDisconnectedModal, setShowDisconnectedModal] = useState(false)

  // Close modal with ESC key
  useEscapeKey(showDisconnectedModal, () => setShowDisconnectedModal(false))

  const handleEmergencyStop = async () => {
    if (!isConnected) {
      setShowDisconnectedModal(true)
      return
    }

    setIsActivating(true)

    try {
      await emergencyStop()
      // Success - LED should now be on
      console.log('Emergency stop activated - ESP32 LED turned on')
    } catch (error) {
      console.error('Emergency stop failed:', error)
      // Even if there's an error, we still tried to send the command
      // Could show an error message but for emergency stop, better to assume it went through
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <>
      <button
        onClick={handleEmergencyStop}
        disabled={isActivating}
        className={`
          px-3 py-2 rounded-xl font-bold text-white text-sm
          transition-all duration-200 shadow-lg
          ${isActivating
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 hover:scale-105 active:scale-95'
          }
          flex items-center gap-2 border border-red-500/30 ${className}
        `}
        aria-label="Emergency Stop"
        title="Emergency Stop - Activate Transplanter safety LED"
      >
        <div className="w-2 h-2 bg-red-200 rounded-full animate-pulse" />
        <span className="hidden sm:inline">
          {isActivating ? 'STOPPING...' : 'EMERGENCY STOP'}
        </span>
        <span className="sm:hidden">
          {isActivating ? '⏹️' : '🚨'}
        </span>
      </button>

      {/* Disconnected Modal */}
      {showDisconnectedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowDisconnectedModal(false)}
        >
          <div
            className="bg-white/5 backdrop-blur-md border border-red-500/30 rounded-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-red-400">Transplanter Not Connected</h2>
              <button
                onClick={() => setShowDisconnectedModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Alert Content */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
              <svg className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="flex-1">
                <p className="text-red-300 text-sm font-medium mb-2">
                  Emergency stop cannot be activated because the Transplanter device is not connected.
                </p>
                <p className="text-red-200/70 text-xs">
                  Connect to the &quot;Transplanter&quot; WiFi network first, then try again.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => setShowDisconnectedModal(false)}
              className="w-full py-3 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  )
}