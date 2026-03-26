# Behemoth Companion - Documentation & Guides

Complete technical documentation for the Behemoth Companion agricultural IoT system.

**Version:** 3.0 | **Last Updated:** March 27, 2026

---

## 📚 Documentation Files

### 1. **ESP32_FULL_GUIDE.md** (Complete Technical Specification)

Comprehensive firmware implementation guide — everything needed to build and flash the ESP32.

**Contains:**
- Architecture overview (MQTT relay vs old HTTP polling)
- Hardware requirements and pin reference
- WiFi provisioning (captive portal + QR code setup)
- MQTT implementation (PubSubClient library)
- Data structure / JSON payload specification
- GPIO control and emergency stop
- GPS module setup (TinyGPS++)
- HTTP debug endpoints
- Required libraries + PlatformIO config
- Serial Monitor debug output reference
- Full implementation checklist

**Use this when:** Implementing or modifying the ESP32 firmware.

---

### 2. **ESP32_APP_INTERACTION.md** (Integration & Communication Guide)

End-to-end communication flow between ESP32 hardware and the web app. Deep dive into the data path.

**Contains:**
- Why MQTT replaced HTTP (Mixed Content Policy explanation)
- Captive portal provisioning flow (step-by-step, with timing)
- QR code format for WiFi auto-connect
- MQTT publish/subscribe cycle (with millisecond breakdown)
- Emergency stop MQTT flow
- MQTT topic specification
- Broker configuration (HiveMQ free tier)
- All error scenarios and recovery flows
- Old vs new architecture comparison table
- WiFi reset procedure
- Captive portal UI details

**Use this when:** Debugging connectivity, understanding data flow, or implementing frontend MQTT integration.

---

### 3. **SIMPLIFICATION_TASK.md** (Frontend Refactoring Log)

Documents the March 2026 frontend code cleanup — custom hooks, constants, and performance improvements.

**Contains:**
- 3 custom React hooks created (useEscapeKey, useClickOutside, useAuthProtection)
- Constants module for magic numbers
- Performance improvements (95% reduction in localStorage reads)
- Component-level changes summary
- Commit information and testing status

**Use this when:** Understanding the frontend hook architecture or reviewing past refactoring decisions.

---

## 🎯 Quick Navigation

| I want to... | Go to |
|-------------|-------|
| Flash the ESP32 firmware | **ESP32_FULL_GUIDE.md** |
| Understand the MQTT data flow | **ESP32_APP_INTERACTION.md** — Section 2 |
| Set up captive portal / QR code | **ESP32_FULL_GUIDE.md** — Section 3 |
| Debug connection issues | **ESP32_APP_INTERACTION.md** — Section 5 |
| Understand why we moved from HTTP to MQTT | **ESP32_APP_INTERACTION.md** — Section 1 |
| Find the JSON payload schema | **ESP32_FULL_GUIDE.md** — Section 5 |
| Implement Emergency Stop | **ESP32_FULL_GUIDE.md** — Section 6 |
| Install required libraries | **ESP32_FULL_GUIDE.md** — Section 8 |
| Run MQTT Explorer to verify | **ESP32_FULL_GUIDE.md** — Section 11 |
| Understand the React hook architecture | **SIMPLIFICATION_TASK.md** |

---

## 📊 Stats at a Glance

