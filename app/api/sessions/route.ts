import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Session, LinearIssue, TranscriptSegment } from "@/lib/types";

export async function GET() {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      `id, title, date, duration_sec,
       issues(id, title, description, priority, label_ids, assignee_id, project_id, cycle_id, estimate, status, linear_url, source_timecode)`
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions: Session[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    durationSec: row.duration_sec,
    transcript: [],
    issues: ((row.issues as unknown[]) ?? []).map(mapIssueRow),
  }));

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const body: { title: string; date: string; durationSec: number; transcript: TranscriptSegment[]; issues: LinearIssue[] } =
    await req.json();

  // 1. Insert session
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .insert({ title: body.title, date: body.date, duration_sec: body.durationSec })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: sessionErr?.message ?? "Session error" }, { status: 500 });
  }

  const sessionId = session.id as string;

  // 2. Insert transcript segments (fire and forget if empty)
  if (body.transcript.length > 0) {
    await supabase.from("transcript_segments").insert(
      body.transcript.map((s) => ({ session_id: sessionId, start_sec: s.start, text: s.text }))
    );
  }

  // 3. Insert issues and get back their DB ids
  let savedIssues: LinearIssue[] = body.issues;
  if (body.issues.length > 0) {
    const { data: issueRows } = await supabase
      .from("issues")
      .insert(
        body.issues.map((iss) => ({
          session_id: sessionId,
          title: iss.title,
          description: iss.description,
          priority: iss.priority,
          label_ids: iss.labelIds ?? [],
          assignee_id: iss.assigneeId ?? null,
          project_id: iss.projectId ?? null,
          cycle_id: iss.cycleId ?? null,
          estimate: iss.estimate ?? null,
          status: "draft",
          source_timecode: iss.sourceTimecode ?? null,
        }))
      )
      .select("id, title, description, priority, label_ids, assignee_id, project_id, cycle_id, estimate, status, linear_url, source_timecode");

    if (issueRows) savedIssues = issueRows.map(mapIssueRow);
  }

  const result: Session = {
    id: sessionId,
    title: body.title,
    date: body.date,
    durationSec: body.durationSec,
    transcript: body.transcript,
    issues: savedIssues,
  };

  return NextResponse.json(result, { status: 201 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIssueRow(row: any): LinearIssue {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    priority: row.priority ?? 3,
    labelIds: row.label_ids ?? [],
    assigneeId: row.assignee_id ?? undefined,
    projectId: row.project_id ?? undefined,
    cycleId: row.cycle_id ?? undefined,
    estimate: row.estimate ?? undefined,
    teamId: "",
    status: row.status ?? "draft",
    linearUrl: row.linear_url ?? undefined,
    sourceTimecode: row.source_timecode ?? undefined,
  };
}
