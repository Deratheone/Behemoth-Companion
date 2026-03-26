#include <ESP32Servo.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <TinyGPS++.h>
#define UART_TX  17
#define UART_RX  16
#define CAM_BAUD 115200
#include <vector>
#include <DNSServer.h>

// ── Sensor Pins ───────────────────────────────────────────
const int SENSOR_PIN_1 = 18;
const int SENSOR_PIN_2 = 19;

// ── Servo ─────────────────────────────────────────────────
const int SERVO_PIN = 13;
Servo myServo;
int currentServoAngle = 0;

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
int centerX     = 2047;
int centerY     = 2047;
int deadzone    = 400;
int cardinalZone = 800;
bool isCalibrated = false;
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

// ── WiFi & WebServer ──────────────────────────────────────
const char *ssid = "Transplanter";
const char *password = "12345678";
WebServer server(80);
DNSServer dnsServer;

// ── GPS ───────────────────────────────────────────────────
TinyGPSPlus gps;
HardwareSerial SerialGPS(1); // UART1 for GPS
#define RXD2 16
#define TXD2 17

// ── UART for ESP32-CAM ────────────────────────────────────
HardwareSerial SerialCam(2); // UART2 for CAM


// ── Data State ────────────────────────────────────────────
// Structures to match the JSON response expected by the website
struct Plant {
  int row;
  int col;
};
// Simple array to store some "planted" positions (mock or real)
std::vector<Plant> plants;

struct Detection {
  int row;
  int col;
  String status; // "healthy", "diseased", "uncertain"
  float confidence;
};
std::vector<Detection> detections;

// ─────────────────────────────────────────────────────────
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
  prefs.putInt("centerX",   centerX);
  prefs.putInt("centerY",   centerY);
  prefs.putInt("deadzone",  deadzone);
  prefs.putInt("cardinal",  cardinalZone);
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

  bool xInDead    = adx <= deadzone;
  bool yInDead    = ady <= deadzone;
  bool xInCardinal = adx > cardinalZone;
  bool yInCardinal = ady > cardinalZone;

  int  holdZone = deadzone;
  bool xHeld    = adx > holdZone;
  bool yHeld    = ady > holdZone;

  // Sustain active direction with relaxed threshold
  if (activeDirection == "LEFT" || activeDirection == "RIGHT") {
    if (xHeld && yInDead && adx > ady * 1.5)
      return (dx > 0) ? "LEFT" : "RIGHT";
  }
  if (activeDirection == "UP" || activeDirection == "DOWN") {
    if (yHeld && xInDead && ady > adx * 1.5)
      return (dy > 0) ? "UP" : "DOWN";
  }

  // Fresh trigger — requires full cardinalZone
  if (!xInDead && xInCardinal && yInDead && adx > ady * 1.5)
    return (dx > 0) ? "LEFT" : "RIGHT";

  if (!yInDead && yInCardinal && xInDead && ady > adx * 1.5)
    return (dy > 0) ? "UP" : "DOWN";

  return "";
}

// ── Web Server Handlers ──────────────────────────────────
void addCorsHeaders() {

  void handleSnapshot() {
    // Request image from ESP32-CAM
    SerialCam.println("GET_IMAGE");
    // Wait for image size
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
    uint8_t *imgBuf = (uint8_t*)malloc(imgSize);
    if (!imgBuf) {
      addCorsHeaders();
      server.send(500, "text/plain", "Memory allocation failed");
      return;
    }
    size_t received = 0;
    start = millis();
    while (received < imgSize && millis() - start < 5000) {
      if (SerialCam.available()) {
        imgBuf[received++] = SerialCam.read();
      }
    }
    if (received != imgSize) {
      free(imgBuf);
      addCorsHeaders();
      server.send(500, "text/plain", "Image transfer timeout");
      return;
    }
    server.sendHeader("Content-Type", "image/jpeg");
    server.sendHeader("Content-Length", String(imgSize));
    addCorsHeaders();
    server.send(200);
    WiFiClient client = server.client();
    client.write(imgBuf, imgSize);
    free(imgBuf);
  }
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
}

void handleData() {
  DynamicJsonDocument doc(2048);

  // Location Data (from GPS)
  JsonObject location = doc.createNestedObject("location");
  if (gps.location.isValid()) {
    location["lat"] = gps.location.lat();
    location["lng"] = gps.location.lng();
  } else {
    location["lat"] = nullptr;
    location["lng"] = nullptr;
  }
  location["speed"] = gps.speed.kmph();
  location["altitude"] = gps.altitude.meters();
  location["satellites"] = gps.satellites.value();

  // Field Data (derived from stepper state/logic)
  JsonObject field = doc.createNestedObject("field");
  JsonArray plantArray = field.createNestedArray("plants");
  for(const auto& p : plants) {
    JsonObject plantObj = plantArray.createNestedObject();
    plantObj["row"] = p.row;
    plantObj["col"] = p.col;
  }
  // Mapping stepper counts to approximate row/col for display
  field["currentRow"] = sensor1TriggerCount; // Using sensor trigger as row count
  field["currentCol"] = s1_stepCount / 100;  // Rough estimate

  // Health Data (Mock or derived)
  JsonObject health = doc.createNestedObject("health");
  JsonArray detArray = health.createNestedArray("detections");
  for(const auto& d : detections) {
    JsonObject detObj = detArray.createNestedObject();
    detObj["row"] = d.row;
    detObj["col"] = d.col;
    detObj["status"] = d.status;
    detObj["confidence"] = d.confidence;
  }
  
  doc["timestamp"] = millis();

  String response;
  serializeJson(doc, response);
  
  addCorsHeaders();
  server.send(200, "application/json", response);
}

