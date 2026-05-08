import { useEffect, useState } from "react";
import { db } from "./db/schema";
import { flushNow, onSyncChange, pendingCount } from "./sync/worker";

export function QueueStatus() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    void pendingCount().then(setPending);
    const off = onSyncChange((s) => {
      setPending(s.pending);
      setSyncing(s.syncing);
    });
    const observer = setInterval(async () => setPending(await pendingCount()), 3000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      off();
      clearInterval(observer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div style={styles.bar}>
      <span style={{ ...styles.dot, background: online ? "#22c55e" : "#ef4444" }} />
      <span>{online ? "online" : "offline"}</span>
      <span style={styles.sep}>•</span>
      <span>{pending} queued</span>
      {syncing && <span style={styles.sep}>· syncing…</span>}
      <button onClick={() => void flushNow()} style={styles.btn}>
        Sync now
      </button>
      <button
        onClick={async () => {
          if (confirm("Clear local queue?")) await db.observations.clear();
        }}
        style={styles.btn}
      >
        Clear
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#0b1220",
    color: "#cbd5e1",
    fontSize: 13,
    borderBottom: "1px solid #1e293b",
  },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  sep: { color: "#475569" },
  btn: {
    marginLeft: "auto",
    background: "transparent",
    color: "#cbd5e1",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    cursor: "pointer",
  },
};
