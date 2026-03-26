import React, { useState, useEffect } from 'react'
import { emergencyStop, onMQTTStatus } from '../utils/mqtt'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface EmergencyStopProps {
  className?: string
}

export default function EmergencyStop({ className = '' }: EmergencyStopProps) {
  const [mqttConnected, setMqttConnected] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [activated, setActivated] = useState(false)
  const [showDisconnectedModal, setShowDisconnectedModal] = useState(false)

  // Track MQTT connection status
  useEffect(() => {
    return onMQTTStatus((s) => setMqttConnected(s === 'connected'))
  }, [])

  // Close modal with ESC key
  useEscapeKey(showDisconnectedModal, () => setShowDisconnectedModal(false))

  const handleEmergencyStop = () => {
    if (!mqttConnected) {
      setShowDisconnectedModal(true)
      return
    }

    setIsActivating(true)

    // Publish {"action":"emergency_stop"} — ESP32 activates relay + disables motors
    emergencyStop()

    // Show activated state briefly, then lock button (stop is permanent until power cycle)
    setTimeout(() => {
      setIsActivating(false)
      setActivated(true)
    }, 800)
  }

  return (
    <>
      <button
        onClick={handleEmergencyStop}
        disabled={isActivating || activated}
        className={`
          px-3 py-2 rounded-xl font-bold text-white text-sm
          transition-all duration-200 shadow-lg
          ${activated
            ? 'bg-red-900 border border-red-700 cursor-not-allowed opacity-80'
            : isActivating
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 hover:scale-105 active:scale-95'
          }
          flex items-center gap-2 border border-red-500/30 ${className}
        `}
        aria-label="Emergency Stop"
        title={activated ? 'Emergency Stop activated — relay ON, motors disabled' : 'Emergency Stop — activates relay on ESP32'}
      >
        <div className={`w-2 h-2 rounded-full ${activated ? 'bg-red-400' : 'bg-red-200 animate-pulse'}`} />
        <span className="hidden sm:inline">
          {activated ? 'STOPPED ⬛' : isActivating ? 'STOPPING...' : 'EMERGENCY STOP'}
        </span>
        <span className="sm:hidden">
          {activated ? '⬛' : isActivating ? '⏹️' : '🚨'}
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
                  Emergency stop cannot be activated — MQTT not connected.
                </p>
                <p className="text-red-200/70 text-xs">
                  Make sure the ESP32 is powered on and connected to your phone hotspot,
                  then wait a few seconds for the MQTT connection to establish.
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