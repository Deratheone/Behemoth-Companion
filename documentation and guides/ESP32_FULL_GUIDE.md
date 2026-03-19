# ESP32 Implementation Guide - Behemoth Companion

## Complete Specification for ESP32 Communication

This document provides full technical specifications for implementing the ESP32 firmware to communicate with the Behemoth Companion web application.

---

## 1. OVERVIEW

### What the ESP32 Does
- Acts as an HTTP server on local WiFi network
- Collects GPS data from connected GPS module
- Monitors crop field grid positions
- Detects plant health status
- Sends all data as JSON via HTTP endpoint
- Requires CORS headers for browser access

### Communication Model
- **Protocol**: HTTP/1.1 (REST API)
- **Server Type**: TCP Server on ESP32
- **Port**: 80 (HTTP default)
- **Endpoint**: `GET /data`
- **Response Format**: JSON
- **Response Interval**: Every poll (app polls every 3000ms, expects response within 5000ms)

---

## 2. HARDWARE REQUIREMENTS

### GPS Module
- **Recommended**: NEO-6M GPS module (UART interface)
- **Alternatives**: NEO-M8N, NEO-M9N (more accurate)
- **UART Connection**:
  - RX → ESP32 GPIO 16 (or configurable)
  - TX → ESP32 GPIO 17 (or configurable)
  - GND → ESP32 Ground
  - VCC → 5V Supply

### IMU/Compass (Optional for heading)
- Can track transplanter orientation
- Not required for GPS-only operation

### WiFi Configuration
- ESP32 built-in WiFi (2.4GHz)
- Must be on same WiFi network as mobile device/computer
- Static IP recommended (easier debugging)

---

## 3. NETWORK CONFIGURATION

### WiFi Setup (Access Point / Hotspot Mode)

The ESP32 creates its own WiFi hotspot that users connect to directly. **No home router required** - perfect for farm environments.

#### ESP32 as Access Point:
```cpp
// Configure ESP32 as WiFi Access Point (Hotspot)
const char* ssid = "Transplanter";
const char* password = "12345678";
const IPAddress local_ip(192, 168, 4, 1);        // Always 192.168.4.1
const IPAddress gateway(192, 168, 4, 1);
const IPAddress subnet(255, 255, 255, 0);

void setupWiFi() {
  // Start as Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(local_ip, gateway, subnet);
  WiFi.softAP(ssid, password);

  Serial.print("ESP32 Access Point Created:");
  Serial.print("SSID: ");
  Serial.println(ssid);
  Serial.print("IP Address: ");
  Serial.println(WiFi.softAPIP());  // Will be 192.168.4.1
  Serial.print("Password: ");
  Serial.println(password);
}
```

#### User Connection Flow:
1. **ESP32 creates WiFi hotspot**: Named "Transplanter", password "12345678"
2. **User connects phone to hotspot**: Opens phone WiFi settings → selects "Transplanter" → enters password
3. **Phone connects to 192.168.4.1**: All HTTP requests go to ESP32 directly
4. **Web app fetches from**: `http://192.168.4.1/data`

#### Why Hotspot Mode?
- ✅ **No infrastructure needed** - Works without home router
- ✅ **Reliable on farms** - Guaranteed connection to device
- ✅ **Simple setup** - Fixed IP (192.168.4.1), no DHCP confusion
- ✅ **Offline capable** - Pure local WiFi, no internet dependency
- ✅ **Standard IEEE 802.11** - Compatible with all phones and devices
  Serial.println(WiFi.localIP());
}
```

### DNS/mDNS (Optional)
```cpp
// Make ESP32 accessible via hostname
// Then app can connect to http://esp32.local/data instead of IP
#include <ESPmDNS.h>

void setupMDNS() {
  if (!MDNS.begin("esp32")) {
    Serial.println("Error setting up mDNS");
  } else {
    Serial.println("mDNS responder started: esp32.local");
  }
}
```

---

## 4. DATA STRUCTURE SPECIFICATION

### Complete JSON Response Format

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
      { "row": 0, "col": 1 },
      { "row": 1, "col": 0 }
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
      },
      {
        "row": 0,
        "col": 1,
        "status": "diseased",
        "confidence": 0.87
      }
    ]
  },
  "timestamp": 1710907200000
}
```

