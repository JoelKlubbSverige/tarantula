"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Trash2,
  Flag,
  Check,
  FileText,
  Disc,
  History,
  Settings,
  ChevronDown,
  Plus,
  ExternalLink,
  User,
  Layers,
  RefreshCw,
  Hash,
  Send,
  X,
  Loader2,
} from "lucide-react";
import type { LinearIssue, Priority, Session, LinearMeta } from "@/lib/types";
import { PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_BG, ESTIMATES } from "@/lib/types";
import * as LucideIcons from "lucide-react";

function LinearLogo({ size = 18 }: { size?: number }) {
  return <Image src="/linearlogo.png" alt="Linear" width={size} height={size} style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }} />;
}

function MarkdownText({ text }: { text: string }) {
  return (
    <span>
      {text.split("\n").map((line, i, allLines) => {
        const isBullet = /^[-•]\s/.test(line);
        const content = isBullet ? line.replace(/^[-•]\s/, "") : line;

        const renderInline = (str: string) => {
          const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
          return parts.map((p, j) => {
            if (p.startsWith("**") && p.endsWith("**")) return <strong key={j}>{p.slice(2, -2)}</strong>;
            if (p.startsWith("*") && p.endsWith("*")) return <em key={j}>{p.slice(1, -1)}</em>;
            return <span key={j}>{p}</span>;
          });
        };

        return (
          <span key={i} style={{ display: isBullet ? "flex" : "inline", alignItems: "baseline", gap: 4 }}>
            {isBullet && <span style={{ flexShrink: 0, marginTop: 2 }}>•</span>}
            <span>{renderInline(content)}</span>
            {i < allLines.length - 1 && <br />}
          </span>
        );
      })}
    </span>
  );
}


