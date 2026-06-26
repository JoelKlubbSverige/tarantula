import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json({ error: "Ingen ljudfil" }, { status: 400 });
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audio);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Whisper ${res.status}`);
    }

    const data = await res.json();

    const segments = (data.segments ?? []).map((s: { start: number; text: string }) => ({
      start: Math.floor(s.start),
      text: s.text.trim(),
    }));

    return NextResponse.json({ text: data.text ?? "", segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Okänt fel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
