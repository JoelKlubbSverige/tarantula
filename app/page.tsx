"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Square,
  Upload,
  Disc,
  History,
  Settings,
  Search,
  Bell,
  ChevronDown,
  MonitorUp,
  Volume2,
  ArrowUpRight,
  Check,
} from "lucide-react";
import Image from "next/image";
import type { Session } from "@/lib/types";

type AppStatus = "idle" | "recording" | "processing" | "error";
type ProcessingStep = 0 | 1 | 2;

type CaptureSource = { screen: boolean; audio: boolean; mic: boolean };

const WAVEFORM_COUNT = 32;
const WAVEFORM_DELAYS = Array.from({ length: WAVEFORM_COUNT }, (_, i) =>
  ((i * 0.07) % 0.8).toFixed(2)
);
const WAVEFORM_DURATIONS = Array.from({ length: WAVEFORM_COUNT }, (_, i) =>
  (0.45 + ((i * 0.13) % 0.5)).toFixed(2)
);

const MOCK_SESSIONS: Session[] = [
  {
    id: "1",
    title: "App-sync · produkt & design",
    date: "2026-06-25T09:00:00",
    durationSec: 2520,
    transcript: [],
    issues: [
      { id: "i1", title: "Fix login redirect", description: "", priority: 2, labelIds: [], teamId: "", status: "sent" },
      { id: "i2", title: "Uppdatera onboarding-copy", description: "", priority: 3, labelIds: [], teamId: "", status: "draft" },
      { id: "i3", title: "Cleanup auth middleware", description: "", priority: 4, labelIds: [], teamId: "", status: "draft" },
      { id: "i4", title: "API rate limiting", description: "", priority: 1, labelIds: [], teamId: "", status: "draft" },
      { id: "i5", title: "Dark mode toggle saknas", description: "", priority: 3, labelIds: [], teamId: "", status: "draft" },
      { id: "i6", title: "Mobilanpassning dashboard", description: "", priority: 2, labelIds: [], teamId: "", status: "draft" },
    ],
  },
  {
    id: "2",
    title: "Support-genomgång",
    date: "2026-06-24T14:30:00",
    durationSec: 1680,
    transcript: [],
    issues: [
      { id: "i7", title: "Exportera CSV kraschar", description: "", priority: 1, labelIds: [], teamId: "", status: "sent" },
      { id: "i8", title: "Notiser levereras fel", description: "", priority: 3, labelIds: [], teamId: "", status: "draft" },
      { id: "i9", title: "Sökfilter sparas inte", description: "", priority: 3, labelIds: [], teamId: "", status: "sent" },
    ],
  },
  {
    id: "3",
    title: "Sprint-planering v26",
    date: "2026-06-23T10:00:00",
    durationSec: 3728,
    transcript: [],
    issues: [
      { id: "i10", title: "Refaktorera useAuth-hook", description: "", priority: 4, labelIds: [], teamId: "", status: "draft" },
      { id: "i11", title: "E2E-tester för checkout", description: "", priority: 2, labelIds: [], teamId: "", status: "sent" },
    ],
  },
];

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} tim ${m} min`;
  return `${m} min`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date("2026-06-26");
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Idag";
  if (diff === 1) return "Igår";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

function formatTimer(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<AppStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState<ProcessingStep>(0);
  const [capture, setCapture] = useState<CaptureSource>({ screen: true, audio: false, mic: true });
  const [activeNav, setActiveNav] = useState<"record" | "history" | "settings">("record");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const elapsedRef = useRef(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  function getSupportedMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const t of types) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    const streams: MediaStream[] = [];

    try {
      if (capture.mic) {
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streams.push(mic);
      }

      if (capture.screen || capture.audio) {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: capture.screen,
          audio: capture.audio,
        });
        streams.push(display);
      }

      if (streams.length === 0) return;

      // Combine all audio tracks
      const audioTracks = streams.flatMap((s) => s.getAudioTracks());
      let recordStream: MediaStream;

      if (audioTracks.length === 1) {
        recordStream = new MediaStream(audioTracks);
      } else {
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        for (const track of audioTracks) {
          ctx.createMediaStreamSource(new MediaStream([track])).connect(dest);
        }
        audioContextRef.current = ctx;
        recordStream = dest.stream;
      }

      streamsRef.current = streams;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);

      setStatus("recording");
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        setElapsed((e) => { elapsedRef.current = e + 1; return e + 1; });
      }, 1000);
    } catch (err) {
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      console.error("Failed to start recording:", err);
    }
  }, [capture]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const durationSec = elapsedRef.current;

    recorder.onstop = async () => {
      streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      audioContextRef.current?.close();

      setStatus("processing");
      setStep(0);
      setProcessingError(null);

      const mimeType = chunksRef.current[0]?.type || "audio/webm";
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });

      try {
        // Step 1 – Whisper
        const fd = new FormData();
        fd.append("audio", blob, `recording.${ext}`);
        const transcribeRes = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (!transcribeRes.ok) {
          const e = await transcribeRes.json().catch(() => ({}));
          throw new Error(e.error ?? "Transkribering misslyckades");
        }
        const { text, segments } = await transcribeRes.json();
        setStep(1);

        // Step 2 – GPT-4o
        const issuesRes = await fetch("/api/generate-issues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text }),
        });
        if (!issuesRes.ok) {
          const e = await issuesRes.json().catch(() => ({}));
          throw new Error(e.error ?? "Issue-generering misslyckades");
        }
        const { title, issues } = await issuesRes.json();
        setStep(2);

        const session = {
          id: String(Date.now()),
          title,
          date: new Date().toISOString(),
          durationSec,
          transcript: segments,
          issues,
        };
        sessionStorage.setItem("tarantula:session", JSON.stringify(session));

        setTimeout(() => router.push("/review"), 600);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Okänt fel";
        setProcessingError(msg);
        setStatus("error");
      }
    };

    recorder.stop();
  }, [router]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      audioContextRef.current?.close();
    };
  }, []);

  const isRecording = status === "recording";
  const isProcessing = status === "processing";

  return (
    <div className="flex h-full p-4" style={{ background: "var(--color-app-bg)" }}>
      {/* App-skal */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-frame)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* ── Sidofält ───────────────────────────────────── */}
        <Sidebar activeNav={activeNav} onNav={setActiveNav} />

        {/* ── Main ────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top-bar */}
          <Topbar
            status={status}
            capture={capture}
            onCapture={setCapture}
            onRecord={isRecording ? stopRecording : startRecording}
            isRecording={isRecording}
            isProcessing={isProcessing}
          />

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Hero-panel */}
            <HeroPanel
              status={status}
              elapsed={elapsed}
              step={step}
              capture={capture}
              onCapture={setCapture}
              onRecord={isRecording ? stopRecording : startRecording}
              onReset={() => setStatus("idle")}
              errorMessage={processingError}
            />

            {/* Sessions */}
            {status === "idle" && (
              <div className="mt-8">
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--color-text)", letterSpacing: "-0.01em" }}
                >
                  Senaste inspelningar
                </h2>

                {MOCK_SESSIONS.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="flex flex-col gap-3">
                    {MOCK_SESSIONS.map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onClick={() => router.push(`/review?session=${s.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sidofält ──────────────────────────────────────────────── */

function Sidebar({
  activeNav,
  onNav,
}: {
  activeNav: string;
  onNav: (n: "record" | "history" | "settings") => void;
}) {
  const NAV = [
    { id: "record" as const, label: "Spela in", Icon: Disc },
    { id: "history" as const, label: "Historik", Icon: History },
    { id: "settings" as const, label: "Inställningar", Icon: Settings },
  ];

  return (
    <aside
      className="flex flex-col w-66 shrink-0 p-5"
      style={{
        borderRight: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Image src="/Tarantula.png" alt="Tarantula" width={32} height={32} className="shrink-0" />
        <span
          className="font-bold text-base"
          style={{ color: "var(--color-primary)", letterSpacing: "-0.01em" }}
        >
          Tarantula
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map(({ id, label, Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-input text-left transition-colors duration-100 w-full text-sm font-medium"
              style={{
                background: active ? "var(--color-primary-soft)" : "transparent",
                color: active ? "var(--color-text)" : "var(--color-text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--color-surface-inset)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                style={{ color: active ? "var(--color-primary)" : "var(--color-text-secondary)" }}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Usage-kort */}
      <div
        className="p-3 rounded-input"
        style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border)" }}
      >
        <p
          className="text-xs font-semibold mb-2"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Transkriberat
        </p>
        <div
          className="w-full h-1.5 rounded-full mb-1.5 overflow-hidden"
          style={{ background: "var(--color-border)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: "30%",
              background: "var(--color-primary)",
            }}
          />
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          300 / 1 000 min denna månad
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
          Återställs om 5 dagar
        </p>
      </div>
    </aside>
  );
}

/* ── Top-bar ────────────────────────────────────────────────── */

function Topbar({
  status,
  isRecording,
  isProcessing,
  onRecord,
}: {
  status: AppStatus;
  capture: CaptureSource;
  onCapture: (c: CaptureSource) => void;
  onRecord: () => void;
  isRecording: boolean;
  isProcessing: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-6 h-18 shrink-0"
      style={{
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {/* Bell */}
      <button
        className="relative p-2 rounded-input transition-colors"
        style={{ color: "var(--color-text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        aria-label="Notiser"
      >
        <Bell size={18} strokeWidth={1.75} />
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
          style={{ background: "var(--color-danger)" }}
        />
      </button>

      {/* Sökfält */}
      <div
        className="flex-1 flex items-center gap-2 px-4 h-11 rounded-full"
        style={{
          background: "var(--color-surface-inset)",
          border: "1px solid var(--color-border)",
          maxWidth: 400,
        }}
      >
        <Search size={16} strokeWidth={1.75} style={{ color: "var(--color-text-tertiary)" }} />
        <input
          placeholder="Sök inspelningar…"
          className="flex-1 bg-transparent border-none outline-none text-sm"
          style={{ color: "var(--color-text)", fontFamily: "inherit" }}
        />
      </div>

      <div className="flex-1" />

      {/* Record + dropdown */}
      {!isProcessing && (
        <div className="flex rounded-[12px] overflow-hidden" style={{ boxShadow: "var(--shadow-record)" }}>
          <button
            onClick={onRecord}
            className="flex items-center gap-2 px-4 h-11 text-sm font-semibold text-white transition-all duration-150"
            style={{
              background: isRecording
                ? "var(--color-danger)"
                : "var(--gradient-record)",
              border: "none",
              cursor: "pointer",
              transform: "translateY(0)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
            aria-label={isRecording ? "Stoppa inspelning" : "Starta inspelning"}
          >
            {isRecording ? (
              <>
                <Square size={16} strokeWidth={2.5} fill="white" />
                Stoppa
              </>
            ) : (
              <>
                <Mic size={16} strokeWidth={1.75} />
                Spela in
              </>
            )}
          </button>
          {!isRecording && (
            <button
              className="flex items-center justify-center w-9 h-11 border-l text-white transition-opacity"
              style={{
                background: "var(--gradient-record)",
                borderColor: "rgba(255,255,255,0.2)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
              aria-label="Inställningar för inspelning"
            >
              <ChevronDown size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}

      {/* Importera */}
      {!isRecording && !isProcessing && (
        <button
          className="flex items-center gap-2 px-4 h-11 rounded-[12px] text-sm font-semibold transition-colors"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-primary)",
            color: "var(--color-primary)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-primary-soft)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface)")}
        >
          <Upload size={16} strokeWidth={1.75} />
          Importera
        </button>
      )}
    </div>
  );
}

/* ── Hero-panel ─────────────────────────────────────────────── */

function HeroPanel({
  status,
  elapsed,
  step,
  capture,
  onCapture,
  onRecord,
  onReset,
  errorMessage,
}: {
  status: AppStatus;
  elapsed: number;
  step: ProcessingStep;
  capture: CaptureSource;
  onCapture: (c: CaptureSource) => void;
  onRecord: () => void;
  onReset: () => void;
  errorMessage: string | null;
}) {
  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const isError = status === "error";

  return (
    <div
      className="rounded-[16px] p-8 flex flex-col items-center"
      style={{
        background: "var(--color-surface-inset)",
        border: "1px solid var(--color-border)",
        minHeight: 280,
      }}
    >
      {isError ? (
        <ErrorState message={errorMessage} onReset={onReset} />
      ) : isProcessing ? (
        <ProcessingStepper step={step} />
      ) : isRecording ? (
        <RecordingState elapsed={elapsed} capture={capture} onStop={onRecord} />
      ) : (
        <IdleState capture={capture} onCapture={onCapture} onRecord={onRecord} />
      )}
    </div>
  );
}

function ErrorState({ message, onReset }: { message: string | null; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "#FEE2E2" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 6v4m0 4h.01M18 10a8 8 0 11-16 0 8 8 0 0116 0z" stroke="#DC2626" strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
          Något gick fel
        </p>
        {message && (
          <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--color-text-secondary)" }}>
            {message}
          </p>
        )}
      </div>
      <button
        onClick={onReset}
        className="px-4 py-2 rounded-xl text-sm font-medium"
        style={{ background: "var(--color-primary)", color: "#fff" }}
      >
        Försök igen
      </button>
    </div>
  );
}

function IdleState({
  capture,
  onCapture,
  onRecord,
}: {
  capture: CaptureSource;
  onCapture: (c: CaptureSource) => void;
  onRecord: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Stor Record-knapp */}
      <button
        onClick={onRecord}
        className="flex items-center justify-center rounded-full transition-all duration-200 animate-record-pulse"
        style={{
          width: 96,
          height: 96,
          background: "var(--gradient-record)",
          border: "none",
          cursor: "pointer",
          boxShadow: "var(--shadow-record)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
        aria-label="Spela in"
      >
        <Mic size={36} strokeWidth={1.5} color="white" />
      </button>

      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Redo att spela in nästa möte
      </p>

      {/* Capture-toggles */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <CaptureToggle
          label="Skärm"
          Icon={MonitorUp}
          checked={capture.screen}
          onChange={(v) => onCapture({ ...capture, screen: v })}
        />
        <CaptureToggle
          label="Systemljud"
          Icon={Volume2}
          checked={capture.audio}
          onChange={(v) => onCapture({ ...capture, audio: v })}
          hint="Systemljud måste delas i webbläsarens dialog"
        />
        <CaptureToggle
          label="Mikrofon"
          Icon={Mic}
          checked={capture.mic}
          onChange={(v) => onCapture({ ...capture, mic: v })}
        />
      </div>
    </div>
  );
}

function RecordingState({
  elapsed,
  capture,
  onStop,
}: {
  elapsed: number;
  capture: CaptureSource;
  onStop: () => void;
}) {
  const nearLimit = elapsed > 1500;

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Stop-knapp + puls-indikator */}
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full animate-danger-pulse"
          style={{ background: "var(--color-danger)" }}
        />
        <span className="text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
          Spelar in
        </span>
      </div>

      {/* Timer */}
      <span
        className="tabular-nums font-bold"
        style={{
          fontSize: 32,
          letterSpacing: "0.04em",
          color: "var(--color-text)",
          fontFamily: "var(--font-mono)",
          lineHeight: 1,
        }}
      >
        {formatTimer(elapsed)}
      </span>

      {/* Waveform */}
      <div className="flex items-center justify-center gap-px" style={{ height: 28 }}>
        {WAVEFORM_DELAYS.map((delay, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: "100%",
              background: "var(--color-primary)",
              borderRadius: 2,
              opacity: 0.7,
              transformOrigin: "center",
              animation: `bar-wave ${WAVEFORM_DURATIONS[i]}s ease-in-out infinite ${delay}s`,
            }}
          />
        ))}
      </div>

      {/* Aktiva källor */}
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
        {capture.screen && <span>🖥 Skärm ●</span>}
        {capture.mic && <span>🎙 Mikrofon ●</span>}
        {capture.audio && <span>🔊 Systemljud ●</span>}
      </div>

      {/* Stopp-knapp */}
      <button
        onClick={onStop}
        className="flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold text-white transition-opacity mt-2"
        style={{
          background: "var(--color-danger)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(220,38,38,.35)",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        aria-label="Stoppa inspelning"
      >
        <Square size={14} fill="white" strokeWidth={0} />
        Stoppa
      </button>

      {/* Varning */}
      {nearLimit && (
        <p
          className="text-xs text-center px-4 py-2 rounded-input"
          style={{
            color: "var(--color-warning)",
            background: "rgba(217,119,6,.08)",
            border: "1px solid rgba(217,119,6,.2)",
          }}
        >
          Närmar sig Whispers gräns (25 MB). Stoppa snart för bästa resultat.
        </p>
      )}
    </div>
  );
}

const STEPPER_STEPS = [
  { label: "Transkriberar", sub: "Whisper" },
  { label: "Genererar issues", sub: "GPT-4o" },
  { label: "Klar", sub: "" },
];

const STEP_MESSAGES = [
  "Skickar ljud till Whisper…",
  "GPT-4o föreslår issues…",
  "Navigerar till granskning…",
];

function ProcessingStepper({ step }: { step: ProcessingStep }) {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPPER_STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all"
                  style={{
                    background: done
                      ? "var(--color-success)"
                      : active
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                    color: done || active ? "white" : "var(--color-text-tertiary)",
                  }}
                >
                  {done ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : active ? (
                    <div
                      className="animate-spin-slow rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                      }}
                    />
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: active ? "var(--color-text)" : done ? "var(--color-success)" : "var(--color-text-tertiary)",
                    }}
                  >
                    {s.label}
                  </span>
                  {s.sub && (
                    <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                      {s.sub}
                    </span>
                  )}
                </div>
              </div>
              {i < STEPPER_STEPS.length - 1 && (
                <div
                  className="w-16 h-px mx-2 mb-6"
                  style={{
                    background: i < step ? "var(--color-success)" : "var(--color-border)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {STEP_MESSAGES[step]}
      </p>
    </div>
  );
}

/* ── Capture-toggle ─────────────────────────────────────────── */

function CaptureToggle({
  label,
  Icon,
  checked,
  onChange,
  hint,
}: {
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label
      className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer select-none text-sm font-medium transition-colors"
      style={{
        background: checked ? "var(--color-primary-soft)" : "var(--color-surface)",
        border: `1px solid ${checked ? "var(--color-primary-ring)" : "var(--color-border)"}`,
        color: checked ? "var(--color-primary)" : "var(--color-text-secondary)",
      }}
      title={hint}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {/* Pill-toggle */}
      <div
        className="relative flex-shrink-0"
        style={{ width: 32, height: 18 }}
      >
        <div
          className="absolute inset-0 rounded-full transition-colors"
          style={{ background: checked ? "var(--color-primary)" : "var(--color-border)" }}
        />
        <div
          className="absolute top-0.75 w-3 h-3 rounded-full bg-white transition-all duration-150"
          style={{ left: checked ? 17 : 3 }}
        />
      </div>
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </label>
  );
}

/* ── SessionCard ────────────────────────────────────────────── */

const PRIORITY_COLORS_MAP: Record<number, string> = {
  0: "var(--color-prio-none)",
  1: "var(--color-prio-urgent)",
  2: "var(--color-prio-high)",
  3: "var(--color-prio-medium)",
  4: "var(--color-prio-low)",
};

function SessionCard({ session, onClick }: { session: Session; onClick: () => void }) {
  const issueCount = session.issues.length;
  const topIssues = session.issues.slice(0, 3);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 rounded-[16px] transition-all duration-150"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--shadow-card-hover)";
        el.style.borderColor = "var(--color-border-strong)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--shadow-card)";
        el.style.borderColor = "var(--color-border)";
      }}
    >
      {/* Rubrik + meta */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3
          className="text-base font-semibold leading-snug"
          style={{ color: "var(--color-text)", letterSpacing: "-0.01em" }}
        >
          {session.title}
        </h3>
        <span
          className="text-xs font-medium shrink-0 px-2 py-0.5 rounded-full"
          style={{
            background: "var(--color-primary-soft)",
            color: "var(--color-primary)",
          }}
        >
          {issueCount} issues
        </span>
      </div>

      <p
        className="text-xs mb-3"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {formatDate(session.date)} · {formatDuration(session.durationSec)}
      </p>

      {/* Issue-bullets */}
      <div className="flex flex-col gap-1.5 mb-4">
        {topIssues.map((issue) => (
          <div key={issue.id} className="flex items-start gap-2">
            <div
              className="mt-1.25 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: PRIORITY_COLORS_MAP[issue.priority] }}
            />
            <span
              className="text-sm leading-snug"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {issue.title}
            </span>
          </div>
        ))}
        {issueCount > 3 && (
          <span className="text-xs ml-3.5" style={{ color: "var(--color-text-tertiary)" }}>
            + {issueCount - 3} till…
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1" style={{ color: "var(--color-primary)" }}>
        <span className="text-sm font-medium">Granska issues</span>
        <ArrowUpRight size={15} strokeWidth={2} />
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "var(--color-primary-soft)" }}
      >
        <Disc size={22} style={{ color: "var(--color-primary)" }} strokeWidth={1.75} />
      </div>
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Inga inspelningar ännu.{" "}
        <span style={{ color: "var(--color-text)" }}>Tryck Spela in</span> för att
        fånga ditt första möte.
      </p>
    </div>
  );
}
