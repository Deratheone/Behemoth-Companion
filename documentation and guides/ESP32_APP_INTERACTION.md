# ESP32 ↔ Web App Interaction Guide

Complete end-to-end communication flow between ESP32 hardware and Behemoth Companion web application.

---

## 1. NETWORK SETUP & CONNECTION FLOW

### ESP32 as Access Point (Hotspot Mode)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: SETUP PHASE (One-time, when ESP32 powers on)       │
└─────────────────────────────────────────────────────────────┘

ESP32 Power-On:
  ↓
  └─> Boot Arduino code
      ↓
      └─> Initialize GPS UART (9600 baud, GPIO 16/17)
          ↓
          └─> Start as WiFi Access Point (Hotspot)
              ↓
              └─> SSID: "Transplanter"
              └─> Password: "12345678"
              └─> IP: 192.168.4.1 (always fixed)
              ↓
              └─> Start HTTP Server on port 80
                  ↓
                  └─> Ready to receive requests
                      ↓
                      └─> [Serial Log]: "Access Point Started at 192.168.4.1"

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: USER CONNECTION (Automatic + Manual)               │
└─────────────────────────────────────────────────────────────┘

User logs into web app:
  ↓
  └─> ESP32ConnectionModal appears automatically
      ↓
      ├─> [AUTO-DETECT] Background polling starts (every 2 seconds)
      │   └─> Attempts: GET http://192.168.4.1/data
      │
      └─> [MANUAL] User can click "I'm Connected" button
          ↓
          └─> Same test request sent immediately
              ↓
              └─> ESP32 receives request at 192.168.4.1:80/data
                  ↓
                  └─> Reads current GPS/field/health data
                      ↓
                      └─> Returns JSON response with CORS headers

                          HTTP/1.1 200 OK
                          Access-Control-Allow-Origin: *
                          Content-Type: application/json
                          Cache-Control: no-store

                          {
                            "location": {...},
                            "field": {...},
                            "health": {...},
                            "timestamp": ...
                          }
              ↓
              └─> App receives response
                  ↓
                  └─> Validates JSON structure
                      ↓
                      └─> Sets connection state to "connected"
                          ↓
                          └─> Modal closes after 1 second
                              ↓
                              └─> Dashboard unlocks (fieldmap, health, position pages now accessible)
```

### Key Differences from Manual IP Setup

| Aspect | Old System | New Hotspot |
|--------|-----------|------------|
| **IP Configuration** | User enters manually (192.168.1.x) | Hardcoded (always 192.168.4.1) |
| **User Action** | Enter IP → Test → Save | Switch to hotspot → Click or auto-detect |
| **Setup Time** | ~10-20 seconds | ~5-10 seconds |
| **Infrastructure** | Requires shared WiFi/router | Self-contained (no router needed) |
| **Failure Mode** | Wrong IP → manual retry needed | Bad signal → auto-retry every 2s |
| **Farm Use** | Impractical without WiFi | Farm-ready, no infrastructure |

---

## 2. DATA FLOW: REQUEST-RESPONSE CYCLE

### Detailed Polling Flow (Repeats every 3 seconds)

```
TIME    APP SIDE                          ESP32 SIDE              NETWORK
────────────────────────────────────────────────────────────────────────────

T=0ms   [Position Page Loads]
        GPSTracker component mounts
        ↓
        useEffect: No need to load IP (hardcoded as 192.168.4.1)
        ↓
        Dependency: [] (empty) triggers effect immediately

T=10ms  GPS Polling Effect Runs:
        ↓
        fetchLocation() async function called
        ↓
        Hardcoded IP: "192.168.4.1" ✓
        ↓
        Create AbortController
        ↓
        Call fetchWithTimeout(..., 5000)

T=15ms                                  WiFi Listening on port 80
                                        Waiting for HTTP request...

T=20ms  Fetch Request Sent:
        ┌─────────────────────────────────┐
        │ GET http://192.168.1.100/data   │
        │ Headers: Origin, Accept, etc.   │
        │ Timeout: 5000ms                 │
        └─────────────────────────────────┘
        ──────────────────────────────────> WiFi Network
                                        ↓
                                        TCP packet arrives
                                        ↓
                                        HTTP Server receives request
                                        ↓
                                        handleGetData() function called
                                        ↓
                                        Read from GPS serial buffer
                                        ↓
                                        Check: Is location valid?

