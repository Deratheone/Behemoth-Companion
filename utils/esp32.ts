// ESP32 connection utilities for direct hardware integration
// Browser connects directly to ESP32 HTTP server on local WiFi network

// Type Definitions

export interface ESP32Data {
  location: {
    lat: number | null
    lng: number | null
    speed: number
    altitude: number
    satellites: number
  }
  field: {
    plants: Array<{ row: number; col: number }>
    currentRow: number
    currentCol: number
  }
  health: {
    detections: Array<{
      row: number
      col: number
      status: 'healthy' | 'diseased' | 'uncertain'
      confidence: number
    }>
  }
  timestamp: number
}

export interface ESP32Connection {
  ip: string
  connected: boolean
  lastUpdate: number | null
  error: string | null
}

const ESP32_IP_KEY = 'behemoth_esp32_ip'

// Connection Management

export function getESP32IP(): string | null {
  try {
    return localStorage.getItem(ESP32_IP_KEY)
  } catch (error) {
    console.error('Failed to get ESP32 IP from localStorage:', error)
    return null
  }
}

export function saveESP32IP(ip: string): void {
  try {
    localStorage.setItem(ESP32_IP_KEY, ip)
  } catch (error) {
    console.error('Failed to save ESP32 IP to localStorage:', error)
  }
}

export function removeESP32IP(): void {
  try {
    localStorage.removeItem(ESP32_IP_KEY)
  } catch (error) {
    console.error('Failed to remove ESP32 IP from localStorage:', error)
  }
}

export function isESP32Connected(): boolean {
  return getESP32IP() !== null
}

// IP Validation

export function validateESP32IP(ip: string): boolean {
  // Basic IPv4 pattern validation
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipPattern.test(ip)) return false

  // Check each octet is 0-255
  const octets = ip.split('.')
  return octets.every(octet => {
    const num = parseInt(octet, 10)
    return num >= 0 && num <= 255
  })
}

// Data Fetching with Timeout

export async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout - ESP32 not responding')
      }
      if (error.message.includes('CORS')) {
        throw new Error('CORS error - ESP32 must set Access-Control-Allow-Origin header')
      }
    }
    throw new Error('Cannot reach ESP32 - check IP address and WiFi connection')
  }
}

export async function fetchESP32Data(ip: string): Promise<ESP32Data> {
  const url = `http://${ip}/data`

  try {
    const response = await fetchWithTimeout(url, 5000)

    if (!response.ok) {
      throw new Error(`ESP32 returned error: ${response.status}`)
    }

    const data = await response.json()

    // Validate response structure
    if (!data.location || !data.field || !data.health) {
      throw new Error('Invalid response format - missing required fields')
    }

    return data as ESP32Data
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error fetching ESP32 data')
  }
}

export async function testESP32Connection(ip: string): Promise<boolean> {
  try {
    await fetchESP32Data(ip)
    return true
  } catch (error) {
    console.error('ESP32 connection test failed:', error)
    return false
  }
}

// Error Classification

export function classifyESP32Error(error: Error): {
  type: 'cors' | 'timeout' | 'network' | 'format' | 'unknown'
  message: string
  suggestion: string
} {
  const msg = error.message.toLowerCase()

  if (msg.includes('cors')) {
    return {
      type: 'cors',
      message: 'CORS Error',
      suggestion: 'ESP32 must include Access-Control-Allow-Origin: * header'
    }
  }

  if (msg.includes('timeout')) {
    return {
      type: 'timeout',
      message: 'Connection Timeout',
      suggestion: 'ESP32 not responding. Check if device is powered on and on same WiFi.'
    }
  }

  if (msg.includes('format') || msg.includes('json')) {
    return {
      type: 'format',
      message: 'Invalid Data Format',
      suggestion: 'ESP32 firmware may be outdated or not configured correctly.'
    }
  }

  if (msg.includes('reach') || msg.includes('network')) {
    return {
      type: 'network',
      message: 'Network Error',
      suggestion: 'Check IP address and ensure phone and ESP32 are on same WiFi network.'
    }
  }

  return {
    type: 'unknown',
    message: 'Connection Error',
    suggestion: 'Please check your connection and try again.'
  }
}
