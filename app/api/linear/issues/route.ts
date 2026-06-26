import { NextRequest, NextResponse } from "next/server";
import { createLinearIssue, type CreateIssueInput } from "@/lib/linear";

export async function POST(req: NextRequest) {
  try {
    const body: CreateIssueInput = await req.json();
    const result = await createLinearIssue(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
