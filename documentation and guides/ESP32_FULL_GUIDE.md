# ESP32 Implementation Guide - Behemoth Companion

## Complete Specification for ESP32 Firmware v3.0

This document provides full technical specifications for the ESP32 firmware that communicates with the Behemoth Companion web application via **MQTT cloud relay + captive portal WiFi provisioning**.

**Last Updated:** March 27, 2026
**Architecture:** MQTT over phone hotspot (Station mode) — replaces old HTTP/AP mode

---

## 1. OVERVIEW

### What the ESP32 Does (v3.0)

- Runs a **captive portal** on first boot for WiFi credential setup
- Connects to the user's **phone hotspot** as a WiFi client (Station mode)
- Reads GPS data from connected GPS module via UART
- Monitors stepper motors, sensors, servo
- **Publishes** all sensor data every 3 seconds to cloud MQTT broker
- **Subscribes** to GPIO control commands (Emergency Stop) from web app
- Keeps an HTTP debug server running locally for development use

### Why MQTT Instead of HTTP

The website is served from Vercel over HTTPS. Browsers enforce **Mixed Content Policy**: HTTPS pages cannot make HTTP requests. Since the ESP32 only speaks HTTP (port 80), the browser blocks every fetch before it runs — even with correct CORS headers.

The MQTT relay approach routes data through a cloud broker. The browser connects to the broker over `wss://` (secure WebSocket) — no HTTP, no mixed content, no CORS.

```
OLD (broken on HTTPS):
  Browser → HTTP GET http://192.168.4.1/data → BLOCKED by browser

NEW (works everywhere):
  ESP32 → MQTT publish → HiveMQ broker → wss:// → Browser
  Browser → MQTT publish → HiveMQ broker → MQTT subscribe → ESP32
```

### Communication Model

| Property | Value |
|----------|-------|
| **Protocol** | MQTT 3.1.1 |
| **Broker** | broker.hivemq.com (free, public) |
| **ESP32 Port** | 1883 (plain TCP) |
| **Browser Port** | 8884 (MQTT over WSS) |
| **Publish Topic** | `behemoth/v1/sensor/data` |
| **Subscribe Topic** | `behemoth/v1/control/gpio` |
| **Status Topic** | `behemoth/v1/status` |
| **Publish Interval** | Every 3000ms |
| **QoS Level** | 0 (fire-and-forget, sufficient for telemetry) |

---

## 2. HARDWARE REQUIREMENTS

### ESP32 Main Board
- **Recommended:** ESP32-DevKitC, ESP32-WROOM-32
- **WiFi:** Built-in 2.4GHz (used in Station mode)
- **Flash:** 4MB minimum (for firmware + NVS credential storage)

### GPS Module
- **Recommended:** NEO-6M (UART interface)
- **Alternatives:** NEO-M8N, NEO-M9N (more accurate)
- **UART Connection:**
  - RX → ESP32 GPIO 16 (UART1)
  - TX → ESP32 GPIO 17 (UART1)
  - GND → ESP32 Ground
  - VCC → 5V Supply
- **Baud Rate:** 9600

### Other Hardware
| Component | Pins | Purpose |
|-----------|------|---------|
| Servo motor | GPIO 13 | Plant dropping mechanism |
| Stepper 1 (X axis) | PUL=25, DIR=26, EN=21 | X-axis movement |
| Stepper 2 (Y axis) | PUL=32, DIR=33, EN=27 | Y-axis movement |
| Sensor 1 | GPIO 18 | Position detection |
| Sensor 2 | GPIO 19 | Position detection |
| Joystick X | GPIO 34 | Manual joystick control |
| Joystick Y | GPIO 35 | Manual joystick control |
| Joystick Button | GPIO 14 | Mode toggle / WiFi reset |
| ESP32-CAM | UART2 (GPIO 4/5) | Camera image relay via serial |

---

## 3. NETWORK CONFIGURATION

### Phase 1: Captive Portal (First Boot / WiFi Reset)

When no WiFi credentials are saved, the ESP32 starts in AP mode and serves a provisioning portal:

