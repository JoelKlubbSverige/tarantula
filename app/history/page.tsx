"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Disc, History, Settings, Loader2, ArrowUpRight } from "lucide-react";
import type { Session } from "@/lib/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just nu";
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`;
  if (diff < 86400 * 2) return "Igår";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} tim ${m} min`;
  return `${m} min`;
}

const CARD_GRADIENT = "linear-gradient(160deg, #0A0A0A 0%, #181818 60%, #262626 100%)";

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("tarantula:dark") === "1";
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("tarantula:dark", darkMode ? "1" : "0");
  }, [darkMode]);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSessions(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        {/* Sidebar */}
        <aside
          className="flex flex-col w-66 shrink-0 p-5"
          style={{ borderRight: "1px solid var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex items-center gap-2 mb-8">
            <Image src="/Tarantula.png" alt="Tarantula" width={32} height={32} className="shrink-0" style={{ borderRadius: "50%" }} />
            <span className="font-bold text-base" style={{ color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              Tarantula
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {[
              { id: "record", label: "Spela in", Icon: Disc, onClick: () => router.push("/") },
              { id: "history", label: "Historik", Icon: History, onClick: () => {} },
              { id: "settings", label: "Inställningar", Icon: Settings, onClick: undefined },
            ].map(({ id, label, Icon, onClick }) => {
              const active = id === "history";
              return (
                <button
                  key={id}
                  onClick={onClick}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-input text-left transition-colors duration-100 w-full text-sm font-medium"
                  style={{
                    background: active ? "var(--color-primary-soft)" : "transparent",
                    color: active ? "var(--color-text)" : "var(--color-text-secondary)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--color-surface-inset)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <Icon size={18} strokeWidth={1.75} style={{ color: active ? "var(--color-text)" : "var(--color-text-secondary)" }} />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          {/* Dev Mode toggle */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-tertiary)" }}>Dev Mode</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: darkMode ? "#3B82F6" : "var(--color-border-strong)",
                border: "none", cursor: "pointer", transition: "background .2s",
                padding: 0, position: "relative", flexShrink: 0,
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: darkMode ? 18 : 2,
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
              }} />
            </button>
          </div>

          <div className="p-3 rounded-input" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>Transkriberat</p>
            <div className="w-full h-1.5 rounded-full mb-1.5 overflow-hidden" style={{ background: "var(--color-border)" }}>
              <div className="h-full rounded-full" style={{ width: "30%", background: "var(--color-primary)" }} />
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>300 / 1 000 min denna månad</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>Återställs om 5 dagar</p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center px-6 h-18 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>Historik</h1>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-20 text-center">
                <History size={32} style={{ color: "var(--color-text-tertiary)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Inga inspelningar ännu</p>
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>Gå till Spela in för att starta ditt första möte</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-3xl">
                {sessions.map((s) => {
                  const pendingCount = s.issues.filter((i) => i.status === "draft" || i.status === "error").length;
                  const sentCount = s.issues.filter((i) => i.status === "sent").length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/review?session=${s.id}`)}
                      className="w-full text-left rounded-[16px] p-5 transition-all duration-150 group"
                      style={{
                        background: darkMode ? CARD_GRADIENT : "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        boxShadow: "var(--shadow-card)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-strong)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card-hover)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
                      }}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono" style={{ color: "var(--color-text-tertiary)" }}>
                              #{((parseInt(s.id.replace(/-/g, "").slice(-8), 16) % 9000) + 1000)}
                            </span>
                            <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>·</span>
                            <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{formatDate(s.date)}</span>
                            {s.durationSec > 0 && <>
                              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>·</span>
                              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{formatDuration(s.durationSec)}</span>
                            </>}
                          </div>
                          <p className="font-semibold text-base leading-snug" style={{ color: "var(--color-text)" }}>{s.title}</p>
                        </div>
                        <ArrowUpRight size={16} style={{ color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 2 }} />
                      </div>

                      {s.issues.length > 0 && (
                        <div className="flex flex-col gap-1 mb-3">
                          {s.issues.slice(0, 3).map((issue) => (
                            <div key={issue.id} className="flex items-center gap-2">
                              <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{
                                  background: (issue.status === "sent" || issue.status === "resolved")
                                    ? "var(--color-success)"
                                    : "#3B82F6",
                                }}
                              />
                              <span className="text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>{issue.title}</span>
                            </div>
                          ))}
                          {s.issues.length > 3 && (
                            <p className="text-xs pl-3.5" style={{ color: "var(--color-text-tertiary)" }}>+{s.issues.length - 3} till</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {s.issues.length === 0 ? (
                          <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>Inga issues</span>
                        ) : (
                          <>
                            {sentCount > 0 && (
                              <span className="text-xs font-medium" style={{ color: "var(--color-success)" }}>
                                {sentCount} skickad{sentCount !== 1 ? "e" : ""}
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="text-xs font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                                {pendingCount} kvar
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
