import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { LinearIssue } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, title, description, priority, labelIds, assigneeId, projectId, cycleId, estimate } = body;

  if (!sessionId || !title?.trim()) {
    return NextResponse.json({ error: "sessionId och title krävs" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("issues")
    .insert({
      session_id: sessionId,
      title: title.trim(),
      description: description ?? "",
      priority: priority ?? 3,
      label_ids: labelIds ?? [],
      assignee_id: assigneeId ?? null,
      project_id: projectId ?? null,
      cycle_id: cycleId ?? null,
      estimate: estimate ?? null,
      status: "draft",
    })
    .select("id, title, description, priority, label_ids, assignee_id, project_id, cycle_id, estimate, status, linear_url, source_timecode")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Fel" }, { status: 500 });

  const issue: LinearIssue = {
    id: data.id,
    title: data.title,
    description: data.description ?? "",
    priority: data.priority ?? 3,
    labelIds: data.label_ids ?? [],
    assigneeId: data.assignee_id ?? undefined,
    projectId: data.project_id ?? undefined,
    cycleId: data.cycle_id ?? undefined,
    estimate: data.estimate ?? undefined,
    teamId: "",
    status: data.status ?? "draft",
    linearUrl: data.linear_url ?? undefined,
  };

  return NextResponse.json(issue, { status: 201 });
}
