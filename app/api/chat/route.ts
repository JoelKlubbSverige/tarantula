import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Du är Tarantulas mötesassistent. Du hjälper användaren analysera mötestranskript och skapa Linear issues.

Svara alltid på svenska. Håll svaren korta och konkreta — detta är en liten chattruta.

═══════════════════════════════════
REGLER FÖR ISSUES
═══════════════════════════════════

NÄR användaren ber dig skapa, lägga till, strukturera eller föreslå issues — gör det DIREKT utan att fråga om bekräftelse.
Presentera issues kortfattat i texten OCH avsluta alltid med markören nedan.

NÄR användaren ställer en fråga eller vill ha en sammanfattning utan att be om issues — svara bara med text, ingen markör.

MARKÖREN (lägg ALLTID till denna när du skapar issues, INGEN text efter):
<!--LINEAR:[
  {"title":"Issue-titel på svenska","description":"Beskrivning på svenska av vad som ska göras.","priority":2}
]-->

VIKTIGT: title och description i markören ska ALLTID vara på svenska.

Priority: 1=Brådskande, 2=Hög, 3=Medium, 4=Låg. Max 8 issues.

Exempel på NÄR du ska inkludera markören:
- "Lägg till dessa issues" → JA, inkludera markören
- "Strukturera mötet som issues" → JA, inkludera markören
- "Ja, lägg även till X" → JA, inkludera markören med ALLA issues (gamla + nya)
- "Skicka dem" → JA, inkludera markören
- "Kan du sammanfatta mötet?" → NEJ, bara text
- "Vad handlade mötet om?" → NEJ, bara text
`;

export async function POST(req: NextRequest) {
  try {
    const { messages, transcript, currentIssues } = await req.json();

    const context = [
      transcript?.trim()
        ? `Transkript:\n${transcript}`
        : "Inget transkript tillgängligt.",
      currentIssues?.length
        ? `\nBefintliga issues (redan tillagda i review):\n${currentIssues.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `OpenAI ${res.status}`);
    }

    const data = await res.json();
    const raw: string = data.choices[0].message.content ?? "";

    // Parse <!--LINEAR:[...]-->
    const linearMatch = raw.match(/<!--LINEAR:([\s\S]*?)-->/);
    let linearIssues = null;
    let message = raw;

    if (linearMatch) {
      try {
        linearIssues = JSON.parse(linearMatch[1].trim());
      } catch { /* ignore parse error */ }
      message = raw.replace(/<!--LINEAR:[\s\S]*?-->/, "").trimEnd();
    }

    return NextResponse.json({ message, linearIssues });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Okänt fel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
