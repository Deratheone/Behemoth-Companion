# ESP32 ↔ Web App Interaction Guide

Complete end-to-end communication flow between ESP32 hardware and Behemoth Companion web application.

**Last Updated:** March 27, 2026
**Architecture Version:** 3.0 — MQTT Cloud Relay + Captive Portal Provisioning

---

## 1. NETWORK SETUP & CONNECTION FLOW

### Why MQTT Instead of Direct HTTP

The website is hosted on Vercel over **HTTPS**. Modern browsers enforce Mixed Content Policy: an HTTPS page **cannot** make HTTP sub-requests. Since the ESP32 runs a plain HTTP server, the browser blocks every request before it even starts — regardless of CORS headers.

**Solution:** The ESP32 connects to the user's phone hotspot (gets internet), then publishes data to a free cloud MQTT broker. The Vercel app subscribes to the same broker over secure WebSocket (`wss://`). No mixed content. No CORS issues.

```
┌─────────────────────────────────────────────────────────────┐
│              NEW ARCHITECTURE (v3.0)                        │
└─────────────────────────────────────────────────────────────┘

  [ESP32] ──WiFi STA──► [Phone Hotspot] ──Mobile Data──► [Internet]
                                │                              │
                                │                    [HiveMQ MQTT Broker]
                                │                    broker.hivemoth.com
                                │                              │
                                │                         wss://8884
                                │                              │
                         [Vercel HTTPS App] ◄─────────────────┘
```

---

### ESP32 WiFi Provisioning (Captive Portal)

Instead of hardcoded WiFi credentials, the ESP32 uses a **QR code + captive portal** to let any user configure their hotspot details.

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: FIRST BOOT — PROVISIONING MODE                      │
└─────────────────────────────────────────────────────────────┘

ESP32 Power-On (no saved WiFi credentials):
  ↓
  └─► Boot Arduino code
      ↓
      └─► Initialize hardware (servo, steppers, GPS, sensors)
          ↓
          └─► Check NVS flash for saved WiFi credentials
              ↓
              └─► None found → Switch to AP mode
                  ↓
                  └─► SSID: "Transplanter-Setup"
                  └─► Password: "transplanter"
                  └─► IP: 192.168.4.1 (always fixed)
                  ↓
                  └─► Scan nearby WiFi networks
                  ↓
                  └─► Start HTTP Server + DNS redirect (captive portal)
                      ↓
                      └─► [Serial Log]: "Portal started. Waiting for user..."

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: USER CONNECTS VIA QR CODE                           │
└─────────────────────────────────────────────────────────────┘

User scans QR code on transplanter body:
  ↓ (QR encodes WiFi: "Transplanter-Setup" / "transplanter")
  └─► Phone auto-connects to "Transplanter-Setup" hotspot
      ↓
      └─► DNS redirect triggers captive portal
          ↓
          └─► Beautiful dark-themed setup page opens
              └─► Shows list of scanned nearby WiFi networks
              └─► Password input field
              └─► "Connect Transplanter" button

User selects their phone hotspot → enters password → submits:
  ↓
  └─► ESP32 receives POST /connect
      ↓
      └─► Saves SSID + password to NVS flash (survives power-off)
          ↓
          └─► Serves "Connecting..." redirect page
              └─► Page tells user to switch back to their hotspot
              └─► Auto-redirects to https://behemoth-companion.vercel.app
          ↓
          └─► ESP32 reboots (2 second delay)

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: OPERATIONAL MODE (every subsequent boot)            │
└─────────────────────────────────────────────────────────────┘

ESP32 boots:
  ↓
  └─► Loads saved WiFi credentials from NVS
      ↓
      └─► Connects to saved hotspot (WiFi STA mode)
          ↓
          └─► Gets DHCP IP (e.g., 192.168.43.x)
          └─► Gets internet access through phone's mobile data
              ↓
              └─► Connects to MQTT broker (broker.hivemq.com:1883)
                  └─► Subscribes to: behemoth/v1/control/gpio
                  └─► Publishes: {"status":"online"} to behemoth/v1/status
                      ↓
                      └─► Publishes sensor data every 3 seconds
                          └─► Browser receives it via wss://
