import { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";

interface GPSData {
  lat: number | null;
  lng: number | null;
  speed: number;
  altitude: number;
  satellites: number;
  timestamp: string | null;
}

interface TrailEntry {
  time: string;
  coords: string;
}

type GpsStatus = "waiting" | "ok" | "error";
type ServerStatus = "connecting" | "ok" | "error";

export default function GPSTracker() {
  const [gpsData, setGpsData] = useState<GPSData>({
    lat: null, lng: null, speed: 0, altitude: 0, satellites: 0, timestamp: null,
  });
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("waiting");
  const [serverStatus, setServerStatus] = useState<ServerStatus>("connecting");
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [clock, setClock] = useState("--:--:--");
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const trailLogRef = useRef<HTMLDivElement>(null);
  const firstFixRef = useRef(true);

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Init Google Map
  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapStyles: google.maps.MapTypeStyle[] = [
      { elementType: "geometry", stylers: [{ color: "#0d1b2e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#0d1b2e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#4a7fa5" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a3a5c" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0d2137" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e4d7a" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#050e1a" }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#0e2233" }] },
      { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1a3a5c" }] },
    ];

    const m = new google.maps.Map(mapRef.current, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      disableDefaultUI: true,
      zoomControl: true,
      styles: mapStyles,
    });
    mapInstanceRef.current = m;

    markerRef.current = new google.maps.Marker({
      map: m,
      title: "ESP32 GPS",
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 8,
        fillColor: "#00d4ff",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        rotation: 0,
      },
    });

    circleRef.current = new google.maps.Circle({
      map: m,
      strokeColor: "#00d4ff", strokeOpacity: 0.4, strokeWeight: 1,
      fillColor: "#00d4ff", fillOpacity: 0.06, radius: 50,
    });

    polylineRef.current = new google.maps.Polyline({
      map: m,
      strokeColor: "#00d4ff", strokeOpacity: 0.5, strokeWeight: 2,
      geodesic: true, path: [],
    });
  }, []);

  useEffect(() => {
    if (mapsLoaded) initMap();
  }, [mapsLoaded, initMap]);

  // Poll GPS data
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const res = await fetch("/api/gps");
        const data: GPSData = await res.json();

        setServerStatus("ok");

        if (!data.lat || !data.lng) {
          setGpsStatus("waiting");
          return;
        }

        setGpsStatus("ok");
        setGpsData(data);

        const pos = { lat: data.lat, lng: data.lng };

        if (markerRef.current) markerRef.current.setPosition(pos);
        if (circleRef.current) circleRef.current.setCenter(pos);

        if (mapInstanceRef.current) {
          if (firstFixRef.current) {
            mapInstanceRef.current.panTo(pos);
            mapInstanceRef.current.setZoom(16);
            firstFixRef.current = false;
          } else {
            mapInstanceRef.current.panTo(pos);
          }
        }

        if (polylineRef.current) {
          polylineRef.current.getPath().push(new google.maps.LatLng(pos.lat, pos.lng));
        }

        const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
        setTrail(prev => {
          const next = [...prev, { time, coords: `${data.lat!.toFixed(5)}, ${data.lng!.toFixed(5)}` }];
          return next.slice(-40);
        });
      } catch {
        setServerStatus("error");
        setGpsStatus("error");
      }
    };

    fetchLocation();
    const id = setInterval(fetchLocation, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (trailLogRef.current) trailLogRef.current.scrollTop = trailLogRef.current.scrollHeight;
  }, [trail]);

  // Satellite icons
  const satIcons = Array.from({ length: 12 }, (_, i) => i < gpsData.satellites);

  const statusDotStyle = (status: "ok" | "waiting" | "error"): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
    background: status === "ok" ? "#00ff9d" : status === "waiting" ? "#ff6b35" : "#ff3b5c",
    boxShadow: status === "ok" ? "0 0 8px #00ff9d" : status === "waiting" ? "0 0 8px #ff6b35" : "0 0 8px #ff3b5c",
    animation: status === "waiting" ? "gps-blink 1s infinite" : "none",
  });

  const signalActive = serverStatus === "ok";

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`}
        strategy="afterInteractive"
        onLoad={() => setMapsLoaded(true)}
      />

      <div style={{
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
        color: "#c8dff0",
        height: "calc(100vh - 52px)",
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        overflow: "hidden",
      }}>

        {/* SIDEBAR */}
        <aside style={{
          background: "#0b1220",
          borderRight: "1px solid #1a2d4a",
          padding: "14px 12px",
          display: "flex", flexDirection: "column", gap: 10,
          overflowY: "auto",
        }}>
          {/* Section: Position */}
          <SectionLabel>Position</SectionLabel>

          <CoordCard accent="#00d4ff" label="Latitude"
            value={gpsData.lat !== null ? gpsData.lat.toFixed(6) : "—"} suffix="°N" />
          <CoordCard accent="#00ff9d" label="Longitude"
            value={gpsData.lng !== null ? gpsData.lng.toFixed(6) : "—"} suffix="°E" />

          {/* Section: Telemetry */}
          <SectionLabel>Telemetry</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatBox label="Speed" value={gpsData.lat ? `${gpsData.speed.toFixed(1)} km/h` : "—"} color="#ff6b35" />
            <StatBox label="Altitude" value={gpsData.lat ? `${gpsData.altitude.toFixed(0)} m` : "—"} color="#00d4ff" />
          </div>

          {/* Satellites */}
          <div style={{
            background: "#060a10", border: "1px solid #1a2d4a",
            borderRadius: 8, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div>
              <div style={{ fontSize: "0.6rem", letterSpacing: "0.18em", color: "#3a5570", textTransform: "uppercase", marginBottom: 6 }}>Satellites</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {satIcons.map((active, i) => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: active ? "#00ff9d" : "#1a2d4a",
                    boxShadow: active ? "0 0 5px #00ff9d" : "none",
                    transition: "background 0.4s",
                  }} />
                ))}
              </div>
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: "0.65rem", color: "#3a5570", marginLeft: "auto" }}>
              {gpsData.satellites} / 12
            </div>
          </div>

          {/* Section: System */}
          <SectionLabel>System</SectionLabel>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            background: "#060a10", border: "1px solid #1a2d4a", borderRadius: 8,
            fontSize: "0.78rem", letterSpacing: "0.05em",
          }}>
            <div style={statusDotStyle(gpsStatus)} />
            <span>{gpsStatus === "ok" ? "GPS fix acquired ✓" : gpsStatus === "waiting" ? "Waiting for GPS fix..." : "GPS error"}</span>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            background: "#060a10", border: "1px solid #1a2d4a", borderRadius: 8,
            fontSize: "0.78rem", letterSpacing: "0.05em",
          }}>
            <div style={statusDotStyle(serverStatus === "connecting" ? "waiting" : serverStatus)} />
            <span>{serverStatus === "ok" ? "Server connected ✓" : serverStatus === "connecting" ? "Connecting to server..." : "Server unreachable"}</span>
          </div>

          {/* Section: Trail Log */}
          <SectionLabel>Trail Log</SectionLabel>

          <div ref={trailLogRef} style={{
            flex: 1, background: "#060a10", border: "1px solid #1a2d4a",
            borderRadius: 8, overflowY: "auto",
            padding: 8, minHeight: 80, maxHeight: 200,
          }}>
            {trail.length === 0 && (
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: "0.6rem", color: "#3a5570", padding: "4px 6px" }}>
                Waiting for data...
              </div>
            )}
            {trail.map((entry, i) => (
              <div key={i} style={{
                fontFamily: "'Courier New', monospace", fontSize: "0.6rem",
                color: i === trail.length - 1 ? "#c8dff0" : "#3a5570",
                padding: "4px 6px",
                borderBottom: i < trail.length - 1 ? "1px solid rgba(26,45,74,0.5)" : "none",
                display: "flex", justifyContent: "space-between", gap: 8,
              }}>
                <span style={{ color: "#00d4ff", flexShrink: 0 }}>{entry.time}</span>
                <span>{entry.coords}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAP */}
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {/* Header bar inside map area */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
            background: "#0b1220", borderBottom: "1px solid #1a2d4a",
            display: "flex", alignItems: "center", padding: "0 16px",
            height: 44, gap: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28,
                border: "2px solid #00d4ff", borderRadius: 6,
                display: "grid", placeItems: "center",
                boxShadow: "0 0 18px rgba(0,212,255,0.35)",
                animation: "gps-border-pulse 3s infinite",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#00d4ff">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.12em", color: "#fff", textTransform: "uppercase" }}>GPS Tracker</div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: "0.55rem", color: "#3a5570", letterSpacing: "0.2em" }}>ESP32 · LIVE TELEMETRY</div>
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
              {/* Signal bars */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 18 }}>
                {[5, 9, 13, 18].map((h, i) => (
                  <span key={i} style={{
                    width: 4, height: h, borderRadius: 2,
                    background: signalActive && i < 3 ? "#00ff9d" : "#3a5570",
                    transition: "background 0.4s",
                  }} />
                ))}
              </div>
              {/* LIVE badge */}
              <div style={{
                fontFamily: "'Courier New', monospace",
                fontSize: "0.65rem", letterSpacing: "0.15em", color: "#00ff9d",
                background: "rgba(0,255,157,0.08)", border: "1px solid rgba(0,255,157,0.25)",
                padding: "4px 10px", borderRadius: 4,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff9d", animation: "gps-blink 1.2s infinite" }} />
                LIVE
              </div>
              {/* Clock */}
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: "0.75rem", color: "#3a5570", letterSpacing: "0.1em" }}>
                {clock}
              </div>
            </div>
          </div>

          {/* Map container */}
          <div ref={mapRef} style={{ width: "100%", height: "100%", paddingTop: 44 }}>
            {!mapsLoaded && (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#060a10", color: "#3a5570",
                fontFamily: "'Courier New', monospace", fontSize: "0.8rem",
              }}>
                Loading Google Maps...
              </div>
            )}
          </div>

          {/* Corner decorations */}
          {["tl", "tr", "bl", "br"].map(pos => {
            const s: React.CSSProperties = {
              position: "absolute", width: 20, height: 20, zIndex: 2, pointerEvents: "none",
            };
            if (pos.includes("t")) { s.top = 56; } else { s.bottom = 12; }
            if (pos.includes("l")) { s.left = 12; } else { s.right = 12; }
            if (pos.includes("t")) { s.borderTop = "2px solid #00d4ff"; }
            if (pos.includes("b")) { s.borderBottom = "2px solid #00d4ff"; }
            if (pos.includes("l")) { s.borderLeft = "2px solid #00d4ff"; }
            if (pos.includes("r")) { s.borderRight = "2px solid #00d4ff"; }
            return <div key={pos} style={s} />;
          })}

          {/* Coords overlay */}
          <div style={{
            position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
            background: "rgba(6,10,16,0.88)", border: "1px solid #1a2d4a", borderRadius: 6,
            padding: "8px 18px",
            fontFamily: "'Courier New', monospace", fontSize: "0.75rem", color: "#00d4ff",
            letterSpacing: "0.08em", zIndex: 5, pointerEvents: "none",
            backdropFilter: "blur(6px)", whiteSpace: "nowrap",
          }}>
            {gpsData.lat !== null && gpsData.lng !== null
              ? `📡  ${gpsData.lat.toFixed(6)}° N    ${gpsData.lng.toFixed(6)}° E`
              : "📡 Awaiting coordinates..."}
          </div>
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      fontSize: "0.6rem", letterSpacing: "0.25em", color: "#3a5570",
      textTransform: "uppercase", paddingBottom: 8,
      borderBottom: "1px solid #1a2d4a",
    }}>
      {children}
    </div>
  );
}

function CoordCard({ accent, label, value, suffix }: { accent: string; label: string; value: string; suffix: string }) {
  return (
    <div style={{
      background: "#060a10", border: "1px solid #1a2d4a",
      borderRadius: 8, padding: "12px 14px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
      <div style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: "#3a5570", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: "1.15rem", color: "#fff", letterSpacing: "0.05em" }}>
        {value}<span style={{ fontSize: "0.7rem", color: accent, marginLeft: 4 }}>{suffix}</span>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: "#060a10", border: "1px solid #1a2d4a",
      borderRadius: 8, padding: "10px 12px", textAlign: "center",
    }}>
      <div style={{ fontSize: "0.6rem", letterSpacing: "0.18em", color: "#3a5570", textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: "1rem", color, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
