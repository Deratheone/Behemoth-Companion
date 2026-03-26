import { useState, useEffect, useRef, useCallback } from "react";
import { connectMQTT, onMQTTStatus, type MQTTStatus } from "../utils/mqtt";

const COLS = 12;
const ROWS = 14;

type CellValue = "good" | "bad" | null;
type Direction = "up" | "down";
type LogType = "info" | "good" | "bad" | "warn";

interface LogEntry {
  msg: string;
  type: LogType;
  time: string;
}

function createEmptyGrid(): CellValue[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function getNextPosition(row: number, col: number, direction: Direction, rows: number) {
  const nextRow = direction === "up" ? row - 1 : row + 1;
  if (nextRow < 0 || nextRow >= rows) return null;
  return { row: nextRow, col };
}

export default function FieldMapper() {
  const [grid, setGrid] = useState<CellValue[][]>(createEmptyGrid());
  const [currentCol, setCurrentCol] = useState(0);
  const [currentRow, setCurrentRow] = useState(ROWS - 1);
  const [direction, setDirection] = useState<Direction>("up");
  const [stats, setStats] = useState({ total: 0, good: 0, bad: 0 });
  const [mqttStatus, setMqttStatus] = useState<MQTTStatus>("disconnected");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [fieldName, setFieldName] = useState("Field A-01");
  const [colFull, setColFull] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string, type: LogType = "info") => {
    const time = new Date().toLocaleTimeString("en-IN", { hour12: false });
    setLog(prev => [...prev.slice(-49), { msg, type, time }]);
  }, []);

  // Mobile detection
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const plantCrop = useCallback(() => {
    const quality: CellValue = Math.random() > 0.3 ? "good" : "bad";

    setGrid(prev => {
      const next = prev.map(r => [...r]);
      if (next[currentRow][currentCol] !== null) return prev;
      next[currentRow][currentCol] = quality;
      return next;
    });

    setStats(prev => ({
      total: prev.total + 1,
      good: prev.good + (quality === "good" ? 1 : 0),
      bad: prev.bad + (quality === "bad" ? 1 : 0),
    }));
    addLog(`Plant at col ${currentCol + 1}, row ${ROWS - currentRow} → ${quality!.toUpperCase()}`, quality === "good" ? "good" : "bad");

    const next = getNextPosition(currentRow, currentCol, direction, ROWS);
    if (next) {
      setCurrentRow(next.row);
      setColFull(false);
    } else {
      setColFull(true);
      addLog(`Column ${currentCol + 1} is full. Trigger Sensor 2 to advance.`, "warn");
    }
  }, [currentRow, currentCol, direction, addLog]);

  const nextColumn = useCallback(() => {
    const nextCol = currentCol + 1;
    if (nextCol >= COLS) {
      addLog("All columns filled! Field complete.", "warn");
      return;
    }
    const newDirection: Direction = direction === "up" ? "down" : "up";
    setCurrentCol(nextCol);
    setDirection(newDirection);
    setColFull(false);
    addLog(`→ Column ${nextCol + 1} | Direction: ${newDirection === "up" ? "S→N" : "N→S"}`, "info");
  }, [currentCol, direction, addLog]);

  const plantCropRef = useRef(plantCrop);
  const nextColumnRef = useRef(nextColumn);
  useEffect(() => { plantCropRef.current = plantCrop; }, [plantCrop]);
  useEffect(() => { nextColumnRef.current = nextColumn; }, [nextColumn]);

  // MQTT subscription — builds grid from ESP32 sensor data
  useEffect(() => {
    let prevPlantCount = 0;

    const cleanupData = connectMQTT((data) => {
      const { field, health } = data;

      // Build detection map: "row,col" → "good" | "bad"
      const detectMap: Record<string, CellValue> = {};
      health.detections.forEach(d => {
        detectMap[`${d.row},${d.col}`] = d.status === "healthy" ? "good" : "bad";
      });

      // Rebuild full grid
      const newGrid = createEmptyGrid();
      field.plants.forEach(p => {
        if (p.row >= 0 && p.row < ROWS && p.col >= 0 && p.col < COLS) {
          newGrid[p.row][p.col] = detectMap[`${p.row},${p.col}`] ?? "good";
        }
      });
      setGrid(newGrid);
      setCurrentRow(field.currentRow < ROWS ? field.currentRow : ROWS - 1);
      setCurrentCol(field.currentCol < COLS ? field.currentCol : 0);

      // Log newly added plants
      if (field.plants.length > prevPlantCount) {
        field.plants.slice(prevPlantCount).forEach(p => {
          const quality = detectMap[`${p.row},${p.col}`] ?? "good";
          addLog(`Plant at col ${p.col + 1}, row ${p.row + 1} → ${quality.toUpperCase()}`, quality === "good" ? "good" : "bad");
        });
        prevPlantCount = field.plants.length;
      }

      // Update stats
      const good = field.plants.filter(p => (detectMap[`${p.row},${p.col}`] ?? "good") === "good").length;
      setStats({ total: field.plants.length, good, bad: field.plants.length - good });
    });

    const cleanupStatus = onMQTTStatus((s) => {
      setMqttStatus(s);
      if (s === "connected") addLog("ESP32 connected via MQTT ✓", "good");
      if (s === "disconnected") addLog("MQTT disconnected — waiting...", "warn");
    });

    return () => { cleanupData(); cleanupStatus(); };
  }, [addLog]);

  const resetField = () => {
    setGrid(createEmptyGrid());
    setCurrentCol(0);
    setCurrentRow(ROWS - 1);
    setDirection("up");
    setStats({ total: 0, good: 0, bad: 0 });
    setColFull(false);
    addLog("Field reset.", "warn");
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const goodPct = stats.total > 0 ? Math.round((stats.good / stats.total) * 100) : 0;
  const filledCells = stats.total;
  const totalCells = ROWS * COLS;
  const CELL = isMobile ? 24 : 32;
  const LABEL_W = isMobile ? 20 : 24;

  const statusColor: Record<MQTTStatus, string> = {
    connected:    "#22c55e",
    connecting:   "#f59e0b",
    disconnected: "#6b7280",
    error:        "#ef4444",
  };

  const statusLabel: Record<MQTTStatus, string> = {
    connected:    "CONNECTED",
    connecting:   "CONNECTING...",
    disconnected: "DISCONNECTED",
    error:        "ERROR",
  };

  return (
    <div style={{
      color: "#e2e8d5",
      fontFamily: "'Courier New', 'Lucida Console', monospace",
      padding: isMobile ? "10px" : "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #2d4a33", paddingBottom: "10px", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, border: "2px solid #4ade80", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, padding: 4 }}>
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{ background: i % 3 === 0 ? "#4ade80" : "#2d4a33", borderRadius: 1 }} />
            ))}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: "bold", color: "#4ade80", letterSpacing: 2 }}>FIELDMAP ESP32</div>
            <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: 3 }}>AGRICULTURAL GRID SYSTEM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "12px" : "24px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: 2 }}>FIELD ID</div>
            <input
              value={fieldName}
              onChange={e => setFieldName(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#a3e635", fontSize: 13, fontFamily: "inherit", fontWeight: "bold", textAlign: "right", outline: "none", width: 100 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor[mqttStatus], boxShadow: mqttStatus === "connected" ? `0 0 8px ${statusColor[mqttStatus]}` : "none", animation: mqttStatus === "connecting" ? "fieldmap-pulse 1s infinite" : "none" }} />
            <span style={{ fontSize: 11, color: statusColor[mqttStatus], letterSpacing: 2 }}>{statusLabel[mqttStatus]}</span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: "12px", flex: 1, flexWrap: "wrap" }}>

        {/* Left panel: grid */}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 8, minWidth: 0, overflowX: isMobile ? "auto" : undefined }}>
          {/* Grid header labels */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: LABEL_W + 4 }}>
            {Array.from({ length: COLS }, (_, c) => (
              <div key={c} style={{
                width: CELL, height: 16, textAlign: "center", fontSize: 9, color: c === currentCol ? "#4ade80" : "#6b7280",
                fontWeight: c === currentCol ? "bold" : "normal",
                borderBottom: c === currentCol ? "2px solid #4ade80" : "2px solid transparent",
              }}>{c + 1}</div>
            ))}
          </div>

          {/* Grid rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Array.from({ length: ROWS }, (_, r) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: LABEL_W, textAlign: "right", fontSize: 9, color: "#6b7280", marginRight: 4 }}>
                  {ROWS - r}
                </div>
                {Array.from({ length: COLS }, (_, c) => {
                  const val = grid[r][c];
                  const isCurrent = r === currentRow && c === currentCol;
                  const isActiveCol = c === currentCol;
                  return (
                    <div key={c} style={{
                      width: CELL,
                      height: CELL,
                      border: isCurrent
                        ? "2px solid #facc15"
                        : isActiveCol
                          ? "1px solid #2d6b3f"
                          : "1px solid #1a2e1e",
                      borderRadius: 3,
                      background: isCurrent ? "#1a3322" : isActiveCol ? "#112818" : "#0d1a12",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                      position: "relative",
                    }}>
                      {val && (
                        <div style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: val === "good" ? "#22c55e" : "#ef4444",
                          boxShadow: val === "good" ? "0 0 6px #22c55e88" : "0 0 6px #ef444488",
                          animation: "fieldmap-popIn 0.2s ease-out",
                        }} />
                      )}
                      {isCurrent && !val && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#facc1566", animation: "fieldmap-blink 1s infinite" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Direction indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, paddingLeft: LABEL_W + 4 }}>
            <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: 1 }}>
              COL {currentCol + 1} · {direction === "up" ? "↑ S→N" : "↓ N→S"} · ROW {ROWS - currentRow}
            </div>
            {colFull && <div style={{ fontSize: 10, color: "#f59e0b", letterSpacing: 1 }}>⚠ COL FULL — TRIGGER SENSOR 2</div>}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: isMobile ? 0 : 220, maxWidth: isMobile ? "100%" : 280, width: isMobile ? "100%" : undefined }}>

          {/* Stats */}
          <div style={{ border: "1px solid #2d4a33", borderRadius: 6, padding: "12px 14px", background: "#0f1f14" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>STATISTICS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "TOTAL", val: stats.total, color: "#a3e635" },
                { label: "GOOD", val: stats.good, color: "#22c55e" },
                { label: "BAD", val: stats.bad, color: "#ef4444" },
                { label: "YIELD %", val: `${goodPct}%`, color: goodPct > 70 ? "#22c55e" : goodPct > 40 ? "#f59e0b" : "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "#162a1c", borderRadius: 4, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: "bold", color: s.color, lineHeight: 1.2 }}>{s.val}</div>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9ca3af", marginBottom: 4 }}>
                <span>FIELD COVERAGE</span>
                <span>{Math.round((filledCells / totalCells) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: "#162a1c", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(filledCells / totalCells) * 100}%`, background: "linear-gradient(90deg, #22c55e, #a3e635)", borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>
            {/* Good/Bad split bar */}
            {stats.total > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9ca3af", marginBottom: 4 }}>
                  <span style={{ color: "#22c55e" }}>● GOOD {goodPct}%</span>
                  <span style={{ color: "#ef4444" }}>● BAD {100 - goodPct}%</span>
                </div>
                <div style={{ height: 6, background: "#7f1d1d", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${goodPct}%`, background: "#22c55e", borderRadius: 3, transition: "width 0.3s" }} />
                </div>
              </div>
            )}
          </div>

          {/* Manual Controls */}
          <div style={{ border: "1px solid #2d4a33", borderRadius: 6, padding: "12px 14px", background: "#0f1f14" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>MANUAL OVERRIDE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={plantCrop} style={{
                background: "transparent", border: "1px solid #22c55e", color: "#22c55e", padding: "10px 0",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2,
                transition: "all 0.15s",
              }}
                onMouseOver={e => { (e.target as HTMLButtonElement).style.background = "#22c55e22"; }}
                onMouseOut={e => { (e.target as HTMLButtonElement).style.background = "transparent"; }}>
                ▶ SENSOR 1 — PLANT
              </button>
              <button onClick={nextColumn} style={{
                background: "transparent", border: "1px solid #60a5fa", color: "#60a5fa", padding: "10px 0",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2,
                transition: "all 0.15s",
              }}
                onMouseOver={e => { (e.target as HTMLButtonElement).style.background = "#60a5fa22"; }}
                onMouseOut={e => { (e.target as HTMLButtonElement).style.background = "transparent"; }}>
                ▶ SENSOR 2 — NEXT COL
              </button>
              <button onClick={resetField} style={{
                background: "transparent", border: "1px solid #374151", color: "#6b7280", padding: "8px 0",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 2,
                transition: "all 0.15s",
              }}
                onMouseOver={e => { (e.target as HTMLButtonElement).style.background = "#37415122"; }}
                onMouseOut={e => { (e.target as HTMLButtonElement).style.background = "transparent"; }}>
                ↺ RESET FIELD
              </button>
            </div>
          </div>

          {/* MQTT connection status */}
          <div style={{ border: "1px solid #2d4a33", borderRadius: 6, padding: "12px 14px", background: "#0f1f14" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>ESP32 CONNECTION</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor[mqttStatus], boxShadow: mqttStatus === "connected" ? `0 0 8px ${statusColor[mqttStatus]}` : "none" }} />
              <span style={{ fontSize: 11, color: statusColor[mqttStatus], letterSpacing: 2 }}>{statusLabel[mqttStatus]}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 9, color: "#6b7280", lineHeight: 1.6 }}>
              MQTT → broker.hivemq.com<br />
              Topic: <span style={{ color: "#9ca3af" }}>behemoth/v1/sensor/data</span><br />
              Auto-reconnects every 3s
            </div>
          </div>

          {/* Legend */}
          <div style={{ border: "1px solid #2d4a33", borderRadius: 6, padding: "10px 14px", background: "#0f1f14" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 8 }}>LEGEND</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { color: "#22c55e", shadow: "#22c55e88", label: "GOOD CROP" },
                { color: "#ef4444", shadow: "#ef444488", label: "BAD CROP" },
                { color: "#facc15", shadow: "#facc1588", label: "CURSOR (NEXT PLANT)" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: l.color, boxShadow: `0 0 5px ${l.shadow}` }} />
                  <span style={{ fontSize: 10, color: "#d1d5db", letterSpacing: 1 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div style={{ border: "1px solid #2d4a33", borderRadius: 6, padding: "10px 14px", background: "#0f1f14", maxHeight: 120, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 6 }}>ACTIVITY LOG</div>
        <div ref={logRef} style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {log.length === 0 && <div style={{ fontSize: 10, color: "#6b7280" }}>No activity yet. Use manual controls or connect ESP32.</div>}
          {log.map((l, i) => (
            <div key={i} style={{ fontSize: 10, display: "flex", gap: 10, color: ({ good: "#22c55e", bad: "#ef4444", warn: "#f59e0b", info: "#6b7280" } as Record<LogType, string>)[l.type] }}>
              <span style={{ color: "#6b7280", flexShrink: 0 }}>{l.time}</span>
              <span>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