```cpp
// AP mode for provisioning
const char* AP_SSID     = "Transplanter-Setup";
const char* AP_PASSWORD = "transplanter";

WiFi.mode(WIFI_AP);
WiFi.softAP(AP_SSID, AP_PASSWORD);
WiFi.softAPConfig(
  IPAddress(192,168,4,1),
  IPAddress(192,168,4,1),
  IPAddress(255,255,255,0)
);

// DNS redirect — all domains → 192.168.4.1 (triggers captive portal)
dnsServer.start(53, "*", IPAddress(192,168,4,1));

// HTTP server handles /  (portal page) and /connect (form submit)
server.on("/", HTTP_GET, handlePortalRoot);
server.on("/connect", HTTP_POST, handleConnect);
server.onNotFound(handlePortalRedirect);
server.begin();
```

### Phase 2: Station Mode (After Credentials Set)

```cpp
// Load saved credentials from NVS
prefs.begin("wifi_cfg", true);
String ssid     = prefs.getString("ssid", "");
String password = prefs.getString("password", "");
prefs.end();

// Connect as WiFi client
WiFi.mode(WIFI_STA);
WiFi.begin(ssid.c_str(), password.c_str());
// Wait up to 15 seconds
while (WiFi.status() != WL_CONNECTED && timeout not expired) {
  delay(400);
}
// On success: got internet via phone's mobile data
```

### Saving Credentials (Portal Submit Handler)

```cpp
void handleConnect() {
  String ssid     = server.arg("ssid");
  String password = server.arg("password");

  // Serve redirect page immediately (before saving)
  String html = FPSTR(SUCCESS_HTML);
  html.replace("SSID_PLACEHOLDER", ssid);
  server.send(200, "text/html", html);

  // Save to NVS flash (survives power-off)
  prefs.begin("wifi_cfg", false);
  prefs.putString("ssid",     ssid);
  prefs.putString("password", password);
  prefs.end();

  delay(2000);
  ESP.restart();  // Reboot into Station mode
}
```

### WiFi Reset (Hardware Button)

```cpp
// On boot: hold joystick button ≥ 3 seconds → clear credentials
if (digitalRead(JOY_SW) == LOW) {
  unsigned long holdStart = millis();
  while (digitalRead(JOY_SW) == LOW) {
    if (millis() - holdStart >= 3000) {
      // Clear credentials
      prefs.begin("wifi_cfg", false);
      prefs.clear();
      prefs.end();
      ESP.restart();
    }
    delay(50);
  }
  // Released before 3s → joystick calibration instead
  calibrateJoystick();
}
```

### Network Scan for Portal UI

```cpp
// Scan in AP_STA mode (brief), then return to pure AP
WiFi.mode(WIFI_AP_STA);
int n = WiFi.scanNetworks(false, false, false, 300);
WiFi.mode(WIFI_AP);

// Build HTML <option> elements
for (int i = 0; i < n; i++) {
  int    rssi = WiFi.RSSI(i);
  String ssid = WiFi.SSID(i);
  String bars = rssi > -60 ? "████" : rssi > -70 ? "███░" : rssi > -80 ? "██░░" : "█░░░";
  options += "<option value='" + ssid + "'>" + ssid + " " + bars + "</option>";
}
```

---

## 4. MQTT IMPLEMENTATION

### Required Library

Install via Arduino Library Manager:
**PubSubClient** by Nick O'Leary (also: `knolleary/pubsubclient`)

### MQTT Setup

```cpp
#include <PubSubClient.h>

const char* MQTT_SERVER  = "broker.hivemq.com";
const int   MQTT_PORT    = 1883;
const char* TOPIC_DATA     = "behemoth/v1/sensor/data";
const char* TOPIC_GPIO     = "behemoth/v1/control/gpio";
const char* TOPIC_STATUS   = "behemoth/v1/status";
const char* TOPIC_SNAPSHOT = "behemoth/v1/snapshot";  // Base64 JPEG per plant trigger

WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

void connectMQTT() {
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);

  // Unique client ID from chip MAC
  uint64_t chipId = ESP.getEfuseMac();
  char clientId[32];
  sprintf(clientId, "behemoth-%08X", (uint32_t)(chipId & 0xFFFFFFFF));

  if (mqttClient.connect(clientId)) {
    mqttClient.subscribe(TOPIC_GPIO);
    mqttClient.publish(TOPIC_STATUS, "{\"status\":\"online\"}");
  }
}
```