### Field Descriptions

#### `location` Object (GPS Data)
| Field | Type | Range | Description | Example |
|-------|------|-------|-------------|---------|
| `lat` | number (null ok) | -90 to 90 | Latitude in decimal degrees | 20.5937 |
| `lng` | number (null ok) | -180 to 180 | Longitude in decimal degrees | 78.9629 |
| `speed` | number | >= 0 | Speed in km/h | 2.5 |
| `altitude` | number | any | Height above sea level in meters | 150.5 |
| `satellites` | number | 0-12+ | Number of satellites locked | 8 |

**Notes on GPS:**
- App shows "waiting" status until both `lat` and `lng` are non-null
- `speed` defaults to 0 if not available
- `altitude` defaults to 0 if not available
- `satellites` used for visual indicator (12-dot display)
- Set to `null` if GPS not locked yet

#### `field` Object (Grid Mapping)
| Field | Type | Description |
|-------|------|-------------|
| `plants` | Array<{row, col}> | List of transplanted plant positions |
| `currentRow` | number | Current row index being worked on |
| `currentCol` | number | Current column index being worked on |

**Grid Coordinate System:**
- Row 0, Col 0 = top-left corner
- Row increases downward (↓)
- Col increases rightward (→)
- Used for field mapper visualization

**Example Grid:**
```
       Col 0   Col 1   Col 2
Row 0  [P]     [P]     [E]
Row 1  [P]     [E]     [P]
Row 2  [E]     [P]     [E]

P = Plant, E = Empty
```

#### `health` Object (Plant Detection)
| Field | Type | Description |
|-------|------|-------------|
| `detections` | Array | List of plant health assessments |
| `detections[].row` | number | Row of detected plant |
| `detections[].col` | number | Column of detected plant |
| `detections[].status` | string | "healthy" \| "diseased" \| "uncertain" |
| `detections[].confidence` | number | 0.0 to 1.0 confidence score |

**Status Values:**
- `"healthy"` - Plant appears normal and healthy (green)
- `"diseased"` - Plant shows signs of disease/damage (red)
- `"uncertain"` - Cannot determine status reliably (yellow)

**Confidence Range:**
- 0.0 = No confidence
- 0.5 = 50% confidence
- 1.0 = 100% confidence
- App shows visual indicator based on confidence

#### `timestamp`
- **Type**: Unix timestamp in milliseconds (JavaScript compatible)
- **Range**: Current time in ms since Jan 1, 1970
- **Example**: 1710907200000 (March 20, 2026)
- **How to Create** (Arduino):
  ```cpp
  unsigned long timestamp = millis() + startTime; // If synced with NTP
  // Or use system time if NTP configured
  ```

---

## 5. HTTP ENDPOINT SPECIFICATION

### GET /data

#### Request
```http
GET /data HTTP/1.1
Host: 192.168.1.100
Accept: application/json
Origin: http://localhost:3000
```

**Query Parameters:** None (optional for future filtering)

#### Response Headers (CRITICAL for CORS)
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: [size]
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept
Connection: close
Pragma: no-cache
Cache-Control: no-cache
```

**CORS Headers Explanation:**
- `Access-Control-Allow-Origin: *` - Allow requests from any origin (important for browser)
- `Access-Control-Allow-Methods: GET, OPTIONS` - Allow GET and preflight OPTIONS requests
- `Access-Control-Allow-Headers: *` - Allow any headers in request

#### Response Body
- **Content-Type**: `application/json`
- **Charset**: UTF-8
- **Body**: Complete JSON object (see structure above)
- **Max Size**: Keep under 4KB for efficiency
- **Timeout**: Respond within 5 seconds (app times out after 5000ms)

#### HTTP Status Codes
- `200 OK` - Success, valid data returned
- `204 No Content` - No GPS fix yet, return empty data
- `400 Bad Request` - Configuration error
- `500 Internal Server Error` - Hardware fault

#### Example Full Response
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 487
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
Connection: close

{
  "location": {
    "lat": 20.5937,
    "lng": 78.9629,
    "speed": 0,
    "altitude": 150,
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
        "confidence": 0.95
      }
    ]
  },
  "timestamp": 1710907200000
}
```