| Metric | Value |
|--------|-------|
| **Architecture Version** | 3.0 (MQTT Cloud Relay) |
| **ESP32 WiFi Mode** | Station (joins user's hotspot) |
| **Data Protocol** | MQTT 3.1.1 |
| **Cloud Broker** | broker.hivemq.com (free) |
| **Provisioning** | QR code + captive portal |
| **Last Updated** | March 27, 2026 |

---

## 🔗 Key Concepts

### Architecture Overview

```
[QR Code] → [Captive Portal] → ESP32 joins user's hotspot
                                      ↓
                               Gets internet via mobile data
                                      ↓ MQTT publish every 3s
                              [HiveMQ Cloud Broker]
                                      ↓ wss://
                              [Vercel HTTPS Web App] ✅
```

### Why MQTT (Not HTTP)

The site is on **Vercel HTTPS**. Browsers block HTTP requests from HTTPS pages (**Mixed Content Policy**). CORS headers don't fix this — the browser rejects the request before it even sends. MQTT through a cloud broker eliminates this entirely.

### MQTT Topics

```
behemoth/v1/sensor/data   ← ESP32 publishes, browser subscribes
behemoth/v1/control/gpio  ← Browser publishes, ESP32 subscribes
behemoth/v1/status        ← ESP32 publishes (online/offline)
```

### Provisioning Flow

1. User scans QR on machine → phone auto-connects to "Transplanter-Setup"
2. Captive portal opens (dark themed, scanned WiFi list)
3. User selects their hotspot + enters password
4. ESP32 saves credentials to flash → reboots → connects to hotspot
5. User switches WiFi back → opens Behemoth app → data flows

### WiFi Reset

Hold joystick button **3+ seconds on boot** → credentials cleared → provisioning portal re-opens.

### Joystick Boot Actions

| Hold Duration | Action |
|--------------|--------|
| Not held | Normal boot (load saved credentials or portal) |
| < 3 seconds then release | Joystick calibration |
| ≥ 3 seconds then release | WiFi credentials reset |

### JSON Payload Shape

```json
{
  "location": { "lat", "lng", "speed", "altitude", "satellites" },
  "field":    { "plants": [{"row", "col"}], "currentRow", "currentCol" },
  "health":   { "detections": [{"row", "col", "status", "confidence"}] },
  "timestamp": milliseconds
}
```

---

## 🛠️ Development Workflow

### Phase 1: Hardware & Libraries

1. Wire GPS module to ESP32 GPIO 16/17
2. Wire servo, steppers, sensors, joystick as per pin reference
3. Install libraries in Arduino IDE:
   - ESP32Servo
   - TinyGPS++
   - ArduinoJson v6.x
   - **PubSubClient** ← new, required

### Phase 2: Flash & Test Provisioning

1. Flash `esp32 code/esp32_firmware.ino`
2. Open Serial Monitor (115200 baud)
3. Verify: `">>> Provisioning Portal started"`
4. Connect phone to "Transplanter-Setup" hotspot
5. Verify captive portal opens
6. Enter your phone hotspot details → submit
7. Verify: `"Saved network found... Connected! IP: ..."`
8. Verify: `"MQTT → published OK"`

### Phase 3: MQTT Verification

1. Download MQTT Explorer (mqtt-explorer.com)
2. Connect to `broker.hivemq.com:1883`
3. Subscribe to `behemoth/#`
4. Power on ESP32 with hotspot active
5. Confirm sensor data messages arriving every 3 seconds

### Phase 4: App Integration

1. Open `https://behemoth-companion.vercel.app`
2. Log in
3. Confirm ESP32 connection indicator turns green (MQTT status)
4. Navigate to Position page — verify GPS data
5. Navigate to Field Map — verify plant positions
6. Press Emergency Stop — verify ESP32 LED (GPIO 2) activates
7. Check Serial Monitor confirms GPIO command received

---

## ⚠️ Important Notes

1. **PubSubClient required:** The new firmware won't compile without the PubSubClient library. Install it from Arduino Library Manager before flashing.

2. **Public broker — no privacy:** `broker.hivemq.com` is shared. Any MQTT client that knows your topic names can read data. For a competition demo this is fine. For production deployment, use an authenticated private broker.

3. **Topic collision:** If multiple Behemoth units run simultaneously on the same broker, they will share the same topics and mix data. To avoid this, customize the topic prefix (e.g., `behemoth/team7/v1/...`) per unit.

4. **GPS cold start:** First GPS fix takes 5–10 minutes outdoors. lat/lng will be `null` until then. Plan for this during field testing.

5. **MQTT keepalive:** Set to 60 seconds in firmware. If no messages for 60s, broker considers the client offline. The `mqttClient.loop()` call in the main loop handles ping/pong automatically.

6. **HTTP debug server stays active:** After connecting to the hotspot, the ESP32 still serves `/data`, `/gpio`, `/snapshot.jpg` locally. This is useful for direct cURL testing but is not used by the web app.

---

## 📞 Troubleshooting

| Issue | What to Check |
|-------|--------------|
| "Transplanter-Setup" doesn't appear | ESP32 not powered, or has saved credentials — hold joystick 3s to reset |
| Captive portal doesn't open | Try visiting `http://192.168.4.1` directly in browser |
| ESP32 can't connect to hotspot | Check SSID/password in portal; hotspot must be 2.4GHz |
| MQTT not connecting | Check if phone hotspot has internet; broker.hivemq.com reachable? |
| App shows "Disconnected" | Check MQTT broker is reachable from browser; check browser console |
| GPIO command not received | Verify ESP32 subscribed — check Serial Monitor "Subscribed to:" line |
| GPS shows "Waiting" | Normal for first 5–10 minutes outdoors; move to open sky |
| Wrong data / mixed topics | Multiple ESP32s sharing broker; customize topic prefix |

---

**Documentation Version:** 3.0
**Last Updated:** March 27, 2026
**Status:** Current and accurate for firmware v3.0 ✅
