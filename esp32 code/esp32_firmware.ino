// ╔══════════════════════════════════════════════════════════════════════╗
// ║          BEHEMOTH TRANSPLANTER — Main ESP32 Firmware               ║
// ║                                                                      ║
// ║  WiFi: Captive portal provisioning (QR → portal → user's hotspot)  ║
// ║  Data: MQTT publish to cloud broker (solves HTTPS/HTTP conflict)    ║
// ║  Control: MQTT subscribe for Emergency Stop / GPIO commands         ║
// ║  Snapshot: Base64 JPEG published on each sensor trigger via MQTT    ║
// ║                                                                      ║
// ║  Required Libraries (install via Arduino Library Manager):          ║
// ║    - ESP32Servo     (by Kevin Harrington)                           ║
// ║    - TinyGPS++      (by Mikal Hart)                                 ║
// ║    - ArduinoJson    (by Benoit Blanchon)  v6.x                      ║
// ║    - PubSubClient   (by Nick O'Leary)                               ║
// ║  Built-in (no install needed):                                      ║
// ║    - mbedtls/base64.h  (ESP32 Arduino core)                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

#include <ESP32Servo.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ArduinoJson.h>
#include <TinyGPS++.h>
#include <PubSubClient.h>
#include <vector>
#include "mbedtls/base64.h"   // Built-in ESP32 core — for JPEG base64 encoding

// ── UART / CAM ────────────────────────────────────────────
#define UART_TX  17
#define UART_RX  16
#define CAM_BAUD 115200

// ── Sensor Pins ───────────────────────────────────────────
const int SENSOR_PIN_1 = 18;
const int SENSOR_PIN_2 = 19;

// ── Servo ─────────────────────────────────────────────────
const int SERVO_PIN = 13;
Servo myServo;
int currentServoAngle = 0;

// ── Emergency Stop Relay ──────────────────────────────────
// Wire your relay module signal pin here.
// HIGH = relay activated = machine stopped.
// Change this if you use a different GPIO.
const int EMERGENCY_RELAY_PIN = 15;

// ── Stepper 1 (X axis) ────────────────────────────────────
const int S1_PUL = 25;
const int S1_DIR = 26;
const int S1_EN  = 21;

// ── Stepper 2 (Y axis) ────────────────────────────────────
const int S2_PUL = 32;
const int S2_DIR = 33;
const int S2_EN  = 27;

// ── Joystick ──────────────────────────────────────────────
const int JOY_VRX = 34;
const int JOY_VRY = 35;
const int JOY_SW  = 14;
const int STEP_INTERVAL = 1000;  // µs between pulses

// ── Joystick Calibration ──────────────────────────────────
Preferences prefs;
int   centerX     = 2047;
int   centerY     = 2047;
int   deadzone    = 400;
int   cardinalZone = 800;
bool  isCalibrated = false;
String activeDirection = "";

// ── Stepper 1 State ───────────────────────────────────────
bool          s1_rotating         = false;
int           s1_stepCount        = 0;
unsigned long s1_lastStep         = 0;
int           sensor1TriggerCount = 0;
bool          stepperClockwise    = true;

// ── Stepper 2 State ───────────────────────────────────────
bool          s2_rotating  = false;
int           s2_stepCount = 0;
unsigned long s2_lastStep  = 0;

// ── Sensor State ──────────────────────────────────────────
bool lastSensorState1 = LOW;
bool lastSensorState2 = LOW;

// ── Joystick Mode State ───────────────────────────────────
bool joystickMode    = false;
bool lastButtonState = HIGH;

// ── GPS ───────────────────────────────────────────────────
TinyGPSPlus gps;
HardwareSerial SerialGPS(1);
#define RXD2 16
#define TXD2 17

// ── UART for ESP32-CAM ────────────────────────────────────
HardwareSerial SerialCam(2);

// ── Data State ────────────────────────────────────────────
struct Plant {
  int row;
  int col;
};
std::vector<Plant> plants;

struct Detection {
  int row;
  int col;
  String status;
  float confidence;
};
std::vector<Detection> detections;

// ── WiFi Provisioning ─────────────────────────────────────
const char* AP_SSID     = "Transplanter-Setup";
const char* AP_PASSWORD = "transplanter";          // Portal hotspot password

// ── MQTT Broker (free public, no account needed) ──────────
const char* MQTT_SERVER  = "broker.hivemq.com";
const int   MQTT_PORT    = 1883;
const char* TOPIC_DATA     = "behemoth/v1/sensor/data";
const char* TOPIC_GPIO     = "behemoth/v1/control/gpio";
const char* TOPIC_STATUS   = "behemoth/v1/status";
const char* TOPIC_SNAPSHOT = "behemoth/v1/snapshot";   // Base64 JPEG on each plant trigger

// ── Server / MQTT Instances ───────────────────────────────
WebServer    server(80);
DNSServer    dnsServer;
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

