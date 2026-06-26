import { NextResponse } from "next/server";
import { fetchLinearMeta } from "@/lib/linear";

export async function GET() {
  try {
    const meta = await fetchLinearMeta();
    return NextResponse.json(meta);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
