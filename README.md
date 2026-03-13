# 🌿 Behemoth Companion

Companion web app for **Behemoth**, an automatic vegetable transplanter built by **Team Behemoth** at **Cochin University of Science and Technology **.

This PWA provides field operators with AI chat, real-time sapling health detection, field mapping, GPS tracking, and transplanter hire, all accessible from a phone or tablet alongside the transplanter.

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-Enabled-brightgreen)

## About

Team Behemoth from Cochin University of Science and Technology (CUSAT) designed an automatic vegetable transplanter, and this companion app serves as its digital interface, giving operators tools for monitoring crop health, mapping fields, tracking the machine's position, and managing rental logistics.

## Features

| Route | Feature | Stack |
|-------|---------|-------|
| `/chat` | **AI Chat** · Gemini-powered agricultural assistant | Vercel AI SDK + Google Gemini |
| `/health` | **Health Bot** · Camera-based sapling health detection | TensorFlow.js + Teachable Machine |
| `/fieldmap` | **Field Map** · Interactive crop grid visualization | SVG with ESP32 sensor data |
| `/position` | **Position** · Live GPS tracking on Google Maps | Google Maps API + Geolocation |
| `/hire` | **Hire** · Transplanter rental booking form | React form with pricing calculator |
| `/offline` | **Offline** · Fallback page when network is unavailable | Service Worker (next-pwa) |

## Tech Stack

- **Framework:** Next.js 14 (Pages Router) + TypeScript
- **Styling:** Tailwind CSS 3.4
- **AI:** Google Gemini via `@ai-sdk/google` + `ai` SDK
- **ML:** TensorFlow.js + Teachable Machine (image classification)
- **3D/VFX:** Three.js (floating lines), OGL (plasma shader), Motion (shiny text)
- **Maps:** Google Maps JavaScript API
- **PWA:** next-pwa with Workbox service worker

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
│   ├── ChatWindow.tsx      # AI chat interface
│   ├── FieldMapper.tsx     # Interactive field grid
│   ├── FloatingLines.tsx   # Three.js background effect
│   ├── GPSTracker.tsx      # Google Maps GPS component
│   ├── InstallPWA.tsx      # PWA install prompt
│   ├── Plasma.tsx          # OGL WebGL2 shader background
│   ├── SaplingDetector.tsx # TF.js image classifier
│   ├── ShinyText.tsx       # Animated text (motion/react)
│   └── StarBorder.tsx      # Decorative border component
├── pages/
│   ├── index.tsx           # Landing page with nav grid
│   ├── chat.tsx            # AI Chat page
│   ├── health.tsx          # Sapling health detector
│   ├── fieldmap.tsx        # Field map viewer
│   ├── position.tsx        # GPS tracker page
│   ├── hire.tsx            # Transplanter rental form
│   ├── offline.tsx         # Offline fallback
│   └── api/
│       ├── chat.ts         # Gemini chat API route
│       └── gps.ts          # GPS data API route
├── public/
│   ├── model/              # Teachable Machine model files
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
├── styles/globals.css      # Global styles + Tailwind
└── utils/gemini.ts         # Gemini client config
```

## License

MIT