// ── Runtime State ─────────────────────────────────────────
bool          provisioningMode  = false;
unsigned long lastMqttPublish   = 0;
const long    MQTT_INTERVAL_MS  = 3000;
String        g_networkOptions  = "";   // Scanned WiFi list for portal HTML

// ═══════════════════════════════════════════════════════════
//  CAPTIVE PORTAL HTML  (stored in flash via PROGMEM)
// ═══════════════════════════════════════════════════════════

const char PORTAL_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Behemoth Setup</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0f;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:36px 32px;width:100%;max-width:420px}
    .logo{text-align:center;margin-bottom:24px}
    .logo-icon{font-size:40px;margin-bottom:8px}
    .logo h1{font-size:22px;font-weight:700;background:linear-gradient(135deg,#22c55e,#86efac);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .logo p{color:#64748b;font-size:13px;margin-top:4px}
    .tip{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:12px 14px;margin-bottom:20px;font-size:13px;color:#86efac;line-height:1.5}
    .tip b{color:#22c55e}
    label{display:block;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px;margin-top:20px}
    label:first-of-type{margin-top:0}
    input[type=text],input[type=password]{width:100%;padding:13px 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#e2e8f0;font-size:15px;outline:none;transition:border-color .2s;-webkit-appearance:none;appearance:none}
    input:focus{border-color:rgba(34,197,94,.6);background:rgba(34,197,94,.04)}
    .scan-toggle{text-align:center;margin-top:12px}
    .scan-toggle button{background:none;border:none;color:#475569;font-size:12px;cursor:pointer;text-decoration:underline;padding:4px}
    .scan-toggle button:hover{color:#94a3b8}
    .scan-list{display:none;margin-top:12px}
    .scan-list.open{display:block}
    select{width:100%;padding:13px 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#e2e8f0;font-size:14px;outline:none;-webkit-appearance:none;appearance:none}
    select:focus{border-color:rgba(34,197,94,.6)}
    select option{background:#1e293b;color:#e2e8f0}
    button[type=submit]{width:100%;margin-top:28px;padding:16px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:14px;color:#fff;font-size:16px;font-weight:600;cursor:pointer;letter-spacing:.01em;box-shadow:0 4px 20px rgba(34,197,94,.3);transition:opacity .2s,transform .1s}
    button[type=submit]:active{opacity:.85;transform:scale(.99)}
    .hint{text-align:center;color:#334155;font-size:11px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)}
    .hint b{color:#475569}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">🌿</div>
      <h1>Behemoth Companion</h1>
      <p>Connect the transplanter to your hotspot</p>
    </div>
    <div class="tip">
      <b>Before you start:</b> Turn on your phone hotspot, then fill in the name and password below.
    </div>
    <form action="/connect" method="POST">
      <label>Your Hotspot Name (SSID)</label>
      <input type="text" name="ssid_manual" id="manualSSID"
             placeholder="e.g. Deera's iPhone / AndroidHotspot"
             autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <div class="scan-toggle">
        <button type="button" onclick="toggleScan()">Or pick from scanned networks ▾</button>
      </div>
      <div class="scan-list" id="scanList">
        <label>Nearby Networks</label>
        <select name="ssid_scanned" id="scannedSSID" onchange="pickScanned(this)">
          NETWORKS_PLACEHOLDER
        </select>
      </div>
      <label>Hotspot Password</label>
      <input type="password" name="password" placeholder="Enter your hotspot password" autocomplete="off">
      <button type="submit">&#128279;&nbsp; Connect Transplanter</button>
    </form>
    <p class="hint">Hold joystick button <b>3 seconds</b> on boot to reset WiFi</p>
  </div>
  <script>
    function toggleScan(){
      var el=document.getElementById('scanList');
      el.classList.toggle('open');
    }
    function pickScanned(sel){
      var v=sel.value;
      if(v) document.getElementById('manualSSID').value=v;
    }
  </script>
</body>
</html>
)rawliteral";

// ─────────────────────────────────────────────────────────
const char SUCCESS_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="refresh" content="15;url=https://behemoth-companion.vercel.app">
  <title>Transplanter Connecting…</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0f;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:36px 32px;width:100%;max-width:420px;text-align:center}
    .icon{font-size:56px;margin-bottom:16px;animation:pulse 1.4s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    h2{font-size:21px;font-weight:700;color:#22c55e;margin-bottom:20px}
    .step{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px;margin:10px 0;display:flex;align-items:center;gap:14px;text-align:left}
    .num{background:rgba(34,197,94,.15);color:#22c55e;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}
    .txt{font-size:14px;color:#cbd5e1;line-height:1.4}
    .txt strong{color:#e2e8f0}
    .open-btn{display:block;width:100%;margin-top:24px;padding:16px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:14px;color:#fff;font-size:16px;font-weight:600;text-decoration:none;box-shadow:0 4px 20px rgba(34,197,94,.3)}
    .timer{color:#475569;font-size:12px;margin-top:14px}
  </style>
  <script>
    var t=15;
    var iv=setInterval(function(){
      document.getElementById('t').textContent=--t;
      if(t<=0){clearInterval(iv);location.href='https://behemoth-companion.vercel.app';}
    },1000);
  </script>
</head>
<body>
  <div class="card">
    <div class="icon">🔗</div>
    <h2>Transplanter Connecting!</h2>
    <div class="step">
      <div class="num">1</div>
      <div class="txt">Open your phone <strong>WiFi Settings</strong></div>
    </div>
    <div class="step">
      <div class="num">2</div>
      <div class="txt">Reconnect to <strong>SSID_PLACEHOLDER</strong></div>
    </div>
    <div class="step">
      <div class="num">3</div>
      <div class="txt">Tap the button below to <strong>open the app</strong></div>
    </div>
    <a class="open-btn" href="https://behemoth-companion.vercel.app">🌿 &nbsp;Open Behemoth App</a>
    <p class="timer">Auto-redirects in <span id="t">15</span>s</p>
  </div>
</body>
</html>
)rawliteral";

// ═══════════════════════════════════════════════════════════
//  JOYSTICK CALIBRATION  (unchanged from original)
// ═══════════════════════════════════════════════════════════

void calibrateJoystick() {
  Serial.println("\n=== JOYSTICK CALIBRATION ===");
  Serial.println("Keep joystick CENTERED...");
  delay(3000);

  long sumX = 0, sumY = 0;
  for (int i = 0; i < 50; i++) {
    sumX += analogRead(JOY_VRX);
    sumY += analogRead(JOY_VRY);
    delay(20);
  }
  centerX = sumX / 50;
  centerY = sumY / 50;

  int maxNoise = 0;
  for (int i = 0; i < 30; i++) {
    int nx = abs(analogRead(JOY_VRX) - centerX);
    int ny = abs(analogRead(JOY_VRY) - centerY);
    maxNoise = max(maxNoise, max(nx, ny));
    delay(10);
  }

  deadzone     = max(250, maxNoise * 5);
  cardinalZone = deadzone + 350;

  prefs.begin("joystick", false);
  prefs.putInt("centerX",    centerX);
  prefs.putInt("centerY",    centerY);
  prefs.putInt("deadzone",   deadzone);
  prefs.putInt("cardinal",   cardinalZone);
  prefs.putBool("calibrated", true);
  prefs.end();

  Serial.printf("Center: X=%d Y=%d | Deadzone: +/-%d | Cardinal: +/-%d\n",
                centerX, centerY, deadzone, cardinalZone);
  Serial.println("Calibration saved!\n");
  delay(1000);
}

void loadCalibration() {
  prefs.begin("joystick", true);
  isCalibrated = prefs.getBool("calibrated", false);
  if (isCalibrated) {
    centerX      = prefs.getInt("centerX",  2047);
    centerY      = prefs.getInt("centerY",  2047);
    deadzone     = prefs.getInt("deadzone", 400);
    cardinalZone = prefs.getInt("cardinal", deadzone + 350);
  }
  prefs.end();
  if (isCalibrated) {
    Serial.printf("Loaded: Center(%d,%d) Deadzone=%d Cardinal=%d\n",
                  centerX, centerY, deadzone, cardinalZone);
  }
}

String getCardinalDirection(int x, int y) {
  int dx  = x - centerX;
  int dy  = y - centerY;
  int adx = abs(dx);
  int ady = abs(dy);

  bool xInDead     = adx <= deadzone;
  bool yInDead     = ady <= deadzone;
  bool xInCardinal = adx > cardinalZone;
  bool yInCardinal = ady > cardinalZone;
  int  holdZone    = deadzone;
  bool xHeld       = adx > holdZone;
  bool yHeld       = ady > holdZone;

  if (activeDirection == "LEFT" || activeDirection == "RIGHT") {
    if (xHeld && yInDead && adx > ady * 1.5)
      return (dx > 0) ? "LEFT" : "RIGHT";
  }
  if (activeDirection == "UP" || activeDirection == "DOWN") {
    if (yHeld && xInDead && ady > adx * 1.5)
      return (dy > 0) ? "UP" : "DOWN";
  }
  if (!xInDead && xInCardinal && yInDead && adx > ady * 1.5)
    return (dx > 0) ? "LEFT" : "RIGHT";
  if (!yInDead && yInCardinal && xInDead && ady > adx * 1.5)
    return (dy > 0) ? "UP" : "DOWN";

  return "";
}

// ═══════════════════════════════════════════════════════════
//  WIFI CREDENTIAL STORAGE
// ═══════════════════════════════════════════════════════════

void saveWiFiCredentials(const String& ssid, const String& password) {
  prefs.begin("wifi_cfg", false);
  prefs.putString("ssid",     ssid);
  prefs.putString("password", password);
  prefs.end();
  Serial.println("WiFi credentials saved: " + ssid);
}

bool loadWiFiCredentials(String& ssid, String& password) {
  prefs.begin("wifi_cfg", true);
  ssid     = prefs.getString("ssid",     "");
  password = prefs.getString("password", "");
  prefs.end();
  return ssid.length() > 0;
}

void clearWiFiCredentials() {
  prefs.begin("wifi_cfg", false);
  prefs.clear();
  prefs.end();
  Serial.println("WiFi credentials cleared.");
}

// ═══════════════════════════════════════════════════════════
//  WIFI STATION MODE
// ═══════════════════════════════════════════════════════════

bool connectToWiFi(const String& ssid, const String& password, unsigned long timeoutMs = 15000) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting to " + ssid);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > timeoutMs) {
      Serial.println("\nConnection timed out.");
      return false;
    }
    delay(400);
    Serial.print(".");
  }

  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
  return true;
}

// ═══════════════════════════════════════════════════════════
//  CAPTIVE PORTAL — HTTP HANDLERS
// ═══════════════════════════════════════════════════════════

void handlePortalRoot() {
  String html = FPSTR(PORTAL_HTML);
  html.replace("NETWORKS_PLACEHOLDER", g_networkOptions);
  server.send(200, "text/html", html);
}

void handlePortalRedirect() {
  // DNS catches everything and sends here — just redirect to root
  server.sendHeader("Location", "http://192.168.4.1/", true);
  server.send(302, "text/plain", "Redirecting to setup portal...");
}

void handleConnect() {
  // Prefer manual text input; fall back to scanned dropdown
  String ssid     = server.arg("ssid_manual");
  if (ssid.isEmpty()) ssid = server.arg("ssid_scanned");
  ssid.trim();
  String password = server.arg("password");

  if (ssid.isEmpty()) {
    // Nothing entered — send back to portal
    server.sendHeader("Location", "/");
    server.send(302, "text/plain", "");
    return;
  }

  Serial.println("Received credentials for: \"" + ssid + "\"");

  // Serve the success/redirect page immediately
  String html = FPSTR(SUCCESS_HTML);
  html.replace("SSID_PLACEHOLDER", ssid);
  server.send(200, "text/html", html);

  // Save credentials and restart (connection happens after reboot)
  saveWiFiCredentials(ssid, password);
  delay(2000);
  ESP.restart();
}

String buildNetworkOptions() {
  // Scan available networks (requires WIFI_AP_STA mode briefly)
  WiFi.mode(WIFI_AP_STA);
  int n = WiFi.scanNetworks(false, false, false, 300);
  WiFi.mode(WIFI_AP);   // Back to pure AP

  String options = "";
  if (n <= 0) {
    options = "<option value=''>No networks found — enter manually below</option>";
  } else {
    for (int i = 0; i < n; i++) {
      int    rssi = WiFi.RSSI(i);
      String ssid = WiFi.SSID(i);
      // Signal bars: 4 = strong, 1 = weak
      String bars = rssi > -60 ? "████" : rssi > -70 ? "███░" : rssi > -80 ? "██░░" : "█░░░";
      options += "<option value='" + ssid + "'>" + ssid
               + " &nbsp;" + bars + "&nbsp; (" + String(rssi) + " dBm)</option>";
    }
  }
  // Always add a blank manual option at bottom
  options += "<option value=''>── Type manually below ──</option>";
  return options;
}

void startProvisioningPortal() {
  provisioningMode = true;

  // Set up Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  WiFi.softAPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
  delay(100);

  Serial.println("\n>>> Provisioning Portal started");
  Serial.println(">>> SSID: " + String(AP_SSID));
  Serial.println(">>> Password: " + String(AP_PASSWORD));
  Serial.println(">>> IP: " + WiFi.softAPIP().toString());

  // Scan networks BEFORE starting DNS/server
  Serial.println("Scanning nearby WiFi networks...");
  g_networkOptions = buildNetworkOptions();
  Serial.println("Scan done.");

  // DNS: redirect everything to 192.168.4.1 (captive portal trigger)
  dnsServer.start(53, "*", IPAddress(192,168,4,1));

  // HTTP routes
  server.on("/",        HTTP_GET,  handlePortalRoot);
  server.on("/connect", HTTP_POST, handleConnect);
  server.onNotFound(handlePortalRedirect);

  server.begin();
  Serial.println(">>> Portal HTTP server started. Waiting for user...\n");
}

// ═══════════════════════════════════════════════════════════
//  HTTP DEBUG ENDPOINTS  (accessible on local IP after connect)
//  Still useful for direct testing — CORS headers kept for dev
// ═══════════════════════════════════════════════════════════

void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
}

void handleSnapshot() {
  SerialCam.println("GET_IMAGE");
  unsigned long start = millis();
  while (!SerialCam.available() && millis() - start < 2000) {}
  if (!SerialCam.available()) {
    addCorsHeaders();
    server.send(500, "text/plain", "No response from ESP32-CAM");
    return;
  }
  size_t imgSize = SerialCam.readStringUntil('\n').toInt();
  if (imgSize == 0) {
    addCorsHeaders();
    server.send(500, "text/plain", "Invalid image size");
    return;
  }
  uint8_t* imgBuf = (uint8_t*)malloc(imgSize);
  if (!imgBuf) {
    addCorsHeaders();
    server.send(500, "text/plain", "Memory allocation failed");
    return;
  }
  size_t received = 0;
  start = millis();
  while (received < imgSize && millis() - start < 5000) {
    if (SerialCam.available()) imgBuf[received++] = SerialCam.read();
  }
  if (received != imgSize) {
    free(imgBuf);
    addCorsHeaders();
    server.send(500, "text/plain", "Image transfer timeout");
    return;
  }
  server.sendHeader("Content-Type",   "image/jpeg");
  server.sendHeader("Content-Length", String(imgSize));
  addCorsHeaders();
  server.send(200);
  WiFiClient client = server.client();
  client.write(imgBuf, imgSize);
  free(imgBuf);
}

void handleData() {
  DynamicJsonDocument doc(2048);

  JsonObject location = doc.createNestedObject("location");
  if (gps.location.isValid()) {
    location["lat"] = gps.location.lat();
    location["lng"] = gps.location.lng();
  } else {
    location["lat"] = nullptr;
    location["lng"] = nullptr;
  }
  location["speed"]      = gps.speed.kmph();
  location["altitude"]   = gps.altitude.meters();
  location["satellites"] = gps.satellites.value();

  JsonObject field      = doc.createNestedObject("field");
  JsonArray  plantArray = field.createNestedArray("plants");
  for (const auto& p : plants) {
    JsonObject obj = plantArray.createNestedObject();
    obj["row"] = p.row;
    obj["col"] = p.col;
  }
  field["currentRow"] = sensor1TriggerCount;
  field["currentCol"] = s1_stepCount / 100;

  JsonObject health   = doc.createNestedObject("health");
  JsonArray  detArray = health.createNestedArray("detections");
  for (const auto& d : detections) {
    JsonObject obj = detArray.createNestedObject();
    obj["row"]        = d.row;
    obj["col"]        = d.col;
    obj["status"]     = d.status;
    obj["confidence"] = d.confidence;
  }
  doc["timestamp"] = millis();

  String response;
  serializeJson(doc, response);
  addCorsHeaders();
  server.send(200, "application/json", response);
}

void handleGpio() {
  if (server.hasArg("pin") && server.hasArg("state")) {
    int pin   = server.arg("pin").toInt();
    int state = server.arg("state").toInt();
    if (pin != S1_PUL && pin != S1_DIR && pin != S2_PUL && pin != S2_DIR) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, state ? HIGH : LOW);
    }
    DynamicJsonDocument doc(256);
    doc["success"] = true;
    doc["pin"]     = pin;
    doc["state"]   = state;
    String response;
    serializeJson(doc, response);
    addCorsHeaders();
    server.send(200, "application/json", response);
  } else {
    DynamicJsonDocument doc(256);
    doc["success"] = false;
    doc["error"]   = "Missing pin or state parameters";
    String response;
    serializeJson(doc, response);
    addCorsHeaders();
    server.send(400, "application/json", response);
  }
}

void handleOptions() {
  addCorsHeaders();
  server.send(200);
}

// ═══════════════════════════════════════════════════════════
//  MQTT
// ═══════════════════════════════════════════════════════════

String getMqttClientId() {
  // Unique ID from ESP32 chip MAC
  uint64_t chipId = ESP.getEfuseMac();
  char buf[32];
  sprintf(buf, "behemoth-%08X", (uint32_t)(chipId & 0xFFFFFFFF));
  return String(buf);
}

void activateEmergencyStop() {
  Serial.println("\n!!! EMERGENCY STOP ACTIVATED !!!");

  // 1. Activate relay — cuts power to whatever is wired to it
  digitalWrite(EMERGENCY_RELAY_PIN, HIGH);
  Serial.printf("    Relay (GPIO %d) → HIGH\n", EMERGENCY_RELAY_PIN);

  // 2. Disable both stepper motor drivers
  //    EN pin HIGH = disabled on most stepper drivers (A4988, DRV8825, etc.)
  digitalWrite(S1_EN, HIGH);
  digitalWrite(S2_EN, HIGH);
  Serial.println("    Steppers disabled");

  // 3. Return servo to safe (closed) position
  myServo.write(0);
  currentServoAngle = 0;
  Serial.println("    Servo → 0°");

  Serial.println("    Machine halted. Power-cycle to resume.\n");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.println("MQTT ← [" + String(topic) + "]: " + message);

  if (String(topic) == TOPIC_GPIO) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, message);
    if (err) return;

    // ── Semantic emergency stop command ─────────────────────
    const char* action = doc["action"] | "";
    if (strcmp(action, "emergency_stop") == 0) {
      activateEmergencyStop();
      return;
    }

    // ── Generic GPIO control (debug / future use) ────────────
    int pin   = doc["pin"]   | -1;
    int state = doc["state"] | 0;
    // Safety: block critical motor/sensor pins
    if (pin > 0
        && pin != SERVO_PIN
        && pin != S1_PUL && pin != S1_DIR && pin != S1_EN
        && pin != S2_PUL && pin != S2_DIR && pin != S2_EN
        && pin != SENSOR_PIN_1 && pin != SENSOR_PIN_2) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, state ? HIGH : LOW);
      Serial.printf(">>> GPIO %d → %s\n", pin, state ? "HIGH" : "LOW");
    }
  }
}

void connectMQTT() {
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);

  String clientId = getMqttClientId();
  Serial.print("Connecting to MQTT broker [" + String(MQTT_SERVER) + "]...");

  if (mqttClient.connect(clientId.c_str())) {
    Serial.println(" Connected! Client: " + clientId);
    mqttClient.subscribe(TOPIC_GPIO);
    Serial.println("Subscribed to: " + String(TOPIC_GPIO));

    // Announce device online
    mqttClient.publish(TOPIC_STATUS, "{\"status\":\"online\"}");
  } else {
    Serial.println(" Failed (rc=" + String(mqttClient.state()) + "). Will retry.");
  }
}

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
    location["lat"] = nullptr;
    location["lng"] = nullptr;
  }
  location["speed"]      = gps.speed.kmph();
  location["altitude"]   = gps.altitude.meters();
  location["satellites"] = gps.satellites.value();

  JsonObject field      = doc.createNestedObject("field");
  JsonArray  plantArray = field.createNestedArray("plants");
  for (const auto& p : plants) {
    JsonObject obj = plantArray.createNestedObject();
    obj["row"] = p.row;
    obj["col"] = p.col;
  }
  field["currentRow"] = sensor1TriggerCount;
  field["currentCol"] = s1_stepCount / 100;

  JsonObject health   = doc.createNestedObject("health");
  JsonArray  detArray = health.createNestedArray("detections");
  for (const auto& d : detections) {
    JsonObject obj = detArray.createNestedObject();
    obj["row"]        = d.row;
    obj["col"]        = d.col;
    obj["status"]     = d.status;
    obj["confidence"] = d.confidence;
  }
  doc["timestamp"] = millis();

  String payload;
  serializeJson(doc, payload);

  bool ok = mqttClient.publish(TOPIC_DATA, payload.c_str());
  Serial.println(ok ? "MQTT → published OK" : "MQTT → publish FAILED");
}

// ═══════════════════════════════════════════════════════════
//  SNAPSHOT CAPTURE & PUBLISH
//  Called on every Sensor 1 trigger (each plant planted)
//  Flow: Request from CAM → read UART bytes → base64 encode
//        → MQTT publish → browser displays inline
// ═══════════════════════════════════════════════════════════

void captureAndPublishSnapshot() {
  if (!mqttClient.connected()) {
    Serial.println("Snapshot skipped — MQTT not connected");
    return;
  }

  Serial.println("Requesting snapshot from ESP32-CAM...");
  SerialCam.println("GET_IMAGE");

  // Wait for size header from CAM
  unsigned long start = millis();
  while (!SerialCam.available() && millis() - start < 2000) { delay(10); }
  if (!SerialCam.available()) {
    Serial.println("Snapshot: CAM did not respond");
    return;
  }

  size_t imgSize = SerialCam.readStringUntil('\n').toInt();
  Serial.printf("Snapshot: CAM says %d bytes\n", imgSize);

  if (imgSize == 0 || imgSize > 80000) {
    Serial.println("Snapshot: invalid size — skipping");
    return;
  }

  // Read raw JPEG bytes from UART
  uint8_t* imgBuf = (uint8_t*)malloc(imgSize);
  if (!imgBuf) {
    Serial.println("Snapshot: malloc failed (heap too small?)");
    return;
  }

  size_t received = 0;
  start = millis();
  while (received < imgSize && millis() - start < 6000) {
    if (SerialCam.available()) imgBuf[received++] = SerialCam.read();
  }

  if (received != imgSize) {
    Serial.printf("Snapshot: only got %d/%d bytes\n", received, imgSize);
    free(imgBuf);
    return;
  }
  Serial.println("Snapshot: transfer complete");

  // Calculate base64 output size and allocate
  size_t b64Len = 4 * ((imgSize + 2) / 3) + 1;
  uint8_t* b64Buf = (uint8_t*)malloc(b64Len);
  if (!b64Buf) {
    Serial.println("Snapshot: b64 malloc failed");
    free(imgBuf);
    return;
  }

  // Encode JPEG → base64 string
  size_t outLen = 0;
  int ret = mbedtls_base64_encode(b64Buf, b64Len, &outLen, imgBuf, imgSize);
  free(imgBuf);   // Raw bytes no longer needed

  if (ret != 0) {
    Serial.println("Snapshot: base64 encode failed");
    free(b64Buf);
    return;
  }
  Serial.printf("Snapshot: base64 encoded → %d bytes\n", outLen);

  // Expand MQTT buffer to fit the payload, publish, then restore
  mqttClient.setBufferSize((uint16_t)(outLen + 128));
  bool ok = mqttClient.publish(TOPIC_SNAPSHOT, b64Buf, (unsigned int)outLen, false);
  mqttClient.setBufferSize(512);   // Restore normal buffer
  free(b64Buf);

  if (ok) {
    Serial.println("Snapshot: published to MQTT ✓");
  } else {
    Serial.println("Snapshot: MQTT publish failed (buffer? broker?)");
  }
}

// ═══════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════

void setup() {
  // Serial
  SerialCam.begin(CAM_BAUD, SERIAL_8N1, 4, 5);
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n=== BEHEMOTH TRANSPLANTER ===");

  // GPS
  SerialGPS.begin(9600, SERIAL_8N1, RXD2, TXD2);
  Serial.println("GPS initialized on UART1");

  // ── Hardware init ──────────────────────────────────────
  pinMode(SENSOR_PIN_1, INPUT);
  pinMode(SENSOR_PIN_2, INPUT);

  ESP32PWM::allocateTimer(0);
  myServo.setPeriodHertz(50);
  myServo.attach(SERVO_PIN, 500, 2400);
  myServo.write(0);

  pinMode(S1_PUL, OUTPUT); pinMode(S1_DIR, OUTPUT); pinMode(S1_EN, OUTPUT);
  digitalWrite(S1_EN, LOW); digitalWrite(S1_DIR, HIGH);

  pinMode(S2_PUL, OUTPUT); pinMode(S2_DIR, OUTPUT); pinMode(S2_EN, OUTPUT);
  digitalWrite(S2_EN, LOW); digitalWrite(S2_DIR, HIGH);

  // Emergency stop relay — starts LOW (relay off = machine running normally)
  pinMode(EMERGENCY_RELAY_PIN, OUTPUT);
  digitalWrite(EMERGENCY_RELAY_PIN, LOW);

  pinMode(JOY_SW, INPUT_PULLUP);
  delay(500);

  // ── Boot button logic ──────────────────────────────────
  // Hold joystick button on boot:
  //   < 3 seconds → joystick calibration
  //   ≥ 3 seconds → clear saved WiFi credentials
  if (digitalRead(JOY_SW) == LOW) {
    Serial.println("Button held — release within 3s for calibration, hold 3s+ to reset WiFi");
    unsigned long holdStart = millis();
    bool wifiReset = false;

    while (digitalRead(JOY_SW) == LOW) {
      if (millis() - holdStart >= 3000) {
        Serial.println(">>> 3 seconds — releasing now will RESET WiFi");
        wifiReset = true;
        delay(200); // debounce detection loop
      }
      delay(50);
    }

    if (wifiReset) {
      clearWiFiCredentials();
      Serial.println(">>> WiFi reset! Restarting into provisioning mode...");
      delay(1000);
      ESP.restart();
    } else {
      // Short press → calibrate joystick
      calibrateJoystick();
    }
  } else {
    loadCalibration();
    if (!isCalibrated) {
      Serial.println("First run — calibrating joystick...");
      calibrateJoystick();
    }
  }

  // ── WiFi Connection ────────────────────────────────────
  String savedSSID, savedPassword;

  if (loadWiFiCredentials(savedSSID, savedPassword)) {
    Serial.println("Saved network found: \"" + savedSSID + "\" — connecting...");
    bool connected = connectToWiFi(savedSSID, savedPassword, 15000);

    if (connected) {
      // Register debug HTTP endpoints (useful for Serial Monitor debugging)
      server.on("/data",         HTTP_GET,     handleData);
      server.on("/gpio",         HTTP_GET,     handleGpio);
      server.on("/gpio",         HTTP_OPTIONS, handleOptions);
      server.on("/data",         HTTP_OPTIONS, handleOptions);
      server.on("/snapshot.jpg", HTTP_GET,     handleSnapshot);
      server.begin();
      Serial.println("HTTP debug server started at http://" + WiFi.localIP().toString());

      // Connect to MQTT cloud broker
      connectMQTT();
    } else {
      Serial.println("Could not connect to \"" + savedSSID + "\" — starting provisioning portal");
      startProvisioningPortal();
    }

  } else {
    Serial.println("No saved WiFi credentials — starting provisioning portal");
    startProvisioningPortal();
  }

  Serial.println("\n=== READY ===");
  if (!provisioningMode) {
    Serial.println("MQTT broker: " + String(MQTT_SERVER));
    Serial.println("Publishing to: " + String(TOPIC_DATA));
    Serial.println("Listening on: " + String(TOPIC_GPIO));
  }
}

// ═══════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════

void loop() {

  // ── Provisioning mode: only handle portal ─────────────
  if (provisioningMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    return;
  }

  // ── Normal operation ───────────────────────────────────

  // HTTP debug server
  server.handleClient();

  // GPS feed
  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
  }

  // MQTT keep-alive + auto-reconnect
  if (!mqttClient.connected()) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = millis();
      Serial.println("MQTT disconnected — reconnecting...");
      connectMQTT();
    }
  }
  mqttClient.loop();

  // Publish sensor + GPS data every 3 seconds
  publishSensorData();

  unsigned long now = micros();

  // ── Serial recalibrate command ('r') ──────────────────
  if (Serial.available()) {
    if (Serial.read() == 'r') {
      calibrateJoystick();
      while (Serial.available()) Serial.read();
    }
  }

  // ── Joystick Button Toggle ────────────────────────────
  bool buttonState = digitalRead(JOY_SW);
  if (buttonState == LOW && lastButtonState == HIGH) {
    joystickMode = !joystickMode;
    s1_rotating  = false;
    s2_rotating  = false;
    activeDirection = "";
    Serial.println(joystickMode ? ">>> JOYSTICK MODE ON" : ">>> JOYSTICK MODE OFF");
    delay(50);
  }
  lastButtonState = buttonState;

  // ══════════════════════════════════════════════════════
  //  JOYSTICK MODE
  // ══════════════════════════════════════════════════════
  if (joystickMode) {
    int vrx = analogRead(JOY_VRX);
    int vry = analogRead(JOY_VRY);

    String dir = getCardinalDirection(vrx, vry);

    bool nowInCenter = (abs(vrx - centerX) <= deadzone) &&
                       (abs(vry - centerY) <= deadzone);
    if (nowInCenter) activeDirection = "";
    else             activeDirection = dir;

    if (dir == "LEFT" || dir == "RIGHT") {
      digitalWrite(S1_DIR, dir == "LEFT" ? HIGH : LOW);
      if (now - s1_lastStep >= STEP_INTERVAL) {
        s1_lastStep = now;
        digitalWrite(S1_PUL, HIGH);
        digitalWrite(S1_PUL, LOW);
      }
    }
    if (dir == "UP" || dir == "DOWN") {
      digitalWrite(S2_DIR, dir == "UP" ? HIGH : LOW);
      if (now - s2_lastStep >= STEP_INTERVAL) {
        s2_lastStep = now;
        digitalWrite(S2_PUL, HIGH);
        digitalWrite(S2_PUL, LOW);
      }
    }
    return;
  }

  // ══════════════════════════════════════════════════════
  //  NORMAL (AUTOMATIC) MODE
  // ══════════════════════════════════════════════════════
  int sensorState1 = digitalRead(SENSOR_PIN_1);
  int sensorState2 = digitalRead(SENSOR_PIN_2);

  // ── Sensor 1 Rising Edge ─────────────────────────────
  if (sensorState1 == HIGH && lastSensorState1 == LOW) {
    currentServoAngle = 62;
    myServo.write(currentServoAngle);
    Serial.println(">>> SENSOR 1: Servo to 62°");

    plants.push_back({sensor1TriggerCount, s1_stepCount / 100});
    if (plants.size() > 50) plants.erase(plants.begin());

    sensor1TriggerCount++;
    Serial.printf("Sensor 1 trigger #%d\n", sensor1TriggerCount);

    if (sensor1TriggerCount % 7 == 0) {
      stepperClockwise = !stepperClockwise;
      Serial.println(">>> Direction reversed! Triggering Stepper 2.");
      s2_rotating  = true;
      s2_stepCount = 0;
      s2_lastStep  = now;
    }

    digitalWrite(S1_DIR, stepperClockwise ? HIGH : LOW);
    s1_rotating  = true;
    s1_stepCount = 0;
    s1_lastStep  = now;

    // Capture & publish image from ESP32-CAM for this plant position
    captureAndPublishSnapshot();
  }

  // ── Sensor 2 Rising Edge ─────────────────────────────
  if (sensorState2 == HIGH && lastSensorState2 == LOW) {
    currentServoAngle = 0;
    myServo.write(currentServoAngle);
    Serial.println(">>> SENSOR 2: Servo to 0°");
  }

  // ── Non-blocking Stepper 1 ───────────────────────────
  if (s1_rotating && (now - s1_lastStep >= STEP_INTERVAL)) {
    s1_lastStep = now;
    digitalWrite(S1_PUL, HIGH);
    digitalWrite(S1_PUL, LOW);
    s1_stepCount++;
    if (s1_stepCount >= 400) {
      s1_rotating = false;
      Serial.println("Stepper 1: Rotation complete.");
    }
  }

  // ── Non-blocking Stepper 2 ───────────────────────────
  if (s2_rotating && (now - s2_lastStep >= STEP_INTERVAL)) {
    s2_lastStep = now;
    digitalWrite(S2_PUL, HIGH);
    digitalWrite(S2_PUL, LOW);
    s2_stepCount++;
    if (s2_stepCount >= 400) {
      s2_rotating = false;
      Serial.println("Stepper 2: Rotation complete.");
    }
  }

  lastSensorState1 = sensorState1;
  lastSensorState2 = sensorState2;
}