T=30ms  Waiting for response...                  ↓
        [App freezes on await]                   Read latest:
                                                 - Latitude/Longitude
                                                 - Speed
                                                 - Altitude
                                                 - Satellite count
                                                 ↓
                                                 Read field grid data
                                                 - currentRow
                                                 - currentCol
                                                 - plants array
                                                 ↓
                                                 Read health detections
                                                 - disease status array
                                                 - confidence scores
                                                 ↓
                                                 Create StaticJsonDocument
                                                 ↓
                                                 Serialize to JSON string

T=40ms  Still waiting...                        ↓
                                                Build response:
                                                {
                                                  "location": {lat,lng,speed...},
                                                  "field": {plants, row, col},
                                                  "health": {detections},
                                                  "timestamp": millis()
                                                }
                                                ↓
                                                Add CORS headers

T=50ms  Still waiting...                        ↓
                                                Send HTTP response:
                                                HTTP/1.1 200 OK
                                                Access-Control-Allow-Origin: *
                                                Content-Type: application/json
                                                Content-Length: 487
                                                Connection: close

                                                {JSON_BODY}
                                        ────────────────────────────>
                                                                    WiFi Network
                                                                    ↓
T=60ms  Response arrives!                       TCP connection closes
        ↓
        parse as JSON
        ↓
        Await response.json() completes
        ↓
        Extract: {location, timestamp}

T=65ms  Update React State:
        ↓
        setGpsData({
          lat: 20.5937,
          lng: 78.9629,
          speed: 0,
          altitude: 150,
          satellites: 8,
          timestamp: "2026-03-19T10:30:45.000Z"
        })
        ↓
        setServerStatus("ok") ✓
        ↓
        setGpsStatus("ok") ✓

T=70ms  Component Re-renders:
        ↓
        Google Map updates marker position
        ↓
        Circle updates center
        ↓
        Polyline adds new point
        ↓
        Trail log adds entry
        ↓
        Display updates:
          - Coordinates shown
          - Status dot turns green
          - Signal bars show connected
          - Satellite count shows "8/12"

T=3000ms → Next poll starts again
         fetchLocation() called again
         (cycle repeats)

```

---

## 3. COMPLETE DATA FLOW DIAGRAM

### Spatial Overview

```
┌───────────────────────────┐                ┌──────────────────────┐
│   BEHEMOTH COMPANION      │                │      ESP32 DEVICE    │
│   (Web/Mobile Browser)    │                │   (On WiFi Network)  │
├───────────────────────────┤                ├──────────────────────┤
│                           │                │                      │
│  Home Page (index.tsx)    │                │                      │
│  ├─ Login                 │                │  ┌──────────────┐   │
│  ├─ Connect ESP32 Button  │ ──────────────>│  │ WiFi Module  │   │
│  └─ Navigation Grid       │   (User enters │  │ (2.4GHz)     │   │
│                           │    IP & tests) │  └──────┬───────┘   │
│                           │                │         │           │
│  ┌─ Position Page         │<──────────────│─────────┴───────┐   │
│  │ (position.tsx)         │   GET /data   │                 │   │
│  │ └─ GPSTracker          │   every 3s    │  ┌────────────┐ │   │
│  │   ├─ Google Maps (live)│               │  │ GPS Module │ │   │
│  │   ├─ Trail Log         │<──────────────│──│(NEO-6M)    │ │   │
│  │   ├─ Satellite Display │   JSON       │  │ UART1      │ │   │
│  │   └─ Status Indicators│   Response   │  │ (9600 baud)│ │   │
│  │                       │               │  └────────────┘ │   │
│  ├─ Health Bot Page      │<──────────────│─────────────────┘   │
│  │ (health.tsx)          │   GPS/Field/  │                     │
│  │ └─ SaplingDetector    │   Health Data │  ┌─────────────┐   │
│  │   (ML inference)      │               │  │ Flash Memory│   │
│  │                       │               │  │ (Plant Grid)│   │
│  ├─ Field Map Page       │<──────────────│  │ (Health DB) │   │
│  │ (fieldmap.tsx)        │   Field Grid  │  └─────────────┘   │
│  │ └─ FieldMapper        │   Positions   │                     │
│  │   (grid visualization)│               │  ┌─────────────┐   │
│  │                       │               │  │ Persistent  │   │
│  └─ AI Chat Panel        │               │  │ localStorage│   │
│    (uses Gemini API)     │               │  │ (config)    │   │
│                          │               │  └─────────────┘   │
└──────────────────────────┘               └──────────────────────┘
         ↓                                           ↓
    localStorage                              On-device storage
    (IP, User Session)                        (GPS data, Plant DB)