void handleGpio() {
  // Website expects to control GPIO
  // Usage: /gpio?pin=2&state=1
  if (server.hasArg("pin") && server.hasArg("state")) {
    int pin = server.arg("pin").toInt();
    int state = server.arg("state").toInt();
    
    // Safety check: Don't allow controlling critical pins
    if (pin != S1_PUL && pin != S1_DIR && pin != S2_PUL && pin != S2_DIR) {
       pinMode(pin, OUTPUT);
       digitalWrite(pin, state ? HIGH : LOW);
    }
    
    DynamicJsonDocument doc(256);
    doc["success"] = true;
    doc["pin"] = pin;
    doc["state"] = state;
    String response;
    serializeJson(doc, response);
    addCorsHeaders();
    server.send(200, "application/json", response);
  } else {
    // If no args provided (bug in frontend), just return success to avoid error
    DynamicJsonDocument doc(256);
    doc["success"] = false;
    doc["error"] = "Missing pin or state parameters";
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

// ─────────────────────────────────────────────────────────
void setup() {
    // UART for ESP32-CAM
    SerialCam.begin(CAM_BAUD, SERIAL_8N1, 4, 5); // Example: RX=4, TX=5 (adjust as needed)
  Serial.begin(115200);

  // GPS
  SerialGPS.begin(9600, SERIAL_8N1, RXD2, TXD2);
  Serial.println("GPS initialized on UART1");

  // Sensors
  pinMode(SENSOR_PIN_1, INPUT);
  pinMode(SENSOR_PIN_2, INPUT);

  // Servo
  ESP32PWM::allocateTimer(0);
  myServo.setPeriodHertz(50);
  myServo.attach(SERVO_PIN, 500, 2400);
  myServo.write(0);

  // Stepper 1
  pinMode(S1_PUL, OUTPUT);
  pinMode(S1_DIR, OUTPUT);
  pinMode(S1_EN,  OUTPUT);
  digitalWrite(S1_EN, LOW);
  digitalWrite(S1_DIR, HIGH);

  // Stepper 2
  pinMode(S2_PUL, OUTPUT);
  pinMode(S2_DIR, OUTPUT);
  pinMode(S2_EN,  OUTPUT);
  digitalWrite(S2_EN, LOW);
  digitalWrite(S2_DIR, HIGH);

  // Joystick
  pinMode(JOY_SW, INPUT_PULLUP);
  delay(500);

  // WiFi Access Point
  Serial.print("Setting up Access Point...");
  WiFi.softAP(ssid, password);
  delay(100);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print(" AP IP address: ");
  Serial.println(IP);

  // DNS Server (Captive Portal)
  // Redirect all DNS requests to the ESP32 IP
  dnsServer.start(53, "*", IP);

  // Web Server
  server.on("/data", HTTP_GET, handleData);
  server.on("/gpio", HTTP_GET, handleGpio); // Frontend sends GET
  server.on("/gpio", HTTP_OPTIONS, handleOptions);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.on("/snapshot.jpg", HTTP_GET, handleSnapshot);
  server.begin();
  Serial.println("HTTP server started");

  // Calibration on boot if button held
  if (digitalRead(JOY_SW) == LOW) {
    Serial.println("Button held — Recalibrating...");
    calibrateJoystick();
  } else {
    loadCalibration();
    if (!isCalibrated) {
      Serial.println("First run — Calibrating...");
      calibrateJoystick();
    }
  }

  Serial.println("\n=== READY ===");
  Serial.println("Send 'r' to recalibrate | Hold switch on boot to recalibrate");
}

// ─────────────────────────────────────────────────────────
void loop() {
  // Handle DNS & Web Server
  dnsServer.processNextRequest();
  server.handleClient();
  
  // Handle GPS
  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
  }

  unsigned long now = micros();

  // ── Serial recalibrate command ────────────────────────
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

  // ═════════════════════════════════════════════════════
  // JOYSTICK MODE
  // ═════════════════════════════════════════════════════
  if (joystickMode) {
    int vrx = analogRead(JOY_VRX);
    int vry = analogRead(JOY_VRY);

    String dir = getCardinalDirection(vrx, vry);

    bool nowInCenter = (abs(vrx - centerX) <= deadzone) &&
                       (abs(vry - centerY) <= deadzone);
    if (nowInCenter) activeDirection = "";
    else             activeDirection = dir;

    // ── Map direction → stepper axis + direction pin ──
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

    return; // skip sensor logic in joystick mode
  }

  // ═════════════════════════════════════════════════════
  // NORMAL MODE
  // ═════════════════════════════════════════════════════
  int sensorState1 = digitalRead(SENSOR_PIN_1);
  int sensorState2 = digitalRead(SENSOR_PIN_2);

  // ── Sensor 1 Rising Edge ─────────────────────────────
  if (sensorState1 == HIGH && lastSensorState1 == LOW) {
    currentServoAngle = 62;
    myServo.write(currentServoAngle);
    Serial.println(">>> SENSOR 1: Servo to 62°");
    
    // Add to planted list for the website
    plants.push_back({sensor1TriggerCount, s1_stepCount / 100}); 
    if(plants.size() > 50) plants.erase(plants.begin()); // Keep list manageable

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