function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} tim ${m} min`;
  return `${m} min`;
}

const NOW_MS = Date.now();

function formatTimecode(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function sessionDisplayId(id: string) {
  return "#" + ((parseInt(id.replace(/-/g, "").slice(-8), 16) % 9000) + 1000);
}

/* ── Main page ──────────────────────────────────────────────── */
const EMPTY_SESSION: Session = { id: "", title: "", date: new Date().toISOString(), durationSec: 0, transcript: [], issues: [] };

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewPageInner />
    </Suspense>
  );
}

function ReviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedTime, setHighlightedTime] = useState<number | null>(null);
  const [meta, setMeta] = useState<LinearMeta | null>(null);
  const [metaError, setMetaError] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("tarantula:dark") === "1";
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("tarantula:dark", darkMode ? "1" : "0");
  }, [darkMode]);

  useEffect(() => {
    async function load() {
      // 1. Fresh recording — sessionStorage has the data
      const raw = sessionStorage.getItem("tarantula:session");
      if (raw) {
        try {
          const s: Session = JSON.parse(raw);
          sessionStorage.removeItem("tarantula:session");
          setSession(s);
          setIssues(s.issues);
          setLoading(false);
          return;
        } catch { /* fall through */ }
      }

      // 2. Navigating from session card — load from DB via URL param
      const sessionId = searchParams.get("session");
      if (sessionId) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}`);
          const s = await res.json();
          if (s.error) { router.push("/"); return; }
          setSession(s);
          setIssues(s.issues);
          setLoading(false);
        } catch {
          router.push("/");
        }
        return;
      }

      // 3. No data — go home
      router.push("/");
    }
    load();
  }, [router, searchParams]);

  useEffect(() => {
    fetch("/api/linear/meta")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setMetaError(true); return; }
        setMeta(d);
      })
      .catch(() => setMetaError(true));
  }, []);

  const isDbId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

  const persistIssue = useCallback((id: string, patch: Record<string, unknown>) => {
    if (!isDbId(id)) return;
    fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  const updateIssue = useCallback((id: string, patch: Partial<LinearIssue>) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const deleteIssue = useCallback((id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
    if (isDbId(id)) {
      fetch(`/api/issues/${id}`, { method: "DELETE" }).catch(() => {});
    }
  }, []);

  const sendIssue = useCallback(async (id: string) => {
    const issue = issues.find((i) => i.id === id);
    if (!issue) return;
    updateIssue(id, { status: "sending", error: undefined });

    try {
      const res = await fetch("/api/linear/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          labelIds: issue.labelIds,
          assigneeId: issue.assigneeId,
          projectId: issue.projectId,
          cycleId: issue.cycleId,
          estimate: issue.estimate,
        }),
      });
      const data = await res.json();
      if (data.error || !data.success) {
        updateIssue(id, { status: "error", error: data.error ?? "Okänt fel" });
      } else {
        updateIssue(id, { status: "sent", linearUrl: data.issue.url });
        persistIssue(id, { status: "sent", linear_url: data.issue.url });
      }
    } catch {
      updateIssue(id, { status: "error", error: "Kunde inte nå Linear. Försök igen." });
    }
  }, [issues, updateIssue, persistIssue]);

  const resolveIssue = useCallback((id: string) => {
    updateIssue(id, { status: "resolved" });
    persistIssue(id, { status: "resolved" });
  }, [updateIssue, persistIssue]);

  const sendAll = useCallback(() => {
    issues
      .filter((i) => i.status === "draft" || i.status === "error")
      .forEach((i) => sendIssue(i.id));
  }, [issues, sendIssue]);

  const pendingCount = issues.filter((i) => i.status === "draft" || i.status === "error").length;
  const [showNewIssue, setShowNewIssue] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--color-app-bg)" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
      </div>
    );
  }

  return (
    <div className="flex h-full p-4" style={{ background: "var(--color-app-bg)" }}>
      <div
        className="flex flex-1 overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-frame)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <ReviewSidebar darkMode={darkMode} setDarkMode={setDarkMode} />

        <div className="flex flex-1 flex-col min-w-0">
          {/* Review top-bar */}
          <div
            className="flex items-center gap-4 px-6 h-18 shrink-0"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors shrink-0"
              style={{ color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-text)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)")}
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
              Tillbaka
            </button>

            <div className="w-px h-4 shrink-0" style={{ background: "var(--color-border)" }} />

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                {session.id && (
                  <span
                    className="text-sm font-mono font-semibold shrink-0"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {sessionDisplayId(session.id)}
                  </span>
                )}
                <h1 className="text-lg font-bold truncate" style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}>
                  {session.title}
                </h1>
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {formatDuration(session.durationSec)}
              </p>
            </div>

            {pendingCount > 0 && (
              <button
                onClick={sendAll}
                className="flex items-center gap-2 px-4 h-10 rounded-button text-sm font-semibold text-white transition-all shrink-0"
                style={{ background: "var(--gradient-record)", border: "none", cursor: "pointer", boxShadow: "var(--shadow-record)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(0)")}
                >
                  ({pendingCount})
                Skicka till 
                <LinearLogo size={55} />
              </button>
            )}
          </div>

          {/* Två kolumner */}
          <div className="flex flex-1 overflow-hidden">
            {/* Issues */}
            <div className="flex-1 overflow-y-auto p-6 min-w-0">
              {metaError && (
                <div
                  className="flex items-center gap-2 mb-4 px-3 py-2 rounded-input text-xs"
                  style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.2)", color: "var(--color-danger)" }}
                >
                  <RefreshCw size={12} />
                  Kan inte nå Linear API — kontrollera API-nyckeln. Metadata-fält är inaktiverade.
                </div>
              )}

              <p className="text-xs font-medium mb-4" style={{ color: "var(--color-text-tertiary)" }}>
                {issues.length} förslag · Triage i Linear
              </p>

              <div className="flex flex-col gap-3">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    meta={meta}
                    darkMode={darkMode}
                    onUpdate={(patch) => updateIssue(issue.id, patch)}
                    onDelete={() => deleteIssue(issue.id)}
                    onSend={() => sendIssue(issue.id)}
                    onResolve={() => resolveIssue(issue.id)}
                    onTimecodeHover={setHighlightedTime}
                  />
                ))}

                {issues.length === 0 && (
                  <div
                    className="flex flex-col items-center gap-3 py-16 text-center rounded-card"
                    style={{ border: "1px dashed var(--color-border)" }}
                  >
                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      GPT-4o hittade inga tydliga åtgärder. Skapa en issue manuellt.
                    </p>
                  </div>
                )}

                {/* Always-visible new issue button */}
                <button
                  onClick={() => setShowNewIssue(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-card text-sm font-medium w-full transition-colors"
                  style={{
                    border: "1px dashed var(--color-border)",
                    color: "var(--color-text-tertiary)",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-strong)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-tertiary)";
                  }}
                >
                  <Plus size={14} />
                  Ny issue
                </button>
              </div>

              {showNewIssue && (
                <NewIssueModal
                  meta={meta}
                  sessionId={session.id}
                  onClose={() => setShowNewIssue(false)}
                  onCreated={(issue) => {
                    setIssues((prev) => [...prev, issue]);
                    setShowNewIssue(false);
                  }}
                />
              )}
            </div>

            <TranscriptRail segments={session.transcript} highlightedTime={highlightedTime} />
          </div>
        </div>
      </div>

      <ChatWidget
        transcript={session.transcript.map((s) => `[${formatTimecode(s.start)}] ${s.text}`).join("\n")}
        currentIssues={issues.map((i) => i.title)}
        darkMode={darkMode}
        onAddIssues={(newIssues) => {
          const mapped: LinearIssue[] = newIssues.map((iss, idx) => ({
            id: `chat-${Date.now()}-${idx}`,
            title: iss.title,
            description: iss.description ?? "",
            priority: (iss.priority ?? 3) as Priority,
            labelIds: [],
            teamId: "",
            status: "draft",
          }));
          setIssues((prev) => [...prev, ...mapped]);
        }}
      />
    </div>
  );
}