### POST /gpio (Emergency Stop & GPIO Control)

#### Request
```http
POST /gpio HTTP/1.1
Host: 192.168.4.1
Content-Type: application/json; charset=utf-8
Accept: application/json
Origin: http://localhost:3000

{
  "pin": 2,
  "state": 1
}
```

**Body Parameters:**
- `pin` (number): GPIO pin number to control
- `state` (number): Pin state - 1 for HIGH/ON, 0 for LOW/OFF

#### Response Headers (CRITICAL for CORS)
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: [size]
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "pin": 2,
  "state": 1,
  "message": "GPIO2 set to HIGH"
}
```

#### Error Response (400 Bad Request)
```json
{
  "success": false,
  "error": "Invalid pin number or state",
  "pin": null,
  "state": null
}
```

**Pin Configuration:**
- **GPIO2**: Built-in LED (Emergency Stop indicator)
- **Valid pins**: 2, 4, 5, 12-19, 21-23, 25-27, 32-33
- **Invalid pins**: 0, 1, 6-11 (used internally), 34-39 (input only)

**Emergency Stop Usage:**
- Web app sends `{"pin": 2, "state": 1}` to turn ON built-in LED
- Used as visual indicator that emergency stop has been activated
- GPIO2 controls the blue LED on most ESP32 dev boards

---

## 6. ARDUINO/ESP32-IDF CODE STRUCTURE

### Complete Minimal Example

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// ============== CONFIGURATION ==============
const char* WIFI_SSID = "Your_WiFi_SSID";
const char* WIFI_PASSWORD = "Your_WiFi_Password";
const int GPS_BAUD = 9600;
const int POLL_INTERVAL = 1000; // ms

// ============== INSTANCES ==============
WebServer server(80);
TinyGPSPlus gps;
HardwareSerial SerialGPS(1); // UART1
unsigned long lastPoll = 0;

// ============== GPS STATE ==============
struct {
  double lat = 0;
  double lng = 0;
  float speed = 0;
  float altitude = 0;
  int satellites = 0;
  unsigned long timestamp = 0;
} gpsData;

// ============== FIELD STATE ==============
struct Plant {
  int row;
  int col;
};
vector<Plant> plants;
int currentRow = 0;
int currentCol = 0;

// ============== HEALTH STATE ==============
struct Detection {
  int row;
  int col;
  String status; // "healthy", "diseased", "uncertain"
  float confidence;
};
vector<Detection> detections;

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\nESP32 Behemoth Starting...");

  // Setup GPS
  SerialGPS.begin(GPS_BAUD, SERIAL_8N1, 16, 17);
  Serial.println("GPS initialized on UART1");

  // Setup WiFi
  setupWiFi();

  // Setup HTTP Server
  server.on("/data", HTTP_GET, handleGetData);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.on("/gpio", HTTP_POST, handleGPIOControl);
  server.on("/gpio", HTTP_OPTIONS, handleOptions);
  server.begin();
  Serial.println("HTTP Server started on port 80");
}

// ============== MAIN LOOP ==============
void loop() {
  // Handle HTTP requests
  server.handleClient();

  // Update GPS data
  if (millis() - lastPoll > POLL_INTERVAL) {
    updateGPS();
    lastPoll = millis();
  }
}

// ============== WIFI SETUP ==============
void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi: ");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi");
  }
}

// ============== GPS UPDATE ==============
void updateGPS() {
  // Read available data from GPS
  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
  }

  // Update data if fresh location
  if (gps.location.isUpdated()) {
    gpsData.lat = gps.location.lat();
    gpsData.lng = gps.location.lng();
  }

  if (gps.speed.isUpdated()) {
    gpsData.speed = gps.speed.kmph();
  }

  if (gps.altitude.isUpdated()) {
    gpsData.altitude = gps.altitude.meters();
  }

  if (gps.satellites.isUpdated()) {
    gpsData.satellites = gps.satellites.value();
  }

  gpsData.timestamp = millis();
}

// ============== HTTP HANDLERS ==============

// Handle OPTIONS request (CORS preflight)
void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(200);
}

// Handle GET /data request
void handleGetData() {
  // CORS Headers
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Content-Type", "application/json");
  server.sendHeader("Cache-Control", "no-cache");

  // Create JSON response
  StaticJsonDocument<1024> doc;

  // Location data
  JsonObject location = doc.createNestedObject("location");
  if (gpsData.lat != 0 && gpsData.lng != 0) {
    location["lat"] = gpsData.lat;
    location["lng"] = gpsData.lng;
  } else {
    location["lat"] = nullptr;
    location["lng"] = nullptr;
  }
  location["speed"] = gpsData.speed;
  location["altitude"] = gpsData.altitude;
  location["satellites"] = gpsData.satellites;

  // Field data
  JsonObject field = doc.createNestedObject("field");
  JsonArray plantsArray = field.createNestedArray("plants");
  for (const auto& plant : plants) {
    JsonObject p = plantsArray.createNestedObject();
    p["row"] = plant.row;
    p["col"] = plant.col;
  }
  field["currentRow"] = currentRow;
  field["currentCol"] = currentCol;

  // Health data
  JsonObject health = doc.createNestedObject("health");
  JsonArray detectionsArray = health.createNestedArray("detections");
  for (const auto& det : detections) {
    JsonObject d = detectionsArray.createNestedObject();
    d["row"] = det.row;
    d["col"] = det.col;
    d["status"] = det.status;
    d["confidence"] = det.confidence;
  }

  // Timestamp
  doc["timestamp"] = gpsData.timestamp;

  // Send response
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

// Handle POST /gpio request (Emergency Stop & GPIO Control)
void handleGPIOControl() {
  // CORS Headers
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Content-Type", "application/json");

  // Parse JSON request body
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Missing request body\"}");
    return;
  }

  StaticJsonDocument<200> requestDoc;
  DeserializationError error = deserializeJson(requestDoc, server.arg("plain"));

  if (error) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Invalid JSON\"}");
    return;
  }

  // Validate pin and state parameters
  if (!requestDoc.containsKey("pin") || !requestDoc.containsKey("state")) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Missing pin or state parameter\"}");
    return;
  }

  int pin = requestDoc["pin"];
  int state = requestDoc["state"];

  // Validate pin number (only allow safe GPIO pins)
  int validPins[] = {2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33};
  bool pinValid = false;
  for (int i = 0; i < sizeof(validPins) / sizeof(validPins[0]); i++) {
    if (pin == validPins[i]) {
      pinValid = true;
      break;
    }
  }

  if (!pinValid) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Invalid pin number\"}");
    return;
  }

  // Validate state (0 or 1)
  if (state != 0 && state != 1) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Invalid state (must be 0 or 1)\"}");
    return;
  }

  // Set GPIO pin mode and state
  pinMode(pin, OUTPUT);
  digitalWrite(pin, state == 1 ? HIGH : LOW);

  // Create success response
  StaticJsonDocument<200> responseDoc;
  responseDoc["success"] = true;
  responseDoc["pin"] = pin;
  responseDoc["state"] = state;
  responseDoc["message"] = String("GPIO") + String(pin) + String(state == 1 ? " set to HIGH" : " set to LOW");

  String response;
  serializeJson(responseDoc, response);

  Serial.printf("GPIO Control: Pin %d set to %s\n", pin, state == 1 ? "HIGH" : "LOW");

  server.send(200, "application/json", response);
}

// ============== HELPER FUNCTIONS ==============

// Add plant to field
void addPlant(int row, int col) {
  plants.push_back({row, col});
  Serial.printf("Plant added at (%d, %d)\n", row, col);
}

// Add health detection
void addDetection(int row, int col, String status, float confidence) {
  detections.push_back({row, col, status, confidence});
  Serial.printf("Detection: (%d, %d) = %s (%.2f)\n",
    row, col, status.c_str(), confidence);
}

// Clear field (for resetting)
void clearField() {
  plants.clear();
  detections.clear();
  Serial.println("Field cleared");
}
```