```

---

## 4. E2E DATA TRANSFORMATION

### Example: GPS Fix Acquisition

```
REAL WORLD EVENT:
  ↓
  GPS satellite locks onto signal
  NEMA sentence received by ESP32:
  "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"

ESP32 PROCESSING:
  ↓
  Arduino SerialGPS.read() receives bytes
  ↓
  TinyGPS++.encode() parses NMEA
  ↓
  gps.location.isUpdated() = true
  ↓
  gpsData.lat = 48.117300
  gpsData.lng = 11.183333
  gpsData.satellites = 8
  gpsData.timestamp = 12345

NEXT POLL CYCLE:
  ↓
  handleGetData() reads gpsData struct
  ↓
  ArduinoJson serializes to:
  {
    "location": {
      "lat": 48.117300,
      "lng": 11.183333,
      "speed": 0,
      "altitude": 545.4,
      "satellites": 8
    },
    ...
  }
  ↓
  HTTP response sent with CORS headers

APP RECEPTION:
  ↓
  JavaScript fetch() returns Response object
  ↓
  response.json() deserializes JSON
  ↓
  Extract {location, timestamp}

APP STATE UPDATE:
  ↓
  setGpsData({
    lat: 48.117300,
    lng: 11.183333,
    ...
  })
  ↓
  setGpsStatus("ok")
  ↓
  setServerStatus("ok")

UI RENDERING:
  ↓
  Google Maps marker repositioned
  ↓
  Trail log entry added: "10:30 | 48.11730, 11.18333"
  ↓
  Status dot turns green: "✓ GPS fix acquired"
  ↓
  Satellite display: "★★★★★★★★☆☆☆☆"
  ↓
  USER SEES: Live location on map with green marker
```

---

## 5. REQUEST/RESPONSE PACKET STRUCTURE

### HTTP Transaction Details

```
┌─────────────────────────────────────────────────────────────┐
│ REQUEST: App → ESP32                                        │
└─────────────────────────────────────────────────────────────┘

Frame Level (Network):
  Destination MAC: [ESP32 MAC Address]
  Destination IP: 192.168.1.100
  Destination Port: 80
  Source Port: [Random ephemeral port 49200+]

TCP Level:
  SYN → Wait for SYN-ACK
  ACK → Connection established

HTTP Level:
  ┌─────────────────────────────────────────┐
  │ GET /data HTTP/1.1                      │
  │ Host: 192.168.1.100                     │
  │ Connection: close                        │
  │ Accept: application/json                │
  │ Accept-Encoding: gzip, deflate, br      │
  │ Origin: http://localhost:3000 (browser) │
  │ User-Agent: Mozilla/5.0...              │
  │ Accept-Language: en-US                  │
  │ [blank line]                            │
  │ [no body for GET request]               │
  └─────────────────────────────────────────┘

Total size: ~300-400 bytes

┌─────────────────────────────────────────────────────────────┐
│ RESPONSE: ESP32 → App                                       │
└─────────────────────────────────────────────────────────────┘

HTTP Level:
  ┌──────────────────────────────────────────────────┐
  │ HTTP/1.1 200 OK                                  │
  │ Content-Type: application/json; charset=utf-8   │
  │ Content-Length: 487                              │
  │ Access-Control-Allow-Origin: *                  │
  │ Access-Control-Allow-Methods: GET, OPTIONS      │
  │ Access-Control-Allow-Headers: Content-Type      │
  │ Connection: close                                │
  │ Cache-Control: no-cache                          │
  │ Pragma: no-cache                                 │
  │ [blank line]                                     │
  │ {                                                │
  │   "location": {                                  │
  │     "lat": 20.5937,                              │
  │     "lng": 78.9629,                              │
  │     "speed": 2.5,                                │
  │     "altitude": 150.5,                           │
  │     "satellites": 8                              │
  │   },                                             │
  │   "field": {                                     │
  │     "plants": [                                  │
  │       {"row": 0, "col": 0},                      │
  │       {"row": 0, "col": 1}                       │
  │     ],                                           │
  │     "currentRow": 0,                             │
  │     "currentCol": 1                              │
  │   },                                             │
  │   "health": {                                    │
  │     "detections": [                              │
  │       {                                          │
  │         "row": 0,                                │
  │         "col": 0,                                │
  │         "status": "healthy",                     │
  │         "confidence": 0.95                       │
  │       }                                          │
  │     ]                                            │
  │   },                                             │
  │   "timestamp": 1710907200000                     │
  │ }                                                │
  └──────────────────────────────────────────────────┘

