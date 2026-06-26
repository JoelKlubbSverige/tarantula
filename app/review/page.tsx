"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import type { LinearIssue, Priority, Session, LinearMeta } from "@/lib/types";
import { PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_BG, ESTIMATES } from "@/lib/types";

/* ── Linear logo mark ─────────────────────────────────────── */
function LinearMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <defs>
        <clipPath id="lm">
          <circle cx="10" cy="10" r="10" />
        </clipPath>
      </defs>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <g clipPath="url(#lm)">
        <line x1="-1" y1="12.5" x2="12.5" y2="-1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="16.5" x2="16.5" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="21" x2="21" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ── Mock data ──────────────────────────────────────────────── */
const MOCK_TRANSCRIPT = [
  { start: 0, text: "Vi börjar med att gå igenom roadmapen för Q3." },
  { start: 95, text: "Det finns en bugg i onboarding-steget — steg 3 visas inte rätt på mobil." },
  { start: 182, text: "Vi behöver uppdatera copy:n, texten är fortfarande från beta." },
  { start: 222, text: "Auth middleware är legacy och bör städas upp innan nästa release." },
  { start: 315, text: "API rate limiting är en blocker för enterprise-kunder, vi måste prioritera det." },
  { start: 401, text: "Dark mode-togglens saknas på dashboarden, kom med i förra veckan." },
  { start: 488, text: "Mobilanpassningen av dashboarden är halvfärdig, Joel tar det den här veckan." },
  { start: 542, text: "Vi avslutar med att planera in en tech-debt-sprint nästa period." },
];