---

## 7. REQUIRED LIBRARIES

### Arduino IDE / PlatformIO

```txt
TinyGPS++ by Mikal Hart
ArduinoJson by Benoit Blanchon
ESP32 Board Support (built-in)
```

### PlatformIO platformio.ini
```ini
[env:esp32]
platform = espressif32
board = esp32doit-devkit-v1
framework = arduino
lib_deps =
    mikalhart/TinyGPS++@^1.0.3
    bblanchon/ArduinoJson@^6.19.0
monitor_speed = 115200
monitor_filters = esp32_exception_decoder
```

---

## 8. GPS MODULE SETUP (TinyGPS++)

### NEO-6M Connection Diagram
```
NEO-6M GPS Module
  VCC -----> 5V
  GND -----> GND
  RX  -----> ESP32 GPIO 17 (TX1)
  TX  -----> ESP32 GPIO 16 (RX1)
```

### NMEA Sentence Format (What GPS sends)
The GPS module sends NMEA sentences like:
```
$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
```

TinyGPS++ automatically parses these into:
- Latitude/Longitude
- Speed
- Altitude
- Number of satellites
- Timestamp
- And more...

---

## 9. DATA UPDATE RATES

### Recommended Polling Intervals
| Data Type | Update Rate | Notes |
|-----------|------------|-------|
| GPS | 1Hz (1000ms) | Standard for consumer GPS |
| Field Grid | 100ms or on change | When current position changes |
| Plant Health | 100ms or on change | When detection happens |
| Overall Response | Every request | Respond within 5 seconds |