```

---

### QR Code Format

The QR code printed on the machine encodes the following WiFi config string. iOS 11+, Android 10+ decode it natively — no app required:

```
WIFI:S:Transplanter-Setup;T:WPA;P:transplanter;;
```

Scanning this auto-prompts: *"Connect to Transplanter-Setup?"* — one tap, no typing.

---

### WiFi Reset (Reconfiguration)

```
Hold joystick button on boot:

  < 3 seconds held → release → Joystick calibration
  ≥ 3 seconds held → release → WiFi credentials cleared, restart into portal
```

---

## 2. MQTT DATA FLOW

### Publish Cycle (ESP32 → App, every 3 seconds)

```
TIME    ESP32 SIDE                       MQTT BROKER          APP SIDE
──────────────────────────────────────────────────────────────────────

T=0ms   GPS serial read
        gps.encode(SerialGPS.read())
        ↓
        publishSensorData() called
        (if millis() > lastPublish + 3000)
        ↓
        Build JSON payload:
        {
          "location": {lat, lng, speed, alt, satellites},
          "field": {plants[], currentRow, currentCol},
          "health": {detections[]},
          "timestamp": millis()
        }
        ↓
T=5ms   mqttClient.publish(
          "behemoth/v1/sensor/data",
          payload
        )
        ─────────────────────────────►
                                     Broker receives message
                                     Routes to all subscribers
                                     ─────────────────────────►