### Publishing Sensor Data

```cpp
unsigned long lastMqttPublish = 0;
const long    MQTT_INTERVAL_MS = 3000;

void publishSensorData() {
  if (millis() - lastMqttPublish < MQTT_INTERVAL_MS) return;
  if (!mqttClient.connected()) return;
  lastMqttPublish = millis();

  DynamicJsonDocument doc(2048);

  JsonObject location = doc.createNestedObject("location");
  if (gps.location.isValid()) {
    location["lat"] = gps.location.lat();
    location["lng"] = gps.location.lng();
  } else {
    location["lat"] = nullptr;  // null, not 0
    location["lng"] = nullptr;
  }
  location["speed"]      = gps.speed.kmph();
  location["altitude"]   = gps.altitude.meters();
  location["satellites"] = gps.satellites.value();

  JsonObject field = doc.createNestedObject("field");
  // ... plants array, currentRow, currentCol ...

  JsonObject health = doc.createNestedObject("health");
  // ... detections array ...

  doc["timestamp"] = millis();

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(TOPIC_DATA, payload.c_str());
}
```

### Receiving GPIO Commands (Emergency Stop)

```cpp
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];

  if (String(topic) == TOPIC_GPIO) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, message);

    int pin   = doc["pin"]   | -1;
    int state = doc["state"] | 0;

    // Safety: reject critical stepper/servo pins
    if (pin > 0 && pin != S1_PUL && pin != S1_DIR
               && pin != S2_PUL && pin != S2_DIR) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, state ? HIGH : LOW);
      Serial.printf("GPIO %d → %s\n", pin, state ? "HIGH" : "LOW");
    }
  }
}
```

### MQTT Auto-Reconnect in Loop

```cpp
void loop() {
  // MQTT keep-alive + non-blocking reconnect
  if (!mqttClient.connected()) {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 5000) {
      lastReconnect = millis();
      connectMQTT();
    }
  }
  mqttClient.loop();

  // Publish data
  publishSensorData();

  // Handle GPS, sensors, steppers...
}
```

---

## 5. DATA STRUCTURE SPECIFICATION

### JSON Payload (published to `behemoth/v1/sensor/data`)

```json
{
  "location": {
    "lat": 20.5937,
    "lng": 78.9629,
    "speed": 2.5,
    "altitude": 150.5,
    "satellites": 8
  },
  "field": {
    "plants": [
      { "row": 0, "col": 0 },
      { "row": 0, "col": 1 }
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
        "confidence": 0.95
      }
    ]
  },
  "timestamp": 1710907200000
}
```

### Field Descriptions

#### `location` Object
| Field | Type | Range | Notes |
|-------|------|-------|-------|
| `lat` | number \| null | -90 to 90 | null until GPS fix |
| `lng` | number \| null | -180 to 180 | null until GPS fix |
| `speed` | number | ≥ 0 | km/h from GPS |
| `altitude` | number | any | meters above sea level |
| `satellites` | number | 0–20 | used for signal strength UI |

> Always send `null` (not `0`) for lat/lng when GPS is not locked. The app checks `if (!lat || !lng)` to determine GPS status.

#### `field` Object
| Field | Type | Description |
|-------|------|-------------|
| `plants` | Array<{row, col}> | All transplanted positions (max 50) |
| `currentRow` | number | Active row (from sensor trigger count) |
| `currentCol` | number | Active col (from s1_stepCount / 100) |

#### `health` Object
| Field | Type | Values |
|-------|------|--------|
| `detections[].status` | string | `"healthy"` \| `"diseased"` \| `"uncertain"` |
| `detections[].confidence` | number | 0.0 to 1.0 |

---

## 6. GPIO COMMAND SPECIFICATION

### Command Payload (received on `behemoth/v1/control/gpio`)

```json
{ "pin": 2, "state": 1 }
```

| Field | Type | Values |
|-------|------|--------|
| `pin` | number | Any safe GPIO number |
| `state` | number | 0 = LOW, 1 = HIGH |

### Protected Pins (rejected by firmware)

The following pins are protected and **cannot** be controlled via MQTT:

