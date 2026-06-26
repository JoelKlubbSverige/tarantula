import { NextRequest, NextResponse } from "next/server";
import type { Priority } from "@/lib/types";

const SYSTEM_PROMPT = `Du är expert på att extrahera åtgärdbara issues från mötestranskript för ett team som jobbar med mjukvaruutveckling.

Analysera transkriptet och returnera ett JSON-objekt med:
- "title": en kort, beskrivande mötestitel (max 60 tecken)
- "issues": array av konkreta åtgärdspunkter diskuterade på mötet

Varje issue ska ha:
- "title": konkret, imperativ formulering (max 80 tecken)
- "description": 1-2 meningar med kontext från mötet
- "priority": siffra — 1=Brådskande, 2=Hög, 3=Medium (default), 4=Låg

Regler:
- Bara konkreta åtgärder: buggar, features, förbättringar, tydliga beslut
- Utelämna diskussioner utan klar ägare eller nästa steg
- Max 10 issues, sorterade efter prioritet
- Svara alltid på svenska oavsett transkriptets språk

Returnera exakt detta JSON-schema (inget annat):
{
  "title": "...",
  "issues": [
    { "title": "...", "description": "...", "priority": 3 }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "Inget transkript" }, { status: 400 });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Transkript:\n\n${transcript}` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `OpenAI ${res.status}`);
    }

    const data = await res.json();
    const content = JSON.parse(data.choices[0].message.content);

    const issues = (content.issues ?? []).map(
      (iss: { title: string; description: string; priority: number }, i: number) => ({
        id: `gen-${Date.now()}-${i}`,
        title: iss.title ?? "",
        description: iss.description ?? "",
        priority: ([1, 2, 3, 4].includes(iss.priority) ? iss.priority : 3) as Priority,
        labelIds: [],
        teamId: "",
        status: "draft" as const,
      })
    );

    return NextResponse.json({ title: content.title ?? "Namnlöst möte", issues });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Okänt fel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