### Query Rate from App
- **Web App Polls**: Every 3000ms (3 seconds)
- **Mobile App Polls**: Every 3000ms (3 seconds)
- **Expected Response Time**: < 5000ms (5 seconds)

### Optimization
If data rarely changes, consider:
- Sending null for GPS until location updates
- Sending empty arrays for no detections
- Include a "lastUpdate" field for each sensor

---

## 10. ERROR HANDLING

### GPS Lock Issues
```cpp
if (gps.location.isValid()) {
  // Has valid GPS lock
} else {
  // No GPS lock yet - send null coords
  location["lat"] = nullptr;
  location["lng"] = nullptr;
}
```

### WiFi Disconnection
```cpp
void loop() {
  // Check WiFi status
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  server.handleClient();
}
```

### JSON Serialization Overflow
```cpp
// If response too large, use DynamicJsonDocument
DynamicJsonDocument doc(2048); // For larger responses
```

### GPS Serial Timeout
```cpp
unsigned long lastGPSUpdate = millis();

void updateGPS() {
  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
    lastGPSUpdate = millis();
  }

  // If no data for 10 seconds, consider GPS dead
  if (millis() - lastGPSUpdate > 10000) {
    Serial.println("GPS timeout - no data received");
  }
}
```

---

## 11. TESTING & DEBUGGING

### Test with cURL
```bash
# Test from command line
curl -v http://192.168.1.100/data

# Expected response:
# < HTTP/1.1 200 OK
# < Content-Type: application/json
# < Access-Control-Allow-Origin: *
# {
#   "location": {...},
#   "field": {...},
#   "health": {...},
#   "timestamp": ...
# }
```

### Serial Monitor Output
```
ESP32 Behemoth Starting...
GPS initialized on UART1
Connecting to WiFi: ....
WiFi Connected!
IP Address: 192.168.1.100
HTTP Server started on port 80
Satellites: 5
GPS Update: 20.5937, 78.9629
Request received at /data
Response sent: 487 bytes
```

### Postman / Insomnia Testing
1. Create GET request to `http://192.168.1.100/data`
2. Check "CORS" setting is disabled (allow cross-origin)
3. Should receive JSON response in 1-2 seconds
4. Check response headers include CORS headers

---

## 12. PERFORMANCE TIPS

### Reduce JSON Size
- Only include fields with valid data
- Use shorter field names if needed (but keep as specified)
- Batch detections (send once per second)

### Reduce WiFi Load
- Cache responses if data hasn't changed
- Don't send more than 1KB per response
- Close connection properly (Connection: close)

