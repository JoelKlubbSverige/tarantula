import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { LinearIssue } from "@/lib/types";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("sessions")
    .select(
      `id, title, date, duration_sec,
       transcript_segments(start_sec, text),
       issues(id, title, description, priority, label_ids, assignee_id, project_id, cycle_id, estimate, status, linear_url, source_timecode)`
    )
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    title: data.title,
    date: data.date,
    durationSec: data.duration_sec,
    transcript: ((data.transcript_segments as unknown[]) ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({ start: s.start_sec, text: s.text })
    ),
    issues: ((data.issues as unknown[]) ?? []).map(mapIssueRow),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { title } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Tom titel" }, { status: 400 });
  const { error } = await supabase.from("sessions").update({ title: title.trim() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
