import { useEffect, useState } from "react";
import { CaptureForm } from "./capture/CaptureForm";
import { QueueStatus } from "./QueueStatus";
import { startSyncWorker } from "./sync/worker";

function getOrCreateUserId(): string {
  const k = "byteme.user_id";
  let id = localStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(k, id);
  }
  return id;
}

export default function App() {
  const [userId] = useState(getOrCreateUserId);

  useEffect(() => {
    startSyncWorker();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#020617" }}>
      <QueueStatus />
      <header style={{ padding: 16, color: "#e2e8f0" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>ByteMe Field Capture</h1>
        <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12 }}>
          user {userId.slice(0, 8)}…
        </p>
      </header>
      <main style={{ padding: 16 }}>
        <CaptureForm userId={userId} />
      </main>
    </div>
  );
}