### Improve GPS Accuracy
- Use a better antenna (external antenna recommended)
- Place GPS away from metal/electronics
- Wait 5-10 minutes for first fix (cold start)
- Add RTC for timestamp if NTP not available

### Power Efficiency
- Use Sleep modes between polls
- Reduce polling frequency when stationary
- Use lower WiFi transmit power

---

## 13. FIELD MAPPING COORDINATE SYSTEM

### Grid Layout Example
```cpp
// Define field dimensions
const int ROWS = 10;
const int COLS = 8;
const float ROW_SPACING = 0.5; // meters
const float COL_SPACING = 0.5; // meters

// Current position tracking
float currentLat = 0;
float currentLng = 0;

// Calculate grid position from GPS
void updateGridPosition() {
  // Assuming field origin at latitude/longitude
  const float fieldOriginLat = 20.5937;
  const float fieldOriginLng = 78.9629;

  // Simple calculation (works for small areas)
  // For production, use proper map projection
  currentRow = (int)((gpsData.lat - fieldOriginLat) / (ROW_SPACING / 111000));
  currentCol = (int)((gpsData.lng - fieldOriginLng) / (COL_SPACING / (111000 * cos(fieldOriginLat * 0.01745))));

  // Clamp to grid
  currentRow = constrain(currentRow, 0, ROWS - 1);
  currentCol = constrain(currentCol, 0, COLS - 1);
}
```

---

## 14. HEALTH DETECTION INTEGRATION

### Example: Integrate with ML Model
```cpp
// If using ML for plant health detection
#include <TensorFlow Lite>

void detectPlantHealth() {
  for (int r = 0; r < ROWS; r++) {
    for (int c = 0; c < COLS; c++) {
      // Get image/sensor data for grid cell
      // Run ML inference
      // Get output: healthy/diseased/uncertain + confidence

      float confidence = 0.85;
      String status = "healthy";

      if (confidence > 0.7) {
        addDetection(r, c, status, confidence);
      }
    }
  }
}
```

---

## 15. FULL IMPLEMENTATION CHECKLIST

### Hardware
- [ ] ESP32 board selected
- [ ] GPS module selected and wired
- [ ] WiFi antenna attached
- [ ] Power supply stable (5V recommended)
- [ ] UART pins connected correctly

### Software
- [ ] Arduino IDE / PlatformIO set up
- [ ] TinyGPS++ library installed
- [ ] ArduinoJson library installed
- [ ] WiFi credentials configured
- [ ] GPS UART pins configured
- [ ] HTTP server code implemented
- [ ] CORS headers included
- [ ] JSON response structure correct

### Testing
- [ ] GPS lock obtained (shows satellites)
- [ ] WiFi connects successfully
- [ ] Can ping ESP32 from computer
- [ ] cURL request to /data returns JSON
- [ ] Web app can connect and receive data
- [ ] 5-second timeout is met
- [ ] JSON schema matches expected format

### Field Deployment
- [ ] Static IP assigned or DHCP reserved
- [ ] Placed away from interference
- [ ] GPS antenna in open sky
- [ ] Power supply adequate
- [ ] Backup power (battery) available
- [ ] Data logging enabled (optional)

---

## SUMMARY

The ESP32 must:

1. **Listen** on HTTP port 80
2. **Respond** to GET `/data` requests
3. **Return** JSON with location, field, health, timestamp
4. **Include** CORS headers for browser access
5. **Respond** within 5 seconds
6. **Maintain** GPS lock with TinyGPS++
7. **Format** data exactly as specified
8. **Run continuously** once deployed

The web app will:
- Poll `/data` every 3 seconds
- Display GPS trail, field grid, plant health
- Update in real-time as data changes
- Handle GPS lock waiting periods gracefully
- Show connection status and diagnostics

This architecture allows the mobile/web app to work anywhere on the same WiFi network as the ESP32, no require internet connection.

---

**Questions or Issues?** Check:
- Serial monitor output for GPS/WiFi status
- CORS headers in HTTP response
- JSON structure exactly matches specification
- Response time under 5 seconds
- GPS has valid latitude/longitude (not 0,0)
