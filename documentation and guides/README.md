# Behemoth Companion - Documentation & Guides

Complete technical documentation for the Behemoth Companion agricultural IoT system.

---

## 📚 Documentation Files

### 1. **ESP32_FULL_GUIDE.md** (Complete Technical Specification)
**Lines:** 900+ | **File Size:** 25K+

Comprehensive guide for implementing the ESP32 firmware with GPIO control. Complete everything-you-need-to-know document.

**Contains:**
- Network setup and WiFi configuration
- Data structure specification (JSON schema)
- HTTP endpoint specifications (/data, /gpio)
- Hardware requirements and wiring diagrams
- Complete Arduino/PlatformIO code examples
- GPIO control and emergency stop implementation
- CORS configuration
- GPS module setup (TinyGPS++)
- Library dependencies
- Error handling strategies
- Performance optimization tips
- Field mapping coordinate system
- Implementation checklist
- Testing and debugging procedures

**Use this when:** Implementing the ESP32 firmware code from scratch or adding GPIO control.

---

### 2. **ESP32_APP_INTERACTION.md** (Integration & Communication)
**Lines:** 1,200+ | **File Size:** 45K+

Detailed end-to-end communication flow between ESP32 and web app, including GPIO control. Deep dive into how they interact.

**Contains:**
- Network setup and connection flow
- Request-response cycles (with millisecond precision)
- Data flow transformations
- Complete data flow diagrams
- HTTP packets and headers (CORS requirements)
- GPIO control and emergency stop communication
- Error scenarios and recovery procedures
- State synchronization in React
- Real-time behavior examples
- CORS and browser security
- Network packet captures (Wireshark view)
- Timing constraints and specifications
- Complete lifecycle (startup to disconnect)
- Authentication and security notes
- Emergency stop implementation flow
- Simplified interaction overview

**Use this when:** Understanding how the ESP32 communicates with the web app, debugging connection issues, implementing GPIO control, or optimizing timing.

---

### 3. **SIMPLIFICATION_TASK.md** (Code Refactoring Details)
**Lines:** 146 | **File Size:** 6.0K

Documentation of code improvements made to the React frontend.

**Contains:**
- Files created (3 custom hooks, 1 constants file)
- Files modified (components and pages)
- Performance improvements (95% reduction in localStorage reads)
- Code quality enhancements
- Commit information
- Testing status
- Architectural decisions

**Use this when:** Understanding the frontend architecture improvements or reviewing the simplification changes.

---

## 🎯 Quick Navigation Guide

### **I want to...**

#### ...implement ESP32 firmware
→ Read **ESP32_FULL_GUIDE.md**

#### ...understand how ESP32 and app communicate
→ Read **ESP32_APP_INTERACTION.md**

#### ...add emergency stop or GPIO control
→ See **ESP32_FULL_GUIDE.md** Section 5 (GPIO Control) + **ESP32_APP_INTERACTION.md** Section 14

#### ...debug a connection issue
→ See **ESP32_APP_INTERACTION.md** Section 6 (Error Scenarios)

#### ...understand the web app architecture
→ Read **SIMPLIFICATION_TASK.md** + project main README.md

#### ...get a quick overview of everything
→ Read project main README.md and documentation files headers

#### ...understand the JSON response format
→ See **ESP32_FULL_GUIDE.md** Section 4 (Data Structure)

#### ...see the complete polling cycle
→ Read **ESP32_APP_INTERACTION.md** Section 2 (Data Flow)

#### ...understand CORS and browser security
→ See **ESP32_APP_INTERACTION.md** Section 9 (CORS)

#### ...debug GPS not showing up
→ See **ESP32_APP_INTERACTION.md** Section 6 (No GPS Lock scenario)

#### ...optimize performance
→ See **ESP32_APP_INTERACTION.md** Section 12 (Timing Constraints)

---

## 📊 Stats at a Glance

| Metric | Value |
|--------|-------|
| **Total Documentation Lines** | 2,500+ |
| **Total File Size** | ~85 KB |
| **Number of Files** | 3 guides + README |
| **Coverage** | Hardware + Firmware + Software + Integration + GPIO Control |
| **Last Updated** | March 19, 2026 |

---

## 🔗 Key Concepts

### Network Architecture (Hotspot Mode)
- **ESP32 acts as WiFi Access Point** - Creates its own hotspot
- **SSID:** "Transplanter" | **Password:** "12345678"
- **IP Address:** 192.168.4.1 (always the same)
- **User's phone** connects directly to ESP32's hotspot
- **No additional WiFi infrastructure needed** - Perfect for farms without internet

### Polling Model
The app polls ESP32 every **3 seconds** for new GPS/field/health data. No WebSockets or server-push.

### Data Flow
```
GPS Hardware → ESP32 UART → TinyGPS++ → JSON → HTTP Response → React State → Map/UI
```

