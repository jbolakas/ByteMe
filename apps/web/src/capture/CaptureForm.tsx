import { useEffect, useState } from "react";
import { db, SCHEMA_VERSION, type QueuedObservation } from "../db/schema";
import { getFix } from "./geolocation";
import { fileToBase64, getSpeechRecognition } from "./media";
import { annotatePhoto } from "../api/client";
import { flushNow } from "../sync/worker";

interface Props {
  userId: string;
}

export function CaptureForm({ userId }: Props) {
  const [notes, setNotes] = useState("");
  const [voice, setVoice] = useState("");
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    setStatus("");
  }, [notes, voice, photoB64]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setPhotoB64(b64);
    setAnnotation(null);
  }

  async function onAnnotate() {
    if (!photoB64) return;
    setAnnotating(true);
    try {
      const text = await annotatePhoto(photoB64);
      setAnnotation(text);
    } catch (err) {
      setStatus(`annotate failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setAnnotating(false);
    }
  }

  function onVoice() {
    const rec = getSpeechRecognition();
    if (!rec) {
      setStatus("voice not supported on this device");
      return;
    }
    setRecording(true);
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      setVoice((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    rec.start();
  }

  async function onSave() {
    setSaving(true);
    try {
      const fix = await getFix();
      const row: QueuedObservation = {
        client_id: crypto.randomUUID(),
        user_id: userId,
        captured_at: new Date().toISOString(),
        lat: fix.lat,
        lon: fix.lon,
        accuracy_m: fix.accuracy_m,
        notes: notes.trim() || null,
        voice_transcript: voice.trim() || null,
        photo_b64: photoB64,
        photo_annotation: annotation,
        schema_version: SCHEMA_VERSION,
        status: "pending",
        attempts: 0,
        next_attempt_at: Date.now(),
        last_error: null,
        server_id: null,
        created_at: Date.now(),
      };
      await db.observations.add(row);
      setNotes("");
      setVoice("");
      setPhotoB64(null);
      setAnnotation(null);
      setStatus("queued locally");
      void flushNow();
    } finally {
      setSaving(false);
    }
  }

  const canSave = !saving && (notes.trim() || voice.trim() || photoB64);

  return (
    <section style={styles.card}>
      <h2 style={styles.h2}>New observation</h2>

      <label style={styles.label}>Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        style={styles.textarea}
        placeholder="What did you see?"
      />

      <div style={styles.row}>
        <button onClick={onVoice} disabled={recording} style={styles.btn}>
          {recording ? "Listening…" : "🎙 Voice note"}
        </button>
        {voice && <span style={styles.muted}>“{voice}”</span>}
      </div>

      <label style={styles.label}>Photo</label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhoto}
        style={styles.file}
      />
      {photoB64 && (
        <div style={styles.row}>
          <img
            src={`data:image/jpeg;base64,${photoB64}`}
            alt="capture"
            style={styles.thumb}
          />
          <button onClick={onAnnotate} disabled={annotating} style={styles.btn}>
            {annotating ? "Annotating…" : "🤖 Annotate with Claude"}
          </button>
        </div>
      )}
      {annotation && <p style={styles.muted}>{annotation}</p>}

      <button
        onClick={onSave}
        disabled={!canSave}
        style={{ ...styles.btn, ...styles.primary }}
      >
        {saving ? "Saving…" : "Save observation"}
      </button>

      {status && <p style={styles.muted}>{status}</p>}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#0f172a",
    color: "#e2e8f0",
    padding: 16,
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: 480,
    margin: "0 auto",
  },
  h2: { margin: 0, fontSize: 18 },
  label: { fontSize: 12, color: "#94a3b8", marginTop: 6 },
  textarea: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
  },
  file: { color: "#e2e8f0" },
  row: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  btn: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    cursor: "pointer",
  },
  primary: { background: "#2563eb", borderColor: "#2563eb", color: "white" },
  thumb: { width: 96, height: 96, objectFit: "cover", borderRadius: 8 },
  muted: { color: "#94a3b8", fontSize: 13, margin: 0 },
};
