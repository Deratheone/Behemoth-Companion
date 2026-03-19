import { useState, useEffect } from 'react'
import { validateESP32IP, testESP32Connection, classifyESP32Error } from '../utils/esp32'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface ESP32ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect: (ip: string) => void
}

export default function ESP32ConnectionModal({ isOpen, onClose, onConnect }: ESP32ConnectionModalProps) {
  const [ip, setIp] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null)
  const [error, setError] = useState('')

  // Handle ESC key to close
  useEscapeKey(isOpen, onClose)

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) {
      setIp('')
      setTesting(false)
      setTestResult(null)
      setError('')
    }
  }, [isOpen])

  const handleTestConnection = async () => {
    setError('')
    setTestResult(null)

    // Validate IP format first
    if (!validateESP32IP(ip)) {
      setError('Invalid IP address format')
      setTestResult('failed')
      return
    }

    setTesting(true)

    try {
      const success = await testESP32Connection(ip)

      if (success) {
        setTestResult('success')
        setError('')
      } else {
        setTestResult('failed')
        setError('Connection failed')
      }
    } catch (err) {
      setTestResult('failed')
      if (err instanceof Error) {
        const classified = classifyESP32Error(err)
        setError(`${classified.message}: ${classified.suggestion}`)
      } else {
        setError('Connection test failed')
      }
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = () => {
    if (testResult === 'success' && validateESP32IP(ip)) {
      onConnect(ip)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Connect to Transplanter</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
          <p className="text-blue-300 text-sm">
            Make sure your phone and ESP32 are on the same WiFi network.
          </p>
        </div>

        {/* IP Input */}
        <label className="block mb-4">
          <span className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">
            ESP32 IP Address
          </span>
          <input
            type="text"
            value={ip}
            onChange={(e) => {
              setIp(e.target.value)
              setTestResult(null)
              setError('')
            }}
            placeholder="192.168.1.100"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
            disabled={testing}
          />
        </label>

        {/* Test Connection Button */}
        <button
          onClick={handleTestConnection}
          disabled={!ip || testing}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all mb-3 ${
            !ip || testing
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {testing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Testing Connection...
            </span>
          ) : (
            'Test Connection'
          )}
        </button>

        {/* Test Result */}
        {testResult === 'success' && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400 text-sm font-medium">Connection successful!</span>
          </div>
        )}

        {testResult === 'failed' && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-red-400 text-sm">{error || 'Connection failed'}</span>
          </div>
        )}

        {/* Connect Button */}
        <button
          onClick={handleConnect}
          disabled={testResult !== 'success'}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
            testResult === 'success'
              ? 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white shadow-xl hover:scale-[1.02]'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          Connect
        </button>

        {/* Help Text */}
        <div className="mt-4 text-center">
          <p className="text-gray-500 text-xs">
            Find ESP32 IP in your WiFi router settings or use an IP scanner app.
          </p>
        </div>
      </div>
    </div>
  )
}
