import { useState, useEffect, useCallback } from 'react'
import { testESP32Connection } from '../utils/esp32'

const ESP32_CONNECTED_KEY = 'behemoth_esp32_connected'

type ConnectionState = 'not-connected' | 'waiting' | 'connected' | 'error'

interface UseESP32ConnectionReturn {
  isConnected: boolean
  isWaiting: boolean
  error: string | null
  connect: () => Promise<void>
  reset: () => void
}

export function useESP32Connection(): UseESP32ConnectionReturn {
  const [state, setState] = useState<ConnectionState>('not-connected')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Check if user was previously connected in this session
  useEffect(() => {
    try {
      const wasConnected = localStorage.getItem(ESP32_CONNECTED_KEY) === 'true'
      if (wasConnected) {
        setState('waiting')
      }
    } catch (e) {
      console.error('Failed to read ESP32 connection status:', e)
    }
  }, [])

  // Manual connection attempt
  const connect = useCallback(async () => {
    setState('waiting')
    setError(null)
    setRetryCount(0)

    try {
      const isConnected = await testESP32Connection()
      if (isConnected) {
        setState('connected')
        try {
          localStorage.setItem(ESP32_CONNECTED_KEY, 'true')
        } catch (e) {
          console.error('Failed to save connection status:', e)
        }
      } else {
        setState('error')
        setError('Connection failed. Ensure phone is connected to "Transplanter" WiFi.')
      }
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [])

  // Auto-detect connection every 2 seconds when waiting
  useEffect(() => {
    if (state !== 'waiting') return

    const autoDetectInterval = setInterval(async () => {
      try {
        const isConnected = await testESP32Connection()
        if (isConnected) {
          setState('connected')
          try {
            localStorage.setItem(ESP32_CONNECTED_KEY, 'true')
          } catch (e) {
            console.error('Failed to save connection status:', e)
          }
        } else {
          setRetryCount(prev => prev + 1)
          // After 30 seconds (15 retries) of waiting, show error state
          if (retryCount > 15) {
            setState('error')
            setError('Connection timeout. Please ensure device is powered on.')
          }
        }
      } catch (err) {
        setRetryCount(prev => prev + 1)
        if (retryCount > 15) {
          setState('error')
          setError(err instanceof Error ? err.message : 'Connection failed')
        }
      }
    }, 2000)

    return () => clearInterval(autoDetectInterval)
  }, [state, retryCount])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (state === 'connected') {
        // Re-enable auto-detection if still trying to be connected
        setState('waiting')
        setRetryCount(0)
      }
    }

    const handleOffline = () => {
      if (state === 'connected' || state === 'waiting') {
        setState('not-connected')
        setError('WiFi disconnected')
        try {
          localStorage.removeItem(ESP32_CONNECTED_KEY)
        } catch (e) {
          console.error('Failed to clear connection status:', e)
        }
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [state])

  // Reset connection state
  const reset = useCallback(() => {
    setState('not-connected')
    setError(null)
    setRetryCount(0)
    try {
      localStorage.removeItem(ESP32_CONNECTED_KEY)
    } catch (e) {
      console.error('Failed to clear connection status:', e)
    }
  }, [])

  return {
    isConnected: state === 'connected',
    isWaiting: state === 'waiting',
    error,
    connect,
    reset,
  }
}
