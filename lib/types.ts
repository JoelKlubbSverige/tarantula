export type Priority = 0 | 1 | 2 | 3 | 4;

export interface LinearIssue {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  labelIds: string[];
  assigneeId?: string;
  projectId?: string;
  cycleId?: string;
  estimate?: number;
  teamId: string;
  status: "draft" | "sending" | "sent" | "error" | "resolved";
  linearUrl?: string;
  error?: string;
  sourceTimecode?: string;
}

export interface TranscriptSegment {
  start: number;
  text: string;
}

export interface Session {
  id: string;
  title: string;
  date: string;
  durationSec: number;
  transcript: TranscriptSegment[];
  issues: LinearIssue[];
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "Ingen",
  1: "Brådskande",
  2: "Hög",
  3: "Medium",
  4: "Låg",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  0: "var(--color-prio-none)",
  1: "var(--color-prio-urgent)",
  2: "var(--color-prio-high)",
  3: "var(--color-prio-medium)",
  4: "var(--color-prio-low)",
};

export const PRIORITY_BG: Record<Priority, string> = {
  0: "rgba(156,163,175,.15)",
  1: "rgba(229,72,77,.12)",
  2: "rgba(242,153,74,.12)",
  3: "rgba(226,178,3,.12)",
  4: "rgba(94,106,210,.12)",
};

export const ESTIMATES: { value: number; label: string }[] = [
  { value: 1, label: "XS" },
  { value: 2, label: "S" },
  { value: 3, label: "M" },
  { value: 5, label: "L" },
  { value: 8, label: "XL" },
];

// Linear meta types (from API)
export interface LUser { id: string; name: string; displayName: string; avatarUrl?: string; }
export interface LProject { id: string; name: string; icon?: string; color?: string; }
export interface LCycle { id: string; name: string; number: number; startsAt: string; endsAt: string; }
export interface LLabel { id: string; name: string; color: string; }

export interface LinearMeta {
  users: LUser[];
  projects: LProject[];
  cycles: LCycle[];
  labels: LLabel[];
}
