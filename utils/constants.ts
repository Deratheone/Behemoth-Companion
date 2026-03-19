// App-wide constants and magic number definitions

// GPS Polling Constants
export const GPS_POLL_INTERVAL_MS = 3000
export const GPS_REQUEST_TIMEOUT_MS = 5000
export const GPS_TRAIL_HISTORY_LIMIT = 40

// GPS Status Values
export const GPS_STATUSES = {
  WAITING: 'waiting',
  OK: 'ok',
  ERROR: 'error',
} as const

export const SERVER_STATUSES = {
  CONNECTING: 'connecting',
  OK: 'ok',
  ERROR: 'error',
} as const