### Critical Timing
- **Response Timeout:** 5 seconds max
- **Polling Interval:** 3 seconds
- **Network Latency:** 15-80ms typical
- **Connection Auto-Detect:** 2 seconds polling (up to 30 seconds)

### JSON Structure
```json
{
  "location": { "lat", "lng", "speed", "altitude", "satellites" },
  "field": { "plants", "currentRow", "currentCol" },
  "health": { "detections" },
  "timestamp": milliseconds
}
```

### CORS Headers (Required!)
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 🛠️ Development Workflow

### Phase 1: Hardware & Firmware
1. Read **ESP32_FULL_GUIDE.md** Section 2 (Hardware Requirements)
2. Wire GPS module to ESP32
3. Follow Arduino code examples in **ESP32_FULL_GUIDE.md**
4. Configure ESP32 as WiFi Access Point (hotspot):
   - SSID: **"Transplanter"**
   - Password: **"12345678"**
   - IP: **192.168.4.1**

### Phase 2: Testing
1. Connect phone to "Transplanter" WiFi hotspot
2. Use cURL to test: `curl -v http://192.168.4.1/data`
3. Check CORS headers are present
4. Verify JSON response matches schema
5. See **ESP32_FULL_GUIDE.md** Section 11 (Testing)

### Phase 3: Integration
1. Open the Behemoth Companion website (Vercel HTTPS)
2. Log in with your credentials
3. After login, click the **"Connect to Transplanter"** button (top-right, next to your profile)
4. The connection modal appears
5. Connect your phone to the "Transplanter" WiFi hotspot:
   - SSID: "Transplanter"
   - Password: "12345678"
6. Return to the app and either:
   - Click **"I'm Connected"** button (manual verification), OR
   - Let **auto-detection** run (checks every 2 seconds)
7. Modal closes automatically when connection succeeds
8. Dashboard unlocks → Real-time GPS/field/health data flows in

### Phase 4: Optimization
1. Review **ESP32_APP_INTERACTION.md** Section 12 (Timing Constraints)
2. Adjust GPS_POLL_INTERVAL_MS if needed (in utils/constants.ts)
3. Monitor network latency and response times

---

## 📝 File Structure in Project

```
behemoth Combined/
├── documentation and guides/     ← You are here
│   ├── README.md                 (This file)
│   ├── ESP32_FULL_GUIDE.md       (Firmware spec + GPIO control)
│   ├── ESP32_APP_INTERACTION.md  (Integration guide + emergency stop)
│   └── SIMPLIFICATION_TASK.md    (Code improvements)
│
├── components/                   (React components)
├── pages/                        (Next.js pages)
├── utils/                        (Utilities)
├── hooks/                        (Custom React hooks)
└── public/                       (Static assets)
```

---

## 🚀 Quick Start Checklist

- [ ] Read project main README.md for overview
- [ ] Read ESP32_FULL_GUIDE.md Section 1-3 (Setup, Data Structure, Network)
- [ ] Setup hardware (ESP32 + GPS module)
- [ ] Implement Arduino code from ESP32_FULL_GUIDE.md
- [ ] Test with cURL (both /data and /gpio endpoints)
- [ ] Connect app to ESP32
- [ ] Verify GPS data flows through
- [ ] Test emergency stop functionality
- [ ] Review ESP32_APP_INTERACTION.md to understand all scenarios
- [ ] Deploy and monitor

---

## ⚠️ Important Notes

1. **Security**: Current implementation is testing only. Not suitable for production. Add authentication, HTTPS, and rate limiting before deploying.

2. **GPS Cold Start**: First GPS fix takes 5-10 minutes (cold start). Allow time for satellites to lock before testing.

3. **CORS is Critical**: Without proper CORS headers, browser will block the request. See **ESP32_APP_INTERACTION.md** Section 9.

4. **WiFi Network**: ESP32 and app must be on the same WiFi network (2.4GHz). Direct internet connection not required.

5. **Response Time**: Responses must arrive within 5 seconds. Longer = timeout and error status.

---

## 📞 Troubleshooting

### Issue: Connection fails immediately
→ Check CORS headers in **ESP32_APP_INTERACTION.md** Section 9

### Issue: GPS shows "Waiting for GPS fix..."
→ Check Section 6 in **ESP32_APP_INTERACTION.md** (No GPS Lock scenario)

### Issue: Response times > 5 seconds
→ Check Section 12 in **ESP32_APP_INTERACTION.md** (Timing Constraints)

### Issue: Getting random errors
→ Read **ESP32_FULL_GUIDE.md** Section 10 (Error Handling)

### Issue: JSON parse error
→ Verify response format matches **ESP32_FULL_GUIDE.md** Section 4

---

**Documentation Version:** 1.0
**Last Updated:** March 19, 2026
**Status:** Complete and Ready for Implementation ✅
