"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type AppStatus = "idle" | "recording" | "processing" | "done";
type Priority = "urgent" | "high" | "medium" | "low";

type Recording = {
  id: string;
  title: string;
  duration: string;
  date: string;
  active?: boolean;
};

type Issue = {
  id: string;
  title: string;
  priority: Priority;
  sent?: boolean;
};

const MOCK_RECORDINGS: Recording[] = [
  { id: "1", title: "Product standup", duration: "12:34", date: "Idag, 09:15" },
  { id: "2", title: "Design review", duration: "45:12", date: "Igår, 14:30" },
  { id: "3", title: "Sprint planning", duration: "1:02:08", date: "Mån, 10:00" },
];

const MOCK_ISSUES: Issue[] = [
  { id: "1", title: "Fix login redirect after session expires", priority: "urgent", sent: true },
  { id: "2", title: "Add keyboard shortcut for recording", priority: "high" },
  { id: "3", title: "Update onboarding copy in step 3", priority: "medium" },
  { id: "4", title: "Cleanup legacy auth middleware", priority: "low" },
];

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: "#FF3B30",
  high: "#FF9500",
  medium: "#FFD60A",
  low: "#3A3A3A",
};

const WAVEFORM_DELAYS = [0, 0.1, 0.2, 0.05, 0.15, 0.25, 0.08, 0.18, 0.03, 0.13, 0.22, 0.07];
const WAVEFORM_DURATIONS = [0.55, 0.7, 0.5, 0.65, 0.6, 0.75, 0.58, 0.68, 0.52, 0.72, 0.62, 0.57];

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function Home() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [processingLabel, setProcessingLabel] = useState("Transkriberar");
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecording = useCallback(() => {
    setStatus("recording");
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("processing");
    setProcessingLabel("Transkriberar");
    processingRef.current = setTimeout(() => {
      setProcessingLabel("Genererar issues");
      processingRef.current = setTimeout(() => setStatus("done"), 2000);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (processingRef.current) clearTimeout(processingRef.current);
    };
  }, []);

  return (
    <div
      className="flex h-full"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Left panel: Recordings ─────────────────────── */}
      <aside
        className="flex flex-col w-60 shrink-0"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        <PanelHeader label="Recordings" count={MOCK_RECORDINGS.length} />
        <div className="flex-1 overflow-y-auto py-1">
          {MOCK_RECORDINGS.map((rec) => (
            <button
              key={rec.id}
              onClick={() => setSelectedRecording(rec.id === selectedRecording ? null : rec.id)}
              className="w-full text-left px-4 py-2.5 transition-colors"
              style={{
                background: selectedRecording === rec.id ? "var(--bg-surface)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (selectedRecording !== rec.id)
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (selectedRecording !== rec.id)
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm truncate"
                  style={{
                    color: selectedRecording === rec.id ? "var(--text-primary)" : "#909090",
                    fontWeight: selectedRecording === rec.id ? 500 : 400,
                  }}
                >
                  {rec.title}
                </span>
                <span
                  className="text-xs shrink-0 font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  {rec.duration}
                </span>
              </div>
              <span className="text-xs mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                {rec.date}
              </span>
            </button>
          ))}
        </div>

        {/* New recording shortcut */}
        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            <kbd
              className="inline-flex items-center px-1 rounded text-xs font-mono"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                background: "var(--bg-surface)",
              }}
            >
              ⌘R
            </kbd>{" "}
            <span style={{ color: "#2a2a2a" }}>ny inspelning</span>
          </span>
        </div>
      </aside>

      {/* ── Center panel: Record ────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center relative select-none">
        {/* Wordmark */}
        <div className="absolute top-6 inset-x-0 flex justify-center">
          <span
            className="text-xs font-mono tracking-[0.25em] uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "0.22em" }}
          >
            Tarantula
          </span>
        </div>

        <div className="flex flex-col items-center gap-7">
          {/* Sonar ring container */}
          <div className="relative flex items-center justify-center">
            {status === "recording" && (
              <>
                <div
                  className="absolute rounded-full border animate-sonar-outer"
                  style={{
                    width: 112,
                    height: 112,
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                />
                <div
                  className="absolute rounded-full border animate-sonar-mid"
                  style={{
                    width: 112,
                    height: 112,
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                />
                <div
                  className="absolute rounded-full border animate-sonar-inner"
                  style={{
                    width: 112,
                    height: 112,
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                />
              </>
            )}

            {/* Button */}
            <button
              onClick={
                status === "idle"
                  ? startRecording
                  : status === "recording"
                    ? stopRecording
                    : undefined
              }
              disabled={status === "processing" || status === "done"}
              className="relative flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                width: 112,
                height: 112,
                background:
                  status === "recording" ? "var(--bg-surface)" : "var(--bg-panel)",
                border: `1px solid ${status === "recording" ? "#2a2a2a" : "var(--border)"}`,
                cursor:
                  status === "processing" || status === "done" ? "default" : "pointer",
                boxShadow:
                  status === "recording"
                    ? "0 0 0 1px rgba(255,255,255,0.04) inset"
                    : "none",
              }}
              onMouseEnter={(e) => {
                if (status === "idle" || status === "recording") {
                  (e.currentTarget as HTMLElement).style.borderColor = "#333";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  status === "recording" ? "#2a2a2a" : "var(--border)";
              }}
            >
              {status === "idle" && (
                <div
                  className="rounded-full transition-transform duration-200"
                  style={{ width: 18, height: 18, background: "var(--text-primary)" }}
                />
              )}
              {status === "recording" && (
                <div
                  className="rounded-sm"
                  style={{ width: 16, height: 16, background: "#FF3B30" }}
                />
              )}
              {status === "processing" && (
                <div
                  className="rounded-full animate-spin-slow"
                  style={{
                    width: 20,
                    height: 20,
                    border: "1.5px solid var(--border)",
                    borderTopColor: "var(--text-primary)",
                  }}
                />
              )}
              {status === "done" && (
                <svg
                  width="18"
                  height="14"
                  viewBox="0 0 18 14"
                  fill="none"
                  style={{ opacity: 0.9 }}
                >
                  <path
                    d="M1.5 7L6.5 12L16.5 2"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Waveform bars — visible only during recording */}
          <div
            className="flex items-center justify-center gap-px"
            style={{ height: 20, opacity: status === "recording" ? 1 : 0, transition: "opacity 0.4s" }}
          >
            {WAVEFORM_DELAYS.map((delay, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: "100%",
                  background: "rgba(255,255,255,0.22)",
                  borderRadius: 1,
                  transformOrigin: "center",
                  animation:
                    status === "recording"
                      ? `bar-wave ${WAVEFORM_DURATIONS[i]}s ease-in-out infinite ${delay}s`
                      : "none",
                }}
              />
            ))}
          </div>

          {/* Timer */}
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: 28,
              letterSpacing: "0.04em",
              color:
                status === "recording"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              transition: "color 0.3s",
              lineHeight: 1,
            }}
          >
            {formatTime(elapsed)}
          </span>

          {/* Status label */}
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--text-muted)", letterSpacing: "0.18em" }}
          >
            {status === "idle" && "Klicka för att spela in"}
            {status === "recording" && "Spelar in"}
            {status === "processing" && processingLabel}
            {status === "done" && "Issues skapade"}
          </span>
        </div>
      </main>

      {/* ── Right panel: Issues ─────────────────────────── */}
      <aside
        className="flex flex-col w-72 shrink-0"
        style={{ borderLeft: "1px solid var(--border)" }}
      >
        <PanelHeader label="Issues" count={MOCK_ISSUES.filter((i) => i.sent).length} countLabel="skickade" />

        <div className="flex-1 overflow-y-auto py-1">
          {MOCK_ISSUES.map((issue) => (
            <div
              key={issue.id}
              className="px-4 py-2.5 flex items-start gap-3 transition-colors cursor-pointer"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              {/* Priority dot */}
              <div className="mt-1.5 shrink-0">
                <div
                  className="rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: PRIORITY_DOT[issue.priority],
                  }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm leading-snug"
                  style={{
                    color: issue.sent ? "#606060" : "var(--text-primary)",
                    fontWeight: 400,
                  }}
                >
                  {issue.title}
                </p>
                {issue.sent && (
                  <span
                    className="text-xs mt-0.5 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Skickad till Linear
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Send button */}
        <div
          className="p-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            className="w-full py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-base)",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.opacity = "0.88")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.opacity = "1")
            }
          >
            Skicka till Linear
          </button>
        </div>
      </aside>
    </div>
  );
}

function PanelHeader({
  label,
  count,
  countLabel,
}: {
  label: string;
  count?: number;
  countLabel?: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3.5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="text-xs font-medium uppercase tracking-widest"
        style={{ color: "var(--text-secondary)", letterSpacing: "0.14em" }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          className="text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          {countLabel ? `${count} ${countLabel}` : count}
        </span>
      )}
    </div>
  );
}
