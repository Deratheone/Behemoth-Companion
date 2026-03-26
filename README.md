# 🌿 Behemoth Companion

Companion web app for **Behemoth**, an automatic vegetable transplanter built by **Team Behemoth** at **Cochin University of Science and Technology (CUSAT)**.

This PWA provides field operators with AI chatbot, real-time sapling health detection, field mapping, GPS tracking, emergency stop controls, and transplanter hire — all accessible from a phone or tablet alongside the transplanter.

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-Enabled-brightgreen)
![MQTT](https://img.shields.io/badge/MQTT-HiveMQ-purple)

## About

Team Behemoth from Cochin University of Science and Technology (CUSAT) designed an automatic vegetable transplanter, and this companion app serves as its digital interface, giving operators tools for monitoring crop health, mapping fields, tracking the machine's position, and managing rental logistics.

## Features

| Route | Feature | Stack |
|-------|---------|-------|
| `/chat` | **AI Chat** · Gemini-powered agricultural assistant | Vercel AI SDK + Google Gemini |
| `/health` | **Health Bot** · Camera-based sapling health detection | TensorFlow.js + Teachable Machine |
| `/fieldmap` | **Field Map** · Interactive crop grid visualization | SVG with ESP32 sensor data via MQTT |
| `/position` | **Position** · Live GPS tracking on Google Maps | Google Maps API + MQTT real-time |
| `/hire` | **Hire** · Transplanter rental booking form | React form with pricing calculator |
| `/offline` | **Offline** · Fallback page when network is unavailable | Service Worker (next-pwa) |
| **Emergency Stop** | **Safety Control** · Remote GPIO control via MQTT | ESP32 MQTT subscribe + GPIO |

## Tech Stack

- **Framework:** Next.js 14 (Pages Router) + TypeScript
- **Styling:** Tailwind CSS 3.4
- **AI:** Google Gemini via `@ai-sdk/google` + `ai` SDK
- **ML:** TensorFlow.js + Teachable Machine (image classification)
- **3D/VFX:** Three.js (floating lines), OGL (plasma shader), Motion (shiny text)
- **Maps:** Google Maps JavaScript API
- **PWA:** next-pwa with Workbox service worker
- **IoT Communication:** MQTT over secure WebSocket (`wss://`) via HiveMQ public broker

## ESP32 Connection Architecture

The ESP32 connects to the operator's phone hotspot (Station mode) and publishes sensor data to a free cloud MQTT broker. The Vercel app subscribes to the same broker over secure WebSocket — completely eliminating the HTTPS/HTTP mixed content problem.

```
QR Code on machine
      │ scan
      ▼
Captive Portal (192.168.4.1) ← "Transplanter-Setup" hotspot
      │ user enters their hotspot details
      ▼
ESP32 connects to phone hotspot → gets internet
      │ MQTT publish every 3s
      ▼
HiveMQ Cloud Broker ←── wss:// ──► Vercel HTTPS App
```

### First-Time Setup Flow
1. **Scan the QR code** on the transplanter (or connect to `Transplanter-Setup` WiFi manually)
2. **Captive portal opens** automatically — shows nearby WiFi networks
3. **Select your hotspot** and enter the password
4. **Tap "Connect Transplanter"** — device saves credentials and reboots
5. **Switch your phone back** to your hotspot — tap the app link
6. **App opens** — ESP32 data flows in real-time via MQTT

### Subsequent Boots
ESP32 auto-connects to the saved hotspot. No user action needed.

### WiFi Reset
Hold the joystick button for **3+ seconds on boot** to clear saved WiFi credentials and re-enter setup mode.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
git clone https://github.com/Deratheone/Behemoth-Companion.git
cd Behemoth-Companion
npm install
```

### Environment Variables

Copy the example file and add your API keys:

```bash
cp .env.local.example .env.local
```

| Variable | Description | Get it from |
|----------|-------------|-------------|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Google Generative AI key | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Maps JavaScript API key | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

## Project Structure

```
├── components/
│   ├── ChatWindow.tsx         # AI chat interface
│   ├── EmergencyStop.tsx      # MQTT GPIO command button (top-right)
│   ├── FieldMapper.tsx        # Interactive field grid (MQTT data)
│   ├── FloatingLines.tsx      # Three.js background effect
│   ├── GPSTracker.tsx         # Google Maps GPS component (MQTT data)
│   ├── InstallPWA.tsx         # PWA install prompt
│   ├── Plasma.tsx             # OGL WebGL2 shader background
│   ├── SaplingDetector.tsx    # TF.js image classifier
│   ├── ShinyText.tsx          # Animated text (motion/react)
│   └── StarBorder.tsx         # Decorative border component
├── pages/
│   ├── index.tsx              # Landing page with nav grid
│   ├── chat.tsx               # AI Chat page
│   ├── health.tsx             # Sapling health detector
│   ├── fieldmap.tsx           # Field map viewer
│   ├── position.tsx           # GPS tracker page
│   ├── hire.tsx               # Transplanter rental form
│   ├── offline.tsx            # Offline fallback
│   └── api/
│       ├── chat.ts            # Gemini chat API route
│       └── gps.ts             # GPS data API route
├── esp32 code/
│   ├── esp32_firmware.ino     # Main ESP32 firmware (MQTT + captive portal)
│   └── esp32cam.ino           # ESP32-CAM firmware (UART bridge)
├── public/
│   ├── model/                 # Teachable Machine model files
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker
├── styles/globals.css         # Global styles + Tailwind
└── utils/
    ├── esp32.ts               # ESP32 type definitions (legacy, kept for reference)
    ├── mqtt.ts                # MQTT client utility (wss:// broker)
    ├── constants.ts           # App-wide constants
    └── gemini.ts              # Gemini client config
```

## ESP32 Firmware Libraries

Install via Arduino Library Manager:

| Library | Author | Purpose |
|---------|--------|---------|
| ESP32Servo | Kevin Harrington | Servo motor control |
| TinyGPS++ | Mikal Hart | GPS NMEA parsing |
| ArduinoJson | Benoit Blanchon | JSON serialization |
| **PubSubClient** | **Nick O'Leary** | **MQTT client (NEW)** |

## MQTT Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `behemoth/v1/sensor/data` | ESP32 → App | GPS, field, health data (every 3s) |
| `behemoth/v1/snapshot` | ESP32 → App | Base64 JPEG captured at each plant trigger |
| `behemoth/v1/control/gpio` | App → ESP32 | Emergency stop / GPIO commands |
| `behemoth/v1/status` | ESP32 → App | Online/offline status |

Broker: `broker.hivemq.com` (free public, no account required)

## License

MIT