Total size: ~500-800 bytes (depending on # of detections)
```

---

## 6. ERROR SCENARIOS & HANDLING

### Scenario 1: No GPS Lock Yet

```
USER ACTION: Loads Position page, ESP32 just powered on

ESP32 SIDE:
  gps.location.isValid() = FALSE
  gpsData.lat = 0, gpsData.lng = 0
  gpsData.satellites = 0

Response sent:
{
  "location": {
    "lat": null,         ← Must be null, not 0!
    "lng": null,         ← Must be null, not 0!
    "speed": 0,
    "altitude": 0,
    "satellites": 0
  },
  ...
}

APP SIDE:
  if (!location.lat || !location.lng) {
    setGpsStatus("waiting")
    return
  }

USER SEES:
  ✓ Status shows: "Waiting for GPS fix..."
  ✓ Map shows default center (India)
  ✓ Spinning indicator on status dot
  ✓ "0 / 12" satellites
  ✓ Message: "Awaiting coordinates..."

ACTION:
  Every 3 seconds, polls again
  When GPS locks (satellites >= 3):
    Status changes to "✓ GPS fix acquired"
```

### Scenario 2: WiFi Disconnection

```
TIMELINE:
  T=0: App connected, receiving data
  T=5: WiFi drops (network unplugged)

ESP32 SIDE:
  Already running, but can't receive requests
  No HTTP requests processed
  Serial log would show: "WiFi disconnected"

APP SIDE (Poll #3):
  fetchWithTimeout() waits 5 seconds
  No response from ESP32
  Signal aborts after 5000ms timeout
  catch (error) block executes

  if (!(error instanceof Error && error.name === 'AbortError')) {
    setServerStatus("error")
    setGpsStatus("error")
    console.error('GPS fetch error:', error)
  }

USER SEES:
  ✓ Status dots turn RED
  ✓ Message: "Server unreachable"
  ✓ Last known position still on map (stale data)
  ✓ Last trail entries still visible
  ✓ Trail log stops updating

USER ACTION TO FIX:
  1. Check WiFi network (re-enter password if needed)
  2. Check ESP32 is powered on
  3. Check IP address is correct
  4. Click "Disconnect" and "Connect to Transplanter" again
```

### Scenario 3: GPS Timeout

```
CAUSE: GPS module crashes or loses power

ESP32 SIDE:
  while (SerialGPS.available()) { ... }
  Returns 0 bytes (no new data)
  oldGPSData is still valid but stale
  Continues to send last-known position
  OR: Implement timeout check:

  unsigned long timeSinceLastGPSUpdate = millis() - lastUpdateTime;
  if (timeSinceLastGPSUpdate > 10000) {
    // GPS dead, set status
    gpsData.lat = null;
    gpsData.lng = null;
  }

APP BEHAVIOR:
  Still receives 200 OK response with JSON
  But location.lat and location.lng are null
  Status becomes "waiting" again
  Map doesn't move to stale location

USER SEES:
  ✓ Brief green indicator
  ✓ Then changes to orange "Waiting for GPS fix..."
  ✓ Trail stops updating
```

### Scenario 4: JSON Parse Error

```
ESP32 SIDE:
  Somehow sends malformed JSON:
  Missing closing bracket, etc.

APP SIDE:
  response.json() throws SyntaxError
  catch (error) block:

  if (!(error instanceof Error && error.name === 'AbortError')) {
    setServerStatus("error")
    setGpsStatus("error")
    console.error('GPS fetch error:', error)
  }

BROWSER CONSOLE:
  ❌ SyntaxError: Unexpected token } in JSON at position 234

USER SEES:
  ✓ Red status dot
  ✓ "Server error" message

FIX: ESP32 needs reboot or code fix
```

---

## 7. STATE SYNCHRONIZATION

### React State During Connection

```
Initial State (Before Connection):
  esp32IP = null
  gpsStatus = "waiting"
  serverStatus = "connecting"
  gpsData = {lat: null, lng: null, ...}
  trail = []

User Actions:
  1. Click "Connect to Transplanter"
  2. Enter: 192.168.1.100
  3. Click "Test Connection"

Immediate Changes:
  setEsp32IP("192.168.1.100")  → localStorage saved

Effect Runs (because esp32IP changed):
  fetchLocation() called ← Now has IP address

First Request Sent:
  serverStatus: "connecting" → "connecting" (unchanged)
  ↓
  Response arrives within 500ms

State After First Poll:
  gpsStatus = "ok" (if lat & lng present)
  serverStatus = "ok"
  gpsData = {lat: 20.5937, lng: 78.9629, ...}
  trail = [{time: "10:30:45", coords: "20.59370, 78.96290"}]

Subsequent Polls:
  Every 3000ms:
    1. fetchLocation() runs
    2. Makes GET request
    3. Updates state with new data
    4. Component re-renders with new position
    5. Trail log adds new entry (max 40 entries)
    6. Map updates

Disconnection:
  User clicks "Disconnect" button in ESP32Status
  handleESP32Disconnect() runs:
    removeESP32IP()  → localStorage cleared
    setEsp32IP(null)
    → Effect dependency [esp32IP] triggers
    → Polling loop stops (early return if !esp32IP)
    → No more requests sent
```

---

## 8. REAL-TIME BEHAVIOR ON APP

### Use Case: Transplanter Moving Across Field

```
TIME    ESP32 STATE               APP STATE              USER SEES
────────────────────────────────────────────────────────────────────
T=0s    lat: 20.593700            Map centered          Green marker at
        lng: 78.962900            marker updated         start position
        satellites: 8             trail[0] added        Status: ✓ Connected
                                                        Satellites: ★★★★★★★★

T=3s    lat: 20.593750            Map panned             Marker moved
        lng: 78.962950            marker repositioned    slightly
        satellites: 8             trail[1] added         Trail line extended
                                  trail keeps last 40    Last position logged
                                  entries

T=6s    lat: 20.593800            Map updated            Marker moved again
        lng: 78.963000            trail[2] added         Trail shows path

T=30s   ▲Multiple updates...      Trail scrolls          Full path visible
        ▼                          auto-scroll to end     in trail log

T=3min  GPS shows 20.594500        Map zoomed to          Transplanter has
        78.963500                  show whole path        moved 1km
                                                         Trail shows complete
                                                         movement pattern

SPEED CALCULATION (from GPS):
  lat change: 20.594500 - 20.593700 ≈ 0.0008°
  lng change: 78.963500 - 78.962900 ≈ 0.0006°
  Distance ≈ ~1000 meters in ≈3 minutes
  Speed ≈ 20 km/h

ESP32 receives speed from GPS module:
  gpsData.speed = 20.5 km/h
  Sent in JSON every poll

APP DISPLAYS:
  Speed: "20.5 km/h"
  Altitude: "150 m"
  Bearing: (if available)
```

---

## 9. CORS & BROWSER SECURITY

### Why CORS Headers Are Critical

```
Browser Security Model:
  JavaScript running on http://localhost:3000
  Cannot directly fetch from http://192.168.1.100
  Without proper CORS headers = BLOCKED

┌──────────────────────────┐
│  Browser (localhost:3000)│
│                          │
│  app calls:              │
│  fetch('http://192.168.1.100/data')
│          │               │
│          ↓               │
│  Browser makes request   │
│  BUT: Checks response    │
│  headers first!          │
└──────────────────────────┘
       ↓ Sends request
       ↓ Includes Origin header:
       │   Origin: http://localhost:3000
       │
       ↓
┌──────────────────────────┐
│  ESP32 (192.168.1.100)   │
│                          │
│  receives request        │
│  ↓                       │
│  Reads Origin header     │
│  ↓                       │
│  Checks configurationn   │
│  ↓                       │
│  Must send back:         │
│  Access-Control-Allow-   │
│  Origin: *               │
│  (or Origin: http://...) │
└──────────────────────────┘
       ↓ Sends response with CORS headers
       ↓
       ↓
┌──────────────────────────┐
│  Browser (localhost:3000)│
│                          │
│  Checks response headers:│
│  ✓ CORS header present   │
│  ✓ Origin matches        │
│  ✓ ALLOW SUCCESS!        │
│                          │
│  JavaScript code:        │
│  app receives JSON       │
│  can parse and use!      │
└──────────────────────────┘

WITHOUT CORS headers on ESP32:
  Browser blocks response
  JavaScript gets error:
  "Cross-Origin Request Blocked: The Same Origin Policy
   disallows reading the remote resource at
   http://192.168.1.100/data.
   (Reason: missing token 'Access-Control-Allow-Origin'
   header)"
  ❌ No data displayed
```

---

## 10. COMPLETE LIFECYCLE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ COMPLETE ESP32 ↔ APP LIFECYCLE                             │
└─────────────────────────────────────────────────────────────┘

PHASE 1: STARTUP (Minutes 0-5)
  ┌──────────────────────┐     ┌──────────────────────┐
  │ ESP32 Boots          │     │ App Loads in Browser │
  ├──────────────────────┤     ├──────────────────────┤
  │ 1. Initialize UART1  │     │ 1. Load index.tsx    │
  │ 2. Setup GPS serial  │     │ 2. Check localStorage│
  │ 3. Connect WiFi      │     │ 3. Show home page    │
  │ 4. Start HTTP server │     │ 4. No ESP32 IP yet   │
  │ 5. Wait for clients  │     │ 5. Show "Connect"    │
  │                      │     │    button            │
  │ Status: 🔴 NO CLIENT │     │ Status: Ready for    │
  │          🔴 IDLE      │     │ ESP32 setup          │
  └──────────────────────┘     └──────────────────────┘
           ↓                              ↓
         [5-10 min later, GPS locks: ★★★★★★★★]

PHASE 2: CONNECTION (Minute 5)
  User clicks "Connect to Transplanter"
  │
  ├─> Opens ESP32ConnectionModal
  │   Enters IP: "192.168.1.100"
  │   Clicks "Test Connection"
  │
  │   App: GET /data → ESP32
  │
  │   ESP32: Handles request
  │           Returns 200 OK with JSON + CORS headers
  │
  │   App: Validates response
  │         Saves IP to localStorage
  │         Shows "Connected ✓"
  │
  │   Status: ✓ CONNECTED
  │            ✓ READY
  │
  └─> User now sees "Health Bot", "Field Map", "Position Tracker"

PHASE 3: ACTIVE OPERATION (Minutes 5+)
  User navigates to Position page
  │
  ├─> Position.tsx loads
  │   GPSTracker component mounts
  │   ↓
  │   useEffect runs → Load ESP32 IP from localStorage
  │   ↓
  │   Another useEffect → Start polling
  │
  │   Polling Loop (every 3000ms):
  │   ┌────────────────────────────────────┐
  │   │ fetchLocation() async              │
  │   │ ├─ Check esp32IP exists            │
  │   │ ├─ Cancel any pending request      │
  │   │ ├─ Create AbortController          │
  │   │ ├─ Call fetchWithTimeout(url, 5s) │
  │   │ │                                  │
  │   │ │  [Network Request]               │
  │   │ │  GET /data → ESP32               │
  │   │ │           → Reads GPS/field/     │
  │   │ │           → Serializes to JSON   │
  │   │ │           → Returns response     │
  │   │ │           → TCP closes           │
  │   │ │                                  │
  │   │ ├─ response.json() parsed          │
  │   │ ├─ setState(gpsData, status)       │
  │   │ └─ Component re-renders            │
  │   │    ├─ Map marker updated           │
  │   │    ├─ Trail log updated            │
  │   │    ├─ Satellite display updated    │
  │   │    ├─ Status indicators updated    │
  │   │    └─ User sees live position      │
  │   │                                    │
  │   │ [Wait 2970ms for next cycle]       │
  │   └────────────────────────────────────┘
  │
  └─> Continues until:
       - Page unloaded (polling stops)
       - "Disconnect" clicked (IP cleared)
       - Connection fails (red status)

PHASE 4: DISCONNECTION (Minute 45)
  User clicks "Disconnect" button
  │
  ├─> removeESP32IP() called
  │   localStorage cleared
  │   setEsp32IP(null)
  │
  │   Effect dependency triggers:
  │   if (!esp32IP) return  ← Early exit, no polling
  │
  │   No more requests sent to ESP32
  │
  │   Status: ❌ DISCONNECTED
  │            ❌ NO DATA
  │
  └─> User back at home page
      Can connect again or edit IP if needed
```

---

## 11. NETWORK PACKETS (WIRESHARK VIEW)

### Actual Network Capture

```
Frame 1234: 110 bytes on wire, 110 bytes captured

[Ethernet]
  Destination: 00:1a:2b:3c:4d:5e (ESP32)
  Source: 00:11:22:33:44:55 (Mobile/Laptop)

[IP]
  Source: 192.168.1.50 (App device)
  Destination: 192.168.1.100 (ESP32)
  Protocol: TCP

[TCP]
  Source Port: 52841 (ephemeral)
  Destination Port: 80 (HTTP)
  Seq: 123456789
  Ack: 987654321
  Flags: PSH, ACK (data being pushed)

[HTTP]
  GET /data HTTP/1.1\r\n
  Host: 192.168.1.100\r\n
  Connection: close\r\n
  User-Agent: Mozilla/5.0...\r\n
  Accept: application/json\r\n
  \r\n
  [No body]

────────────────────────────────────────────────────────

Frame 1235: 548 bytes on wire, 548 bytes captured

[Ethernet]
  Destination: 00:11:22:33:44:55 (Mobile/Laptop)
  Source: 00:1a:2b:3c:4d:5e (ESP32)

[IP]
  Source: 192.168.1.100 (ESP32)
  Destination: 192.168.1.50 (App device)

[TCP]
  Source Port: 80 (HTTP)
  Destination Port: 52841 (matching request)
  Seq: 987654321
  Ack: 123456790
  Flags: PSH, ACK

[HTTP]
  HTTP/1.1 200 OK\r\n
  Content-Type: application/json\r\n
  Content-Length: 487\r\n
  Access-Control-Allow-Origin: *\r\n
  Access-Control-Allow-Methods: GET, OPTIONS\r\n
  Access-Control-Allow-Headers: Content-Type\r\n
  Connection: close\r\n
  \r\n
  {"location":{"lat":20.5937,"lng":78.9629,"speed":2.5,
  "altitude":150.5,"satellites":8},"field":{"plants":[
  {"row":0,"col":0},{"row":0,"col":1}],"currentRow":0,
  "currentCol":1},"health":{"detections":[{"row":0,
  "col":0,"status":"healthy","confidence":0.95}]},
  "timestamp":1710907200000}

────────────────────────────────────────────────────────

Frame 1236: 54 bytes on wire

[TCP]
  Flags: FIN, ACK (connection close)
  Seq: 123456790
  Ack: 987654808

──────────────────────────────────────────────────────────
[Connection ends - TCP 4-way handshake complete]
```

---

## 12. TIMING CONSTRAINTS

### Critical Timing Requirements

```
┌─────────────────────────────────────────────────────────┐
│ TIMING SPECIFICATION                                    │
└─────────────────────────────────────────────────────────┘

WiFi Network Latency:
  Local network (same WiFi): 1-50ms typical
  Add: WiFi connection overhead: 10-30ms
  Total network RTT: 15-80ms

ESP32 Processing Time:
  HTTP server receive: ~1ms
  JSON serialization: 5-20ms
  Database read: ~1ms
  GPS data read: ~2ms
  HTTP response send: ~2ms
  Total ESP32 processing: 10-25ms

App Processing Time:
  HTTP request send: ~5ms
  Await response: (varies)
  JSON parse: 5-10ms
  setState: ~1ms
  Total app processing: 10-15ms

TOTAL ROUND TRIP TIME (RTT):
  Optimal: 15-80ms
  Typical: 50-150ms
  Acceptable: < 500ms
  TIMEOUT: 5000ms (5 seconds)

POLLING BEHAVIOR:
  Request sent at T=0ms
  Response received at T=50-150ms
  App updates state
  Browser re-renders
  Next poll scheduled for T=3000ms

  ← 2850-2950ms idle time before next poll

CONSEQUENCE:
  If ESP32 takes > 5000ms to respond:
    AbortController.signal triggers
    Error caught
    Status set to "error"
    User sees red indicator
    Polling continues (tries next cycle)

OPTIMIZATION TIP:
  If network is slow:
    Increase timeout in GPS_REQUEST_TIMEOUT_MS
    Decrease poll frequency (GPS_POLL_INTERVAL_MS)
    Send less data in JSON response
```

---

## 13. AUTHENTICATION & SECURITY

### Current Implementation (Testing Only)

```
WARNING: This is NOT production-secure!

CURRENT FLOW:
  1. User enters email/password in AuthModal
  2. App checks against localStorage users
  3. No server-side validation
  4. No encryption
  5. IP and user data stored locally

ESP32 SIDE:
  No authentication required
  Accepts requests from any origin
  No access control

SECURITY ISSUES:
  ✗ No HTTPS (uses HTTP)
  ✗ No password hashing (btoa only)
  ✗ No token-based auth
  ✗ No rate limiting
  ✗ No DDoS protection
  ✗ Anyone on WiFi can access API

FOR PRODUCTION:
  [ ] Implement JWT tokens
  [ ] Use HTTPS with certificates
  [ ] Add session timeouts
  [ ] Rate limiting on ESP32
  [ ] Basic HTTP auth on /data endpoint
  [ ] Encrypt sensitive data
  [ ] Validate all inputs

EXAMPLE (not implemented):
  GET /data HTTP/1.1
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

  ESP32 should verify token before responding
```

---

## 14. GPIO CONTROL & EMERGENCY STOP

### Emergency Stop Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER TRIGGERS EMERGENCY STOP                               │
└─────────────────────────────────────────────────────────────┘

User clicks Emergency Stop button (red button in top-right):
  ↓
  └─> emergencyStop() function called
      ↓
      └─> controlGPIO(2, true) called
          ↓
          └─> POST http://192.168.4.1/gpio
              Headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
              }
              Body: {
                "pin": 2,
                "state": 1
              }
              ↓
              └─> ESP32 receives POST request
                  ↓
                  └─> Arduino code validates:
                      ├─> PIN 2 is valid GPIO? ✅
                      ├─> STATE is 0 or 1? ✅
                      ├─> Pin not reserved? ✅
                      ↓
                      └─> digitalWrite(2, HIGH)
                          ↓
                          └─> Built-in LED turns ON (blue)
                              ↓
                              └─> HTTP 200 Response:
                                  {
                                    "success": true,
                                    "pin": 2,
                                    "state": 1,
                                    "message": "GPIO2 set to HIGH"
                                  }
                                  ↓
                                  └─> App receives response
                                      ├─> SUCCESS: LED is now on
                                      └─> ERROR: Handles gracefully
```

### GPIO Request/Response Examples

**Emergency Stop Request:**
```http
POST /gpio HTTP/1.1
Host: 192.168.4.1
Content-Type: application/json
Accept: application/json
Origin: https://behemoth-companion.vercel.app

{
  "pin": 2,
  "state": 1
}
```

**ESP32 Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Content-Length: 67

{
  "success": true,
  "pin": 2,
  "state": 1,
  "message": "GPIO2 set to HIGH"
}
```

**User Experience Flow:**
```
1. User Authentication ✅ → Emergency Stop visible in top-right
2. ESP32 Connected ✅ → Button active (red gradient)
3. ESP32 Disconnected ❌ → Button shows warning modal
4. Click Emergency Stop → LED activates immediately
5. Visual Feedback → User sees "STOPPING..." state briefly
```

### Disconnected State Handling

When ESP32 not connected, emergency stop shows informative modal:
```
┌─────────────────────────────────────────────────────────────┐
│ "Transplanter Not Connected" Modal                          │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Emergency stop cannot be activated because the           │
│    Transplanter device is not connected.                   │
│                                                            │
│ Connect to the "Transplanter" WiFi network first,         │
│ then try again.                                            │
│                                                            │
│              [Understood]                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## SUMMARY: HOW IT ALL WORKS TOGETHER

```
┌─────────────────────────────────────────────────────────────┐
│ SIMPLIFIED OVERVIEW                                         │
└─────────────────────────────────────────────────────────────┘

1. SETUP
   • ESP32 powers on → Starts HTTP server on port 80
   • App loads → Shows home page
   • User enters ESP32 IP address → Saved to browser

2. POLLING LOOP (Every 3 Seconds) + GPIO Control
   • App makes GET request to http://{IP}/data
   • ESP32 reads latest sensor data
   • ESP32 formats as JSON string
   • ESP32 sends HTTP 200 response with JSON + CORS headers
   • App receives JSON
   • App parses JSON
   • App updates React state
   • React re-renders components
   • User sees updated map, trail, status

   EMERGENCY ACTIONS (User-triggered):
   • User clicks Emergency Stop → POST /gpio
   • ESP32 activates GPIO2 LED → Visual safety indicator

3. RENDERING
   • Google Maps library updates marker position
   • Polyline gets new point added
   • Trail log scrolls to show latest entry
   • Status indicators show green (connected)
   • Satellite count updates
   • Altitude/speed displays update

4. ERROR HANDLING
   • No GPS lock → Shows "waiting" status
   • WiFi down → Shows "error" status + red indicator
   • Timeout > 5s → Aborts, shows error
   • JSON parse error → Caught, shows error
   • App keeps retrying every 3 seconds

5. DISCONNECT
   • User clicks "Disconnect"
   • IP removed from browser storage
   • Polling loop stops
   • No more requests sent to ESP32
   • Can reconnect by entering IP again

KEY INSIGHT:
  Everything is synchronous polling!

  No WebSockets, no server-push
  App always initiates the connection
  ESP32 is completely passive (just listens and responds)

  This is simple but means:
  • App decides update frequency
  • No real-time push from ESP32
  • Graceful degradation if network is slow/unreliable
```

---

This is the complete end-to-end interaction model for how your ESP32 and web app communicate!
