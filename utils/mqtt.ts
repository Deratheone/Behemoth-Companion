/**
 * utils/mqtt.ts
 *
 * Singleton MQTT client over wss:// → works from Vercel HTTPS (no mixed content).
 * Multiple components share one connection — subscribing/unsubscribing is additive.
 *
 * Usage:
 *   const cleanup = connectMQTT(onData, onSnapshot)
 *   return cleanup   // call on component unmount
 *
 *   emergencyStop()  // publishes {"action":"emergency_stop"} to control/gpio
 */

import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import type { ESP32Data } from './esp32'

// ── Broker config ────────────────────────────────────────────
const BROKER_URL     = 'wss://broker.hivemq.com:8884/mqtt'
const TOPIC_DATA     = 'behemoth/v1/sensor/data'
const TOPIC_GPIO     = 'behemoth/v1/control/gpio'
const TOPIC_SNAPSHOT = 'behemoth/v1/snapshot'

// ── Types ────────────────────────────────────────────────────
export type MQTTStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// ── Singleton state ──────────────────────────────────────────
let client: MqttClient | null = null
let currentStatus: MQTTStatus = 'disconnected'

const dataListeners:     Set<(d: ESP32Data) => void>  = new Set()
const snapshotListeners: Set<(b64: string) => void>   = new Set()
const statusListeners:   Set<(s: MQTTStatus) => void> = new Set()

// ── Internal helpers ─────────────────────────────────────────

function notifyStatus(s: MQTTStatus) {
  currentStatus = s
  statusListeners.forEach(fn => fn(s))
}

function ensureConnected() {
  if (client && (client.connected || client.reconnecting)) return

  if (client) { client.end(true); client = null }

  notifyStatus('connecting')

  const c = mqtt.connect(BROKER_URL, {
    clientId:        `behemoth-web-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 3000,
    connectTimeout:  10000,
    keepalive:       60,
    clean:           true,
  })

  c.on('connect', () => {
    c.subscribe([TOPIC_DATA, TOPIC_SNAPSHOT], (err) => {
      if (!err) notifyStatus('connected')
    })
  })

  c.on('message', (topic: string, payload: Buffer) => {
    if (topic === TOPIC_DATA) {
      try {
        const data = JSON.parse(payload.toString()) as ESP32Data
        dataListeners.forEach(fn => fn(data))
      } catch { /* malformed JSON – ignore */ }
    }
    if (topic === TOPIC_SNAPSHOT) {
      const b64 = payload.toString()
      snapshotListeners.forEach(fn => fn(b64))
    }
  })

  c.on('offline',    () => notifyStatus('disconnected'))
  c.on('close',      () => notifyStatus('disconnected'))
  c.on('error',      () => notifyStatus('error'))
  c.on('reconnect',  () => notifyStatus('connecting'))

  client = c
}

// ── Public API ───────────────────────────────────────────────

/** Subscribe to sensor data. Returns a cleanup function — call it on unmount. */
export function connectMQTT(
  onData:      (d: ESP32Data) => void,
  onSnapshot?: (b64: string) => void,
): () => void {
  dataListeners.add(onData)
  if (onSnapshot) snapshotListeners.add(onSnapshot)

  ensureConnected()

  return () => {
    dataListeners.delete(onData)
    if (onSnapshot) snapshotListeners.delete(onSnapshot)
    // Keep the client alive — other components may still be subscribed
  }
}

/** Listen to MQTT connection status changes. Returns an unsubscribe function. */
export function onMQTTStatus(fn: (s: MQTTStatus) => void): () => void {
  // Fire immediately with current status so components don't wait for next change
  fn(currentStatus)
  statusListeners.add(fn)
  return () => { statusListeners.delete(fn) }
}

/** Returns true if currently connected to the MQTT broker. */
export function getMQTTConnected(): boolean {
  return client?.connected ?? false
}

/**
 * Emergency Stop
 * Publishes {"action":"emergency_stop"} to the ESP32.
 * On receipt, ESP32:
 *   1. Activates relay on GPIO 15 (relay pin HIGH)
 *   2. Disables stepper motor drivers (EN pins HIGH)
 *   3. Returns servo to 0°
 */
export function emergencyStop(): void {
  if (!client?.connected) {
    console.warn('[MQTT] emergencyStop() called but not connected')
    return
  }
  client.publish(TOPIC_GPIO, JSON.stringify({ action: 'emergency_stop' }))
  console.log('[MQTT] Emergency stop published')
}