| Pin | Reason |
|-----|--------|
| S1_PUL (25) | Stepper 1 pulse — safety critical |
| S1_DIR (26) | Stepper 1 direction — safety critical |
| S2_PUL (32) | Stepper 2 pulse — safety critical |
| S2_DIR (33) | Stepper 2 direction — safety critical |

### Emergency Stop

The web app Emergency Stop button sends:
```json
{ "pin": 2, "state": 1 }
```
This turns on the built-in LED (GPIO 2) as a visual indicator that emergency stop has been activated.

---

## 7. HTTP DEBUG ENDPOINTS

After connecting to the phone hotspot, the ESP32 also runs a local HTTP server at its DHCP IP. These are **for debugging only** — the web app uses MQTT exclusively.

```
GET http://<ESP32-local-IP>/data          → Full JSON sensor data
GET http://<ESP32-local-IP>/gpio?pin=2&state=1  → GPIO control
GET http://<ESP32-local-IP>/snapshot.jpg  → Camera image
```

Find the local IP on Serial Monitor:
```
Connected! IP: 192.168.43.107
```

Test from laptop on same hotspot:
```bash
curl http://192.168.43.107/data | python -m json.tool
```

---

## 8. REQUIRED LIBRARIES

### Arduino IDE — Library Manager

| Library | Author | Version |
|---------|--------|---------|
| ESP32Servo | Kevin Harrington | latest |
| TinyGPS++ | Mikal Hart | ^1.0.3 |
| ArduinoJson | Benoit Blanchon | ^6.x |
| **PubSubClient** | **Nick O'Leary** | **^2.8** ← NEW |

### PlatformIO `platformio.ini`

```ini
[env:esp32]
platform = espressif32
board = esp32doit-devkit-v1
framework = arduino
lib_deps =
    mikalhart/TinyGPS++@^1.0.3
    bblanchon/ArduinoJson@^6.19.0
    knolleary/PubSubClient@^2.8
monitor_speed = 115200
```

---

## 9. GPIO & PIN REFERENCE

```
ESP32 Pin Map — Behemoth Firmware
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GPIO 4  → ESP32-CAM UART2 RX
GPIO 5  → ESP32-CAM UART2 TX
GPIO 13 → Servo Motor
GPIO 14 → Joystick Button (INPUT_PULLUP)
GPIO 16 → GPS UART1 RX
GPIO 17 → GPS UART1 TX
GPIO 18 → Sensor 1 (INPUT)
GPIO 19 → Sensor 2 (INPUT)
GPIO 21 → Stepper 1 Enable
GPIO 25 → Stepper 1 Pulse
GPIO 26 → Stepper 1 Direction
GPIO 27 → Stepper 2 Enable
GPIO 32 → Stepper 2 Pulse
GPIO 33 → Stepper 2 Direction
GPIO 34 → Joystick VRX (INPUT only)
GPIO 35 → Joystick VRY (INPUT only)
GPIO 2  → Built-in LED (Emergency Stop indicator)
```

---

## 10. GPS MODULE SETUP (TinyGPS++)

### NEO-6M Wiring

```
NEO-6M GPS Module     ESP32
  VCC  ─────────────► 5V
  GND  ─────────────► GND
  RX   ─────────────► GPIO 17 (UART1 TX)
  TX   ─────────────► GPIO 16 (UART1 RX)
```

### NMEA Parsing

```cpp
HardwareSerial SerialGPS(1);
TinyGPSPlus gps;

// In setup()
SerialGPS.begin(9600, SERIAL_8N1, 16, 17);

// In loop()
while (SerialGPS.available() > 0) {
  gps.encode(SerialGPS.read());
}

// Use GPS data
if (gps.location.isValid()) {
  float lat = gps.location.lat();
  float lng = gps.location.lng();
}
```

### GPS Cold Start Note

First GPS fix takes **5–10 minutes** on cold start. During this time, `gps.location.isValid()` returns false. The firmware sends `"lat": null, "lng": null` until lock is acquired.

---

## 11. TESTING & DEBUGGING

### Serial Monitor Output (Normal Operation)