const MOCK_SESSION: Session = {
  id: "1",
  title: "App-sync · produkt & design",
  date: "2026-06-25T09:00:00",
  durationSec: 2520,
  transcript: MOCK_TRANSCRIPT,
  issues: [
    {
      id: "i1",
      title: "Fix login redirect after session expires",
      description: "Användare hamnar på en tom sida när sessionen går ut. Bör redirecta till /login med en tillbaka-parameter.",
      priority: 2,
      labelIds: [],
      teamId: "",
      status: "draft",
      sourceTimecode: "00:00:00",
    },
    {
      id: "i2",
      title: "Uppdatera onboarding-copy i steg 3",
      description: "Texten är fortfarande från beta-perioden och stämmer inte med nuvarande flöde.",
      priority: 3,
      labelIds: [],
      teamId: "",
      status: "draft",
      sourceTimecode: "00:01:35",
    },
    {
      id: "i3",
      title: "Cleanup legacy auth middleware",
      description: "Gamla middleware skapar risk inför nästa release. Bör refaktoreras eller tas bort.",
      priority: 4,
      labelIds: [],
      teamId: "",
      status: "draft",
      sourceTimecode: "00:03:42",
    },
    {
      id: "i4",
      title: "API rate limiting för enterprise",
      description: "Saknar rate limiting vilket blockerar enterprise-onboarding.",
      priority: 1,
      labelIds: [],
      teamId: "",
      status: "draft",
      sourceTimecode: "00:05:15",
    },
    {
      id: "i5",
      title: "Mobilanpassning av dashboard",
      description: "Dashboard är inte mobilanpassad. Joel tar det under v26.",
      priority: 2,
      labelIds: [],
      teamId: "",
      status: "draft",
      sourceTimecode: "00:08:08",
    },
  ],
};

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} tim ${m} min`;
  return `${m} min`;
}

function formatTimecode(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ── Main page ──────────────────────────────────────────────── */
export default function ReviewPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<LinearIssue[]>(MOCK_SESSION.issues);
  const [highlightedTime, setHighlightedTime] = useState<number | null>(null);
  const [meta, setMeta] = useState<LinearMeta | null>(null);
  const [metaError, setMetaError] = useState(false);
  const session = MOCK_SESSION;

  useEffect(() => {
    fetch("/api/linear/meta")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setMetaError(true); return; }
        setMeta(d);
      })
      .catch(() => setMetaError(true));
  }, []);

  const updateIssue = useCallback((id: string, patch: Partial<LinearIssue>) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const deleteIssue = useCallback((id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
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
      }
    } catch {
      updateIssue(id, { status: "error", error: "Kunde inte nå Linear. Försök igen." });
    }
  }, [issues, updateIssue]);

  const sendAll = useCallback(() => {
    issues
      .filter((i) => i.status === "draft" || i.status === "error")
      .forEach((i) => sendIssue(i.id));
  }, [issues, sendIssue]);

  const pendingCount = issues.filter((i) => i.status === "draft" || i.status === "error").length;

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
        <ReviewSidebar />

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
              <h1 className="text-lg font-bold truncate" style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}>
                {session.title}
              </h1>
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                25 jun 2026 · {formatDuration(session.durationSec)}
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
                <LinearMark size={14} />
                Skicka alla ({pendingCount})
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
                    onUpdate={(patch) => updateIssue(issue.id, patch)}
                    onDelete={() => deleteIssue(issue.id)}
                    onSend={() => sendIssue(issue.id)}
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
                    <button
                      className="flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      <Plus size={14} />
                      Ny issue
                    </button>
                  </div>
                )}
              </div>
            </div>

            <TranscriptRail segments={session.transcript} highlightedTime={highlightedTime} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sidofält ───────────────────────────────────────────────── */
function ReviewSidebar() {
  return (
    <aside
      className="flex flex-col w-66 shrink-0 p-5"
      style={{ borderRight: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-2 mb-8">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm shrink-0"
          style={{ background: "var(--color-primary)" }}
        >
          T
        </div>
        <span className="font-bold text-base" style={{ color: "var(--color-primary)" }}>
          Tarantula
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {[
          { label: "Spela in", Icon: Disc },
          { label: "Historik", Icon: History },
          { label: "Inställningar", Icon: Settings },
        ].map(({ label, Icon }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-input text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

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

function IssueCard({
  issue,
  meta,
  onUpdate,
  onDelete,
  onSend,
  onTimecodeHover,
}: {
  issue: LinearIssue;
  meta: LinearMeta | null;
  onUpdate: (patch: Partial<LinearIssue>) => void;
  onDelete: () => void;
  onSend: () => void;
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
      className="rounded-card p-5 transition-all"
      style={{
        background: "var(--color-surface)",
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
            options={meta?.users.map((u) => ({ id: u.id, label: u.displayName || u.name })) ?? []}
            onChange={(v) => onUpdate({ assigneeId: v })}
            disabled={!meta}
          />

          {/* Project */}
          <MetaSelect
            icon={<Layers size={12} />}
            placeholder="Projekt"
            value={issue.projectId}
            options={meta?.projects.map((p) => ({ id: p.id, label: p.name })) ?? []}
            onChange={(v) => onUpdate({ projectId: v })}
            disabled={!meta}
          />

          {/* Cycle */}
          <MetaSelect
            icon={<RefreshCw size={12} />}
            placeholder="Cycle"
            value={issue.cycleId}
            options={meta?.cycles.map((c) => {
                const now = Date.now();
                const active = new Date(c.startsAt).getTime() <= now && new Date(c.endsAt).getTime() >= now;
                return { id: c.id, label: `#${c.number} ${c.name}${active ? " ●" : ""}` };
              }) ?? []}
            onChange={(v) => onUpdate({ cycleId: v })}
            disabled={!meta}
          />

          {/* Estimate */}
          <MetaSelect
            icon={<Hash size={12} />}
            placeholder="Estimate"
            value={issue.estimate !== undefined ? String(issue.estimate) : undefined}
            options={ESTIMATES.map((e) => ({ id: String(e), label: `${e} pt` }))}
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

        <div>
          {(issue.status === "draft" || issue.status === "error") && (
            <button
              onClick={onSend}
              className="flex items-center gap-2 px-3 py-1.5 rounded-button text-sm font-semibold text-white transition-all"
              style={{ background: "var(--gradient-record)", border: "none", cursor: "pointer", boxShadow: "var(--shadow-record)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(0)")}
            >
              <LinearMark size={13} />
              {issue.status === "error" ? "Försök igen" : "Skicka till Linear"}
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
  options: { id: string; label: string }[];
  onChange: (id: string | undefined) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
        style={{
          background: selected ? "var(--color-surface-inset)" : "transparent",
          border: `1px solid ${selected ? "var(--color-border-strong)" : "var(--color-border)"}`,
          color: selected ? "var(--color-text)" : "var(--color-text-tertiary)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {icon}
        {selected ? selected.label : placeholder}
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          className="absolute top-8 left-0 z-20 rounded-card p-1 min-w-44 max-h-52 overflow-y-auto"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-popover)" }}
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
              {o.id === value && <Check size={10} strokeWidth={2.5} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{
          background: selected.length ? "var(--color-surface-inset)" : "transparent",
          border: `1px solid ${selected.length ? "var(--color-border-strong)" : "var(--color-border)"}`,
          color: selected.length ? "var(--color-text)" : "var(--color-text-tertiary)",
          cursor: "pointer",
        }}
      >
        <Hash size={12} />
        {selected.length ? `${selected.length} label${selected.length > 1 ? "s" : ""}` : placeholder}
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          className="absolute top-8 left-0 z-20 rounded-card p-1 min-w-44 max-h-52 overflow-y-auto"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-popover)" }}
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
      )}
    </div>
  );
}

/* ── Status-badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status: LinearIssue["status"] }) {
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