T=20ms                                                         mqtt.js receives message
                                                               (wss://broker.hivemq.com:8884)
                                                               ↓
                                                               JSON.parse(payload)
                                                               ↓
                                                               onData(parsedData) callback
                                                               ↓
                                                               React state update
                                                               ↓
                                                               Google Maps / UI re-renders

T=3000ms Next publish cycle begins
```

### Emergency Stop Flow (App → ESP32)

```
User clicks Emergency Stop in browser:
  ↓
  mqtt.publish("behemoth/v1/control/gpio", '{"pin":2,"state":1}')
  ─────────────────────────────────────────────────────►
                                                       Broker routes to ESP32
                                                       ─────────────────────►
  ESP32 mqttCallback() fires:
    topic = "behemoth/v1/control/gpio"
    payload = '{"pin":2,"state":1}'
    ↓
    deserializeJson(message)
    ↓
    pin=2, state=1
    ↓
    Safety check: pin not in [S1_PUL, S1_DIR, S2_PUL, S2_DIR]
    ↓
    pinMode(2, OUTPUT)
    digitalWrite(2, HIGH)   ← LED turns ON
    ↓
    Serial.println("GPIO 2 set to HIGH")
```

---

### Snapshot Flow (Sensor Trigger → CAM → Browser)

```
Sensor 1 rising edge detected:
  ↓
  Servo fires (plant dropped)       [existing logic]
  Plant position recorded           [existing logic]
  Stepper advances                  [existing logic]
  ↓
  captureAndPublishSnapshot() fires:
    ↓
    SerialCam.println("GET_IMAGE")
    ────────────── UART ──────────────►
                                     ESP32-CAM receives command
                                     Captures frame from camera
                                     Saves /snapshot.jpg to SD card
                                     Sends: "<filesize>\n"
                                     Sends: <raw JPEG bytes>
    ◄────────────── UART ──────────────
    ↓
    Main ESP32:
      imgSize = readStringUntil('\n').toInt()   (e.g. 4800 bytes QVGA)
      Reads imgBuf[imgSize] over UART
      mbedtls_base64_encode() → b64Buf[]        (~6400 chars)
      ↓
      mqttClient.setBufferSize(outLen + 128)
      mqttClient.publish("behemoth/v1/snapshot", b64Buf, outLen)
      mqttClient.setBufferSize(512)   // restore
    ────────────── wss:// ────────────►
                                     Browser receives base64 payload
                                     const b64 = payload.toString()
                                     setSnapshot(`data:image/jpeg;base64,${b64}`)
                                     <img src={snapshot} /> renders ✅
```

**Size budget (QVGA at quality 12):**

| Step | Size |
|------|------|
| Raw JPEG from CAM | ~3–6 KB |
| Base64 encoded (+33%) | ~4–8 KB |
| MQTT message | ~4–8 KB |
| HiveMQ free broker max | 256 MB |
| UART transfer time | ~0.8s at 115200 baud |

**SD card + MQTT — why both?**
- SD = permanent local record of every planting event (survives power loss)
- MQTT = live image on operator's phone for real-time health review

---

## 3. MQTT TOPICS SPECIFICATION


| Topic | Publisher | Subscriber | Type | Description |
|-------|-----------|------------|------|-------------|
| `behemoth/v1/sensor/data` | ESP32 | Browser | JSON | Full sensor payload, every 3s |
| `behemoth/v1/snapshot` | ESP32 | Browser | Base64 string | JPEG image at each plant trigger |
| `behemoth/v1/control/gpio` | Browser | ESP32 | JSON | GPIO pin control commands |
| `behemoth/v1/status` | ESP32 | Browser | JSON | Online/offline notification |

### Sensor Data Payload

```json
{
  "location": {
    "lat": 20.5937,
    "lng": 78.9629,
    "speed": 2.5,
    "altitude": 150.8,
    "satellites": 8
  },
  "field": {
    "plants": [
      {"row": 0, "col": 0},
      {"row": 0, "col": 1}
    ],
    "currentRow": 0,
    "currentCol": 1
  },
  "health": {
    "detections": [
      {
        "row": 0,
        "col": 0,
        "status": "healthy",
        "confidence": 0.94
      }
    ]
  },
  "timestamp": 1710907245123
}
```

### GPIO Command Payload

```json
{
  "pin": 2,
  "state": 1
}
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `pin` | number | Safe GPIO numbers | GPIO pin to control |
| `state` | number | 0 or 1 | LOW or HIGH |

---

## 4. BROKER CONFIGURATION

**Broker:** `broker.hivemq.com`
**ESP32 Port:** `1883` (plain MQTT, used by firmware)
**Browser Port:** `8884` (MQTT over secure WebSocket `wss://`, used by Next.js)

> **No account required.** HiveMQ public broker is free and shared. For production, use authenticated credentials or a private broker to prevent topic collision.

### Topic Namespace

Using prefix `behemoth/v1/` scopes all messages. Client IDs are generated from the ESP32 chip MAC address:

```cpp
// Unique ID example: "behemoth-a1b2c3d4"
sprintf(buf, "behemoth-%08X", (uint32_t)(ESP.getEfuseMac() & 0xFFFFFFFF));
```

---

## 5. ERROR SCENARIOS & HANDLING

### Scenario 1: No GPS Lock

```
ESP32 SIDE:
  gps.location.isValid() = false
  → location["lat"] = nullptr
  → location["lng"] = nullptr
  → payload published with nulls

APP SIDE:
  if (!data.location.lat || !data.location.lng)
    setGpsStatus("waiting")

USER SEES:
  "Waiting for GPS fix..."
  Spinning indicator
  "0 / 12" satellites
```

### Scenario 2: Phone Hotspot Turned Off

```
ESP32 SIDE:
  WiFi.status() != WL_CONNECTED
  mqttClient.connected() = false

  loop() detects MQTT disconnected:
    → Auto-reconnect attempt every 5 seconds

  WiFi reconnect:
    → WiFi.begin() retried automatically
    → Once WiFi reconnects → MQTT reconnects

APP SIDE:
  MQTT connection drops (no broker messages)
  mqtt.js fires "close" / "offline" event
  → setServerStatus("error")

USER SEES:
  Status indicator turns red
  "Disconnected" state
  Last known data still visible

RECOVERY:
  User turns hotspot back on
  → ESP32 auto-reconnects within ~10 seconds
  → App reconnects to MQTT broker
  → Data flows again (no user action)
```

### Scenario 3: WiFi Credentials Wrong (After Reboot)

```
ESP32:
  connectToWiFi(ssid, password, 15000)
  → Timeout after 15 seconds
  → startProvisioningPortal() — back to setup mode

USER SEES (Serial Monitor):
  "Could not connect to [SSID] — starting provisioning portal"
  "Transplanter-Setup" hotspot appears again
```

### Scenario 4: MQTT Broker Unreachable

```
ESP32:
  mqttClient.connect() returns false
  rc = -1 (MQTT_CONNECTION_LOST) or -2 (MQTT_CONNECT_FAILED)

  → Retry every 5 seconds (non-blocking)
  → Serial: "MQTT disconnected — reconnecting..."

APP SIDE:
  mqtt.js reconnects automatically (reconnectPeriod: 3000ms)
```

---

## 6. HTTP DEBUG ENDPOINTS (Local Access)

After connecting to the user's hotspot, the ESP32 still runs an HTTP server on its local DHCP IP. These are useful for debugging via Serial Monitor IP display, cURL, or Postman — but **are NOT used by the web app** (app uses MQTT exclusively).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `http://<ESP32-IP>/data` | GET | Full sensor data JSON |
| `http://<ESP32-IP>/gpio?pin=2&state=1` | GET | GPIO control |
| `http://<ESP32-IP>/snapshot.jpg` | GET | Camera image from ESP32-CAM |

Find the ESP32's local IP on the Serial Monitor:
```
Connected! IP: 192.168.43.107
```

---

## 7. STATE LIFECYCLE

```
APP STATE:

MQTT Disconnected (initial):
  mqttStatus = "connecting"
  gpsStatus = "waiting"
  gpsData = {lat: null, lng: null, ...}

MQTT Connected (broker handshake done):
  mqttStatus = "connected"
  subscribed to: behemoth/v1/sensor/data

First message received:
  gpsStatus = "ok" / "waiting" (depending on GPS lock)
  gpsData = {...live data...}
  UI updates

Subsequent messages (every 3s):
  React state updates
  Google Maps marker moves
  Field grid updates
  Health detections update

Emergency Stop pressed:
  Publish to behemoth/v1/control/gpio
  ESP32 receives within ~50ms
  LED turns on

MQTT Disconnected (lost connection):
  mqttStatus = "error"
  gpsStatus = "error"
  Last known data stays visible
  Auto-reconnect polling starts
```

---

## 8. CAPTIVE PORTAL UI DETAILS

The portal page is served as PROGMEM HTML directly from the ESP32's flash. No SD card or SPIFFS needed.

**Portal features:**
- Dark theme matching the Behemoth app aesthetic
- Scanned WiFi network list with signal strength bars (████ to █░░░)
- Password input field
- Animated "Connect Transplanter" button
- Hint text about WiFi reset

**Success/redirect page features:**
- 3-step instruction cards (switch WiFi → open app)
- 15-second countdown with JavaScript timer
- Direct "Open Behemoth App" button → `https://behemoth-companion.vercel.app`
- `<meta http-equiv="refresh">` fallback

---

## 9. COMPARISON: OLD vs NEW ARCHITECTURE

| Aspect | v2.0 (HTTP Polling) | v3.0 (MQTT Cloud Relay) |
|--------|---------------------|-------------------------|
| ESP32 WiFi mode | Access Point (creates hotspot) | Station (joins hotspot) |
| User's internet | ❌ Blocked (on ESP32 hotspot) | ✅ Full mobile data |
| Works from Vercel HTTPS | ❌ Mixed content blocked | ✅ wss:// only |
| Data delivery | HTTP polling every 3s | MQTT push every 3s |
| Emergency Stop | ❌ HTTPS→HTTP blocked | ✅ MQTT publish |
| WiFi setup | Hardcoded SSID/password | Captive portal (any hotspot) |
| Connection UX | Manual "Connect to Transplanter" in app | Scan QR → portal → done |
| CORS required | ✅ Critical | ❌ Not needed |
| Mixed content fix | ❌ Not solvable | ✅ Eliminated |
| Reconnection | On page reload only | Auto (5s retry loop) |
| Internet access | ❌ None during use | ✅ Full internet |

---

**Document Version:** 3.0
**Last Updated:** March 27, 2026
**Status:** Current Production Architecture ✅