```
=== BEHEMOTH TRANSPLANTER ===
GPS initialized on UART1
Loaded: Center(2047,2047) Deadzone=400 Cardinal=750
Saved network found: "Deera's iPhone" — connecting...
.....Connected! IP: 192.168.43.107
HTTP debug server started at http://192.168.43.107
Connecting to MQTT broker [broker.hivemq.com]... Connected! Client: behemoth-a1b2c3d4
Subscribed to: behemoth/v1/control/gpio

=== READY ===
MQTT broker: broker.hivemq.com
Publishing to: behemoth/v1/sensor/data
Listening on: behemoth/v1/control/gpio

MQTT → published OK
MQTT → published OK
>>> SENSOR 1: Servo to 62°
Sensor 1 trigger #1
```

### Serial Monitor — Provisioning Mode

```
=== BEHEMOTH TRANSPLANTER ===
No saved WiFi credentials — starting provisioning portal
Scanning nearby WiFi networks...
Scan done. Found 4 networks.
>>> Provisioning Portal started
>>> SSID: Transplanter-Setup
>>> IP: 192.168.4.1
>>> Portal HTTP server started. Waiting for user...
```

### Test MQTT from Desktop (MQTT Explorer)

1. Download MQTT Explorer: https://mqtt-explorer.com/
2. Connect to `broker.hivemq.com:1883`
3. Subscribe to `behemoth/#`
4. Power on ESP32 with hotspot active
5. Watch messages arrive on `behemoth/v1/sensor/data`
6. Publish `{"pin":2,"state":1}` to `behemoth/v1/control/gpio`
7. Verify ESP32 Serial Monitor shows "GPIO 2 set to HIGH"

### Test HTTP Debug Endpoint

```bash
# Find ESP32 IP from Serial Monitor, then:
curl http://192.168.43.107/data | python -m json.tool

# Test GPIO control:
curl "http://192.168.43.107/gpio?pin=2&state=1"
```

---

## 12. ERROR HANDLING

### MQTT Reconnection

```cpp
// In loop() — non-blocking reconnect
if (!mqttClient.connected()) {
  static unsigned long lastReconnect = 0;
  if (millis() - lastReconnect > 5000) {
    lastReconnect = millis();
    connectMQTT();   // Will retry automatically
  }
}
mqttClient.loop();   // Must call every loop iteration
```

### WiFi Reconnection

```cpp
// In loop() — auto-reconnect if dropped
if (WiFi.status() != WL_CONNECTED) {
  // WiFi.begin() was already called — reconnects automatically
  // MQTT will reconnect once WiFi is back
}
```

### Failed WiFi Connection → Back to Portal

```cpp
bool connected = connectToWiFi(ssid, password, 15000);
if (!connected) {
  // Wrong password or hotspot not available
  startProvisioningPortal();  // Let user try again
}
```

---

## 13. IMPLEMENTATION CHECKLIST

### Hardware
- [ ] ESP32 board
- [ ] NEO-6M GPS module wired to GPIO 16/17
- [ ] Servo motor on GPIO 13
- [ ] Stepper drivers wired (X: 25/26/21, Y: 32/33/27)
- [ ] Sensors on GPIO 18/19
- [ ] Joystick on GPIO 34/35/14
- [ ] ESP32-CAM on UART2 (GPIO 4/5)

### Arduino IDE Setup
- [ ] ESP32 board support installed
- [ ] ESP32Servo library installed
- [ ] TinyGPS++ library installed
- [ ] ArduinoJson library installed
- [ ] **PubSubClient library installed** ← NEW

### Firmware
- [ ] Flash `esp32_firmware.ino`
- [ ] Open Serial Monitor (115200 baud)
- [ ] Verify "Provisioning Portal started" on first boot
- [ ] QR code sticker printed and placed on machine

### First Setup Test
- [ ] Scan QR code with phone
- [ ] Captive portal opens automatically
- [ ] Select hotspot → set password → submit
- [ ] "Connecting..." page appears
- [ ] Switch phone WiFi back to hotspot
- [ ] Tap "Open Behemoth App"
- [ ] App loads on Vercel
- [ ] Serial Monitor shows "MQTT → published OK"

### MQTT Verification
- [ ] MQTT Explorer connected to broker.hivemq.com
- [ ] Data arriving on `behemoth/v1/sensor/data`
- [ ] GPIO command publishes reach ESP32

---

**Document Version:** 3.0
**Last Updated:** March 27, 2026
**Status:** Current Production Specification ✅