/* ── Chat widget ────────────────────────────────────────────── */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  linearIssues?: { title: string; description: string; priority: number }[];
}

interface ChatIssue { title: string; description: string; priority: number }

function ChatWidget({
  transcript,
  currentIssues,
  darkMode,
  onAddIssues,
}: {
  transcript: string;
  currentIssues: string[];
  darkMode: boolean;
  onAddIssues: (issues: ChatIssue[]) => void;
}) {
  const INITIAL_MESSAGES: ChatMessage[] = [
    { role: "assistant", content: "Hej! Jag kan hjälpa dig analysera mötestranskriptet och strukturera issues. Vad vill du ha hjälp med?" },
  ];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingLinear, setSendingLinear] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, next]);
    setLoading(true);

    try {
      const history = [...messages, next].map(({ role, content }) => ({ role, content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, transcript, currentIssues }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, linearIssues: data.linearIssues ?? undefined },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Något gick fel. Försök igen." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendToLinear(issues: ChatIssue[], msgIdx: number) {
    setSendingLinear(msgIdx);
    onAddIssues(issues);
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIdx
          ? { ...m, linearIssues: undefined, content: m.content + "\n\n✓ Issues tillagda i listan — skicka dem härifrån." }
          : m
      )
    );
    setSendingLinear(null);
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Öppna assistent"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#18181B",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          zIndex: 50,
          transition: "transform 0.15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1.07)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
      >
        <Image src="/Tarantula.png" alt="Tarantula" width={28} height={28} style={{ filter: "invert(1)" }} />
      </button>

      {/* Chat widget */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            width: 360,
            height: 500,
            background: "var(--color-surface)",
            borderRadius: 20,
            boxShadow: "var(--shadow-popover)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
              style={{ background: "#18181B" }}
            >
              <Image src="/Tarantula.png" alt="" width={16} height={16} style={{ filter: "invert(1)" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Tarantula Assistent</p>
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>GPT-4o mini</p>
            </div>
            {/* Menu */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 4, lineHeight: 1 }}
                aria-label="Meny"
              >
                <span style={{ fontSize: 18, letterSpacing: 1 }}>···</span>
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    boxShadow: "var(--shadow-popover)",
                    minWidth: 140,
                    zIndex: 60,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => {
                      setMessages(INITIAL_MESSAGES);
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-danger, #dc2626)",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,.07)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "none")}
                  >
                    <Trash2 size={13} />
                    Rensa chatt
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 4 }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className="text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl max-w-[85%]"
                  style={
                    msg.role === "user"
                      ? darkMode
                        ? { background: "#FFFFFF", color: "#111111", borderBottomRightRadius: 6 }
                        : { background: "#18181B", color: "#fff", borderBottomRightRadius: 6 }
                      : { background: "var(--color-surface-inset)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderBottomLeftRadius: 6 }
                  }
                >
                  <MarkdownText text={msg.content} />
                </div>

                {/* Linear action card */}
                {msg.role === "assistant" && msg.linearIssues && msg.linearIssues.length > 0 && (
                  <div
                    className="w-full rounded-xl p-3 flex flex-col gap-2"
                    style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border)" }}
                  >
                    <p className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                      {msg.linearIssues.length} issue{msg.linearIssues.length > 1 ? "s" : ""} identifierade
                    </p>
                    <div className="flex flex-col gap-1">
                      {msg.linearIssues.map((iss, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                            style={{
                              background: iss.priority === 1 ? "var(--color-prio-urgent)" : iss.priority === 2 ? "var(--color-prio-high)" : "var(--color-prio-medium)",
                            }}
                          />
                          <span className="text-xs leading-snug" style={{ color: "var(--color-text)" }}>{iss.title}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleSendToLinear(msg.linearIssues!, i)}
                      disabled={sendingLinear === i}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-semibold text-white mt-1"
                      style={{
                        background: sendingLinear === i ? "var(--color-text-tertiary)" : "var(--gradient-record)",
                        border: "none",
                        cursor: sendingLinear === i ? "default" : "pointer",
                      }}
                    >
                      {sendingLinear === i && <Loader2 size={14} className="animate-spin" />}
                      Lägg till i granskning
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-sm"
                  style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border)", borderBottomLeftRadius: 6 }}
                >
                  {[0, 1, 2].map((d) => (
                    <div
                      key={d}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: "var(--color-text-tertiary)",
                        animation: `bar-wave 0.8s ease-in-out infinite ${d * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="flex items-end gap-2 px-3 py-3 shrink-0"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Skriv ett meddelande…"
              rows={1}
              className="flex-1 resize-none text-sm rounded-input px-3 py-2 outline-none"
              style={{
                background: darkMode ? "#FFFFFF" : "var(--color-surface-inset)",
                border: "1px solid var(--color-border)",
                color: darkMode ? "#111111" : "var(--color-text)",
                fontFamily: "inherit",
                lineHeight: 1.5,
                maxHeight: 100,
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center w-9 h-9 rounded-input shrink-0"
              style={{
                background: input.trim() && !loading ? "var(--color-primary)" : "var(--color-border)",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                transition: "background 0.1s",
              }}
            >
              <Send size={15} color="white" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Sidofält ───────────────────────────────────────────────── */
function ReviewSidebar({ darkMode, setDarkMode }: { darkMode: boolean; setDarkMode: (v: boolean) => void }) {
  const router = useRouter();
  return (
    <aside
      className="flex flex-col w-66 shrink-0 p-5"
      style={{ borderRight: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-2 mb-8">
        <Image src="/Tarantula.png" alt="Tarantula" width={32} height={32} style={{ borderRadius: "50%" }} />
        <span className="font-bold text-base" style={{ color: "var(--color-text)" }}>
          Tarantula
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {[
          { label: "Spela in", Icon: Disc, onClick: () => router.push("/") },
          { label: "Historik", Icon: History, onClick: () => router.push("/history") },
          { label: "Inställningar", Icon: Settings, onClick: undefined },
        ].map(({ label, Icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-input text-sm font-medium w-full text-left transition-colors duration-100"
            style={{ color: "var(--color-text-secondary)", cursor: "pointer", background: "transparent", border: "none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Dev Mode toggle */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-medium" style={{ color: "var(--color-text-tertiary)" }}>Dev Mode ✨</span>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="relative shrink-0"
          style={{
            width: 36, height: 20,
            borderRadius: 10,
            background: darkMode ? "#3B82F6" : "var(--color-border-strong)",
            border: "none",
            cursor: "pointer",
            transition: "background .2s",
            padding: 0,
          }}
          aria-label="Växla dark mode"
        >
          <span
            style={{
              position: "absolute",
              top: 2, left: darkMode ? 18 : 2,
              width: 16, height: 16,
              borderRadius: "50%",
              background: "#fff",
              transition: "left .2s",
              boxShadow: "0 1px 3px rgba(0,0,0,.3)",
            }}
          />
        </button>
      </div>

      <div
        className="p-3 rounded-input"
        style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
          Transkriberat
        </p>
        <div className="w-full h-1.5 rounded-full mb-1.5 overflow-hidden" style={{ background: "var(--color-border)" }}>
          <div className="h-full rounded-full" style={{ width: "30%", background: "var(--color-primary)" }} />
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>300 / 1 000 min denna månad</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>Återställs om 5 dagar</p>
      </div>
    </aside>
  );
}

/* ── Issue-kort ─────────────────────────────────────────────── */
const PRIORITIES: Priority[] = [1, 2, 3, 4, 0];

/* ── NewIssueModal ──────────────────────────────────────────── */
function NewIssueModal({
  meta,
  sessionId,
  onClose,
  onCreated,
}: {
  meta: LinearMeta | null;
  sessionId: string;
  onClose: () => void;
  onCreated: (issue: LinearIssue) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(3);
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();
  const [cycleId, setCycleId] = useState<string | undefined>();
  const [estimate, setEstimate] = useState<string | undefined>();
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          title,
          description,
          priority,
          labelIds,
          assigneeId,
          projectId,
          cycleId,
          estimate: estimate !== undefined ? Number(estimate) : undefined,
        }),
      });
      const issue = await res.json();
      if (!issue.id) throw new Error(issue.error);
      onCreated(issue);
    } catch {
      /* silently fail — issue added to local state anyway */
    } finally {
      setSaving(false);
    }
  }

  const priorityEntries = Object.entries(PRIORITY_LABELS) as [string, string][];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60 }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          background: "var(--color-surface)",
          borderRadius: 16,
          boxShadow: "var(--shadow-popover)",
          border: "1px solid var(--color-border)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-xs font-semibold" style={{ color: "var(--color-text-tertiary)" }}>Ny issue</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && title.trim()) create(); }}
          placeholder="Issue-titel"
          style={{
            border: "none", outline: "none", background: "transparent",
            fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em",
            color: "var(--color-text)", padding: "4px 20px 6px",
            width: "100%",
          }}
        />

        {/* Description */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Lägg till beskrivning…"
          rows={4}
          style={{
            border: "none", outline: "none", background: "transparent", resize: "none",
            fontSize: 14, color: "var(--color-text-secondary)", padding: "4px 20px 12px",
            width: "100%", fontFamily: "inherit", lineHeight: 1.6,
          }}
        />

        {/* Meta toolbar */}
        <div
          className="flex flex-wrap items-center gap-2 px-5 py-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {/* Priority */}
          <MetaSelect
            icon={<Flag size={12} />}
            placeholder="Prioritet"
            value={String(priority)}
            options={priorityEntries.filter(([k]) => k !== "0").map(([k, v]) => ({ id: k, label: v }))}
            onChange={(v) => setPriority((v ? Number(v) : 3) as Priority)}
          />

          {/* Assignee */}
          <MetaSelect
            icon={<User size={12} />}
            placeholder="Assignee"
            value={assigneeId}
            options={meta?.users.map((u) => ({ id: u.id, label: u.displayName || u.name, avatar: { url: u.avatarUrl, name: u.displayName || u.name } })) ?? []}
            onChange={setAssigneeId}
            disabled={!meta}
          />

          {/* Project */}
          <MetaSelect
            icon={<Layers size={12} />}
            placeholder="Projekt"
            value={projectId}
            options={meta?.projects.map((p) => ({ id: p.id, label: p.name, prefix: <ProjectIcon icon={p.icon} color={p.color} size={14} /> })) ?? []}
            onChange={setProjectId}
            disabled={!meta}
          />

          {/* Estimate */}
          <MetaSelect
            icon={<Hash size={12} />}
            placeholder="Estimate"
            value={estimate}
            options={ESTIMATES.map((e) => ({ id: String(e.value), label: e.label }))}
            onChange={setEstimate}
          />

          {/* Cycle */}
          {meta && meta.cycles.length > 0 && (
            <MetaSelect
              icon={<RefreshCw size={12} />}
              placeholder="Cykel"
              value={cycleId}
              options={meta.cycles.map((c) => ({
                id: c.id,
                label: c.name || `Sprint ${c.number}`,
              }))}
              onChange={setCycleId}
            />
          )}

          {/* Labels */}
          {meta && meta.labels.length > 0 && (
            <MetaMultiSelect
              placeholder="Labels"
              selected={labelIds}
              options={meta.labels.map((l) => ({ id: l.id, label: l.name, color: l.color }))}
              onChange={setLabelIds}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-button text-sm font-medium"
            style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", cursor: "pointer" }}
          >
            Avbryt
          </button>
          <button
            onClick={create}
            disabled={!title.trim() || saving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-button text-sm font-semibold text-white"
            style={{
              background: title.trim() && !saving ? "var(--gradient-record)" : "var(--color-border)",
              border: "none",
              cursor: title.trim() && !saving ? "pointer" : "default",
              boxShadow: title.trim() && !saving ? "var(--shadow-record)" : "none",
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Skapa issue
          </button>
        </div>
      </div>
    </>
  );
}

const CARD_GRADIENT = "linear-gradient(160deg, #0A0A0A 0%, #181818 60%, #262626 100%)";

function IssueCard({
  issue,
  meta,
  darkMode,
  onUpdate,
  onDelete,
  onSend,
  onResolve,
  onTimecodeHover,
}: {
  issue: LinearIssue;
  meta: LinearMeta | null;
  darkMode: boolean;
  onUpdate: (patch: Partial<LinearIssue>) => void;
  onDelete: () => void;
  onSend: () => void;
  onResolve: () => void;
  onTimecodeHover: (t: number | null) => void;
}) {
  const [showPrioMenu, setShowPrioMenu] = useState(false);
  const locked = issue.status === "sending" || issue.status === "sent";
  const prioRef = useRef<HTMLDivElement>(null);

  // Close prio menu on outside click
  useEffect(() => {
    if (!showPrioMenu) return;
    const handler = (e: MouseEvent) => {
      if (prioRef.current && !prioRef.current.contains(e.target as Node)) {
        setShowPrioMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPrioMenu]);

  const borderColor =
    issue.status === "sent" ? "var(--color-success)"
    : issue.status === "error" ? "var(--color-danger)"
    : "var(--color-border)";

  return (
    <div
      className="issue-card rounded-card p-5 transition-all"
      style={{
        background: darkMode ? CARD_GRADIENT : "var(--color-surface)",
        border: `1px solid ${borderColor}`,
        boxShadow: "var(--shadow-card)",
        opacity: issue.status === "sending" ? 0.65 : 1,
      }}
    >
      {/* Rad 1: prioritet + delete */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative" ref={prioRef}>
          <button
            onClick={() => !locked && setShowPrioMenu((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: PRIORITY_BG[issue.priority],
              color: PRIORITY_COLORS[issue.priority],
              border: "none",
              cursor: locked ? "default" : "pointer",
            }}
          >
            <Flag size={10} strokeWidth={2} />
            {PRIORITY_LABELS[issue.priority]}
            {!locked && <ChevronDown size={10} />}
          </button>

          {showPrioMenu && (
            <div
              className="absolute top-8 left-0 z-20 rounded-card p-1 min-w-36"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-popover)",
              }}
            >
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => { onUpdate({ priority: p }); setShowPrioMenu(false); }}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-input text-xs font-medium text-left"
                  style={{ color: PRIORITY_COLORS[p], background: "transparent", border: "none", cursor: "pointer" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {!locked && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-input transition-colors"
            style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,.08)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-danger)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "none";
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-tertiary)";
            }}
            aria-label="Ta bort"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Titel */}
      {locked ? (
        <h3 className="text-base font-semibold mb-2 leading-snug" style={{ color: "var(--color-text)", letterSpacing: "-0.01em" }}>
          {issue.title}
        </h3>
      ) : (
        <input
          value={issue.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full mb-2 text-base font-semibold bg-transparent outline-none border-b border-transparent transition-colors leading-snug"
          style={{ color: "var(--color-text)", letterSpacing: "-0.01em", fontFamily: "inherit" }}
          onFocus={(e) => ((e.target as HTMLElement).style.borderColor = "var(--color-border)")}
          onBlur={(e) => ((e.target as HTMLElement).style.borderColor = "transparent")}
        />
      )}

      {/* Beskrivning */}
      {locked ? (
        issue.description && (
          <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {issue.description}
          </p>
        )
      ) : (
        <textarea
          value={issue.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Lägg till beskrivning…"
          rows={2}
          className="w-full mb-3 text-sm leading-relaxed bg-transparent outline-none resize-none border-b border-transparent transition-colors"
          style={{ color: "var(--color-text-secondary)", fontFamily: "inherit" }}
          onFocus={(e) => ((e.target as HTMLElement).style.borderColor = "var(--color-border)")}
          onBlur={(e) => ((e.target as HTMLElement).style.borderColor = "transparent")}
        />
      )}

      {/* Metadata-fält */}
      {!locked && (
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Assignee */}
          <MetaSelect
            icon={<User size={12} />}
            placeholder="Assignee"
            value={issue.assigneeId}
            options={meta?.users.map((u) => ({ id: u.id, label: u.displayName || u.name, avatar: { url: u.avatarUrl, name: u.displayName || u.name } })) ?? []}
            onChange={(v) => onUpdate({ assigneeId: v })}
            disabled={!meta}
          />

          {/* Project */}
          <MetaSelect
            icon={<Layers size={12} />}
            placeholder="Projekt"
            value={issue.projectId}
            options={meta?.projects.map((p) => ({ id: p.id, label: p.name, prefix: <ProjectIcon icon={p.icon} color={p.color} size={14} /> })) ?? []}
            onChange={(v) => onUpdate({ projectId: v })}
            disabled={!meta}
          />

          {/* Cycle */}
          <MetaSelect
            icon={<RefreshCw size={12} />}
            placeholder="Cycle"
            value={issue.cycleId}
            options={meta?.cycles.map((c) => {
                const active = new Date(c.startsAt).getTime() <= NOW_MS && new Date(c.endsAt).getTime() >= NOW_MS;
                return { id: c.id, label: `${c.name}${active ? " ●" : ""}` };
              }) ?? []}
            onChange={(v) => onUpdate({ cycleId: v })}
            disabled={!meta}
          />

          {/* Estimate */}
          <MetaSelect
            icon={<Hash size={12} />}
            placeholder="Estimate"
            value={issue.estimate !== undefined ? String(issue.estimate) : undefined}
            options={ESTIMATES.map((e) => ({ id: String(e.value), label: e.label }))}
            onChange={(v) => onUpdate({ estimate: Number(v) })}
          />

          {/* Labels */}
          {meta && meta.labels.length > 0 && (
            <MetaMultiSelect
              placeholder="Labels"
              selected={issue.labelIds}
              options={meta.labels.map((l) => ({ id: l.id, label: l.name, color: l.color }))}
              onChange={(ids) => onUpdate({ labelIds: ids })}
            />
          )}
        </div>
      )}

      {/* Källhänvisning */}
      {issue.sourceTimecode && (
        <button
          className="text-xs mb-3 block"
          style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={() => {
            const secs = issue.sourceTimecode!.split(":").reduce((a, t) => a * 60 + parseInt(t), 0);
            onTimecodeHover(secs);
          }}
          onMouseLeave={() => onTimecodeHover(null)}
        >
          Från transkript {issue.sourceTimecode}
        </button>
      )}

      {/* Felmeddelande */}
      {issue.status === "error" && issue.error && (
        <div
          className="mb-3 px-3 py-2 rounded-input text-sm"
          style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.2)", color: "var(--color-danger)" }}
        >
          {issue.error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
        <StatusBadge status={issue.status} />

        <div className="flex items-center gap-2">
          {(issue.status === "draft" || issue.status === "error") && (
            <button
              onClick={onResolve}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm font-medium transition-all"
              style={{ background: "none", border: "1px solid var(--color-border)", cursor: "pointer", color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
            >
              <Check size={13} strokeWidth={2} />
              Redan åtgärdat
            </button>
          )}

          {(issue.status === "draft" || issue.status === "error") && (
            <button
              onClick={onSend}
              className="flex items-center gap-2 px-3 py-1.5 rounded-button text-sm font-semibold text-white transition-all"
              style={{ background: "var(--gradient-record)", border: "none", cursor: "pointer", boxShadow: "var(--shadow-record)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(0)")}
            >
              {issue.status === "error" ? "Försök igen" : "Skicka till"}
              <LinearLogo size={55} />
            </button>
          )}

          {issue.status === "sent" && issue.linearUrl && (
            <a
              href={issue.linearUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--color-success)" }}
            >
              Öppna i Linear
              <ExternalLink size={13} strokeWidth={2} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── MetaSelect ─────────────────────────────────────────────── */
// Linear icon name → Lucide export name (when they differ)
const LINEAR_TO_LUCIDE: Record<string, string> = {
  NotePad: "Notebook", Notepad: "Notebook",
  MobilePhone: "Smartphone",
  ViewFinder: "ScanSearch", ViewFinder2: "ScanSearch",
  Robot: "Bot",
  Chat: "MessageCircle",
  Alert: "AlertTriangle",
  FaceId: "ScanFace",
  Cube: "Box",
  Rank: "Trophy",
  Chart: "BarChart2",
  Cone: "Cone",
  Cross: "Plus",
  Notion: "FileText",
  Zendesk: "Headphones",
  Claude: "Bot",
  Linear: "Layers",
};

// Emoji shortcodes — normalize both - and _ as separator
const EMOJI_SHORTCODES: Record<string, string> = {
  "speaking-head-in-silhouette": "🗣️", "speaking_head_in_silhouette": "🗣️",
  "flag-fi": "🇫🇮", "flag_fi": "🇫🇮",
  "flag-se": "🇸🇪", "flag_se": "🇸🇪",
  "flag-us": "🇺🇸", "flag_us": "🇺🇸",
  "flag-gb": "🇬🇧", "flag_gb": "🇬🇧",
  "flag-no": "🇳🇴", "flag_no": "🇳🇴",
  "flag-de": "🇩🇪", "flag_de": "🇩🇪",
  robot: "🤖", bug: "🐛", construction: "🚧", warning: "⚠️",
  fire: "🔥", bulb: "💡", memo: "📝", zap: "⚡",
  tada: "🎉", rocket: "🚀", star: "⭐", sparkles: "✨",
  gear: "⚙️", wrench: "🔧", hammer: "🔨", key: "🔑",
  lock: "🔒", eyes: "👀", wave: "👋", heart: "❤️",
  "chart-with-upwards-trend": "📈", "chart_with_upwards_trend": "📈",
  "bar-chart": "📊", "bar_chart": "📊",
  iphone: "📱", computer: "💻",
};

function ProjectIcon({ icon, color, size = 14 }: { icon?: string; color?: string; size?: number }) {
  const fg = color ?? "#6b7280";

  // 1. Emoji shortcode e.g. ":speaking_head_in_silhouette:"
  if (icon?.startsWith(":") && icon.endsWith(":")) {
    const key = icon.slice(1, -1);
    const emoji = EMOJI_SHORTCODES[key];
    if (emoji) {
      return <span style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>;
    }
    // Unknown shortcode → colored square fallback
    return <span style={{ width: size, height: size, borderRadius: 3, background: fg, display: "inline-block", flexShrink: 0 }} />;
  }

  // 2. Lucide icon name e.g. "Book", "Users" — with Linear→Lucide name mapping
  if (icon) {
    const lucideName = LINEAR_TO_LUCIDE[icon] ?? icon;
    const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size: number; color: string; strokeWidth: number }>>)[lucideName];
    if (Icon) {
      return <Icon size={size} color={fg} strokeWidth={1.75} />;
    }
  }

  // 3. Fallback: first letter of icon name as monogram in project color
  const letter = icon ? icon[0].toUpperCase() : "·";
  return (
    <span style={{
      width: size, height: size, borderRadius: 3, background: `${fg}22`,
      border: `1px solid ${fg}55`, color: fg,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.6, fontWeight: 700, flexShrink: 0, lineHeight: 1,
    }}>
      {letter}
    </span>
  );
}

function Avatar({ url, name, size = 16 }: { url?: string; name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", background: "var(--color-border-strong)",
        color: "var(--color-text)", fontSize: size * 0.45, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

function MetaSelect({
  icon,
  placeholder,
  value,
  options,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value?: string;
  options: { id: string; label: string; avatar?: { url?: string; name: string }; prefix?: React.ReactNode }[];
  onChange: (id: string | undefined) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  const openDropdown = () => {
    if (disabled) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const dropdown = open ? (
    <div
      ref={dropRef}
      className="rounded-card p-1 min-w-44 max-h-52 overflow-y-auto"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-popover)",
      }}
    >
      {value && (
        <button
          onClick={() => { onChange(undefined); setOpen(false); }}
          className="flex w-full px-2.5 py-1.5 rounded-input text-xs text-left"
          style={{ color: "var(--color-text-tertiary)", background: "transparent", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          — Ingen
        </button>
      )}
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => { onChange(o.id); setOpen(false); }}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-input text-xs font-medium text-left"
          style={{
            background: o.id === value ? "var(--color-surface-inset)" : "transparent",
            color: "var(--color-text)",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)")}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              o.id === value ? "var(--color-surface-inset)" : "transparent";
          }}
        >
          {o.avatar
            ? <Avatar url={o.avatar.url} name={o.avatar.name} size={16} />
            : o.prefix ?? <span style={{ width: 10 }}>{o.id === value && <Check size={10} strokeWidth={2.5} />}</span>}
          {o.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={openDropdown}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
        style={{
          background: selected ? "var(--color-surface-inset)" : "transparent",
          border: `1px solid ${selected ? "var(--color-border-strong)" : "var(--color-border)"}`,
          color: selected ? "var(--color-text)" : "var(--color-text-tertiary)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {selected?.avatar
          ? <Avatar url={selected.avatar.url} name={selected.avatar.name} size={14} />
          : selected?.prefix ?? icon}
        {selected ? selected.label : placeholder}
        <ChevronDown size={10} />
      </button>
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

/* ── MetaMultiSelect ────────────────────────────────────────── */
function MetaMultiSelect({
  placeholder,
  selected,
  options,
  onChange,
}: {
  placeholder: string;
  selected: string[];
  options: { id: string; label: string; color?: string }[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const dropdown = open ? (
    <div
      ref={dropRef}
      className="rounded-card p-1 min-w-44 max-h-52 overflow-y-auto"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-popover)",
      }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => toggle(o.id)}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-input text-xs font-medium text-left"
          style={{
            background: selected.includes(o.id) ? "var(--color-surface-inset)" : "transparent",
            color: "var(--color-text)",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)")}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              selected.includes(o.id) ? "var(--color-surface-inset)" : "transparent";
          }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: o.color ?? "var(--color-text-tertiary)" }}
          />
          {o.label}
          {selected.includes(o.id) && <Check size={10} strokeWidth={2.5} className="ml-auto" />}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={openDropdown}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{
          background: selected.length ? "var(--color-surface-inset)" : "transparent",
          border: `1px solid ${selected.length ? "var(--color-border-strong)" : "var(--color-border)"}`,
          color: selected.length ? "var(--color-text)" : "var(--color-text-tertiary)",
          cursor: "pointer",
        }}
      >
        {selected.length === 0 && <><Hash size={12} />{placeholder}</>}
        {selected.length === 1 && (() => {
          const o = options.find((x) => x.id === selected[0]);
          return <>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: o?.color ?? "var(--color-text-tertiary)" }} />
            {o?.label ?? "1 label"}
          </>;
        })()}
        {selected.length > 1 && <>
          <div className="flex items-center gap-0.5">
            {options.filter((o) => selected.includes(o.id)).slice(0, 4).map((o) => (
              <div key={o.id} className="w-2 h-2 rounded-full shrink-0" style={{ background: o.color ?? "var(--color-text-tertiary)" }} />
            ))}
          </div>
          {selected.length} labels
        </>}
        <ChevronDown size={10} />
      </button>
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

/* ── Status-badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status: LinearIssue["status"] }) {
  if (status === "resolved") return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: "rgba(21,163,74,.1)", color: "var(--color-success)", border: "1px solid rgba(21,163,74,.2)" }}>
      <Check size={11} strokeWidth={2.5} />
      Redan åtgärdat
    </span>
  );
  if (status === "draft") return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: "var(--color-surface-inset)", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border)" }}>
      Utkast
    </span>
  );
  if (status === "sending") return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: "var(--color-surface-inset)", color: "var(--color-text-secondary)" }}>
      <div className="animate-spin-slow rounded-full w-2.5 h-2.5"
        style={{ border: "1.5px solid var(--color-border-strong)", borderTopColor: "var(--color-text)" }} />
      Skickar…
    </span>
  );
  if (status === "sent") return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: "rgba(21,163,74,.1)", color: "var(--color-success)" }}>
      <Check size={11} strokeWidth={2.5} />
      Skickad → Triage
    </span>
  );
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: "rgba(220,38,38,.08)", color: "var(--color-danger)" }}>
      Fel
    </span>
  );
}

/* ── Transkript-rail ────────────────────────────────────────── */
function TranscriptRail({
  segments,
  highlightedTime,
}: {
  segments: { start: number; text: string }[];
  highlightedTime: number | null;
}) {
  return (
    <aside
      className="w-90 shrink-0 flex flex-col overflow-hidden"
      style={{ borderLeft: "1px solid var(--color-border)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <FileText size={16} strokeWidth={1.75} style={{ color: "var(--color-text-secondary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Transkript</span>
        </div>
        <button
          className="text-xs font-medium px-2 py-1 rounded-input transition-colors"
          style={{ color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "none")}
        >
          Kopiera
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {segments.map((seg, i) => {
          const isHighlighted =
            highlightedTime !== null &&
            seg.start <= highlightedTime &&
            (i === segments.length - 1 || segments[i + 1].start > highlightedTime);

          return (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2.5 rounded-input transition-colors"
              style={{ background: isHighlighted ? "var(--color-primary-soft)" : "transparent" }}
            >
              <span
                className="text-xs shrink-0 pt-0.5"
                style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}
              >
                {formatTimecode(seg.start)}
              </span>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {seg.text}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
