import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthorizedRequest(req);
    if (!authResult.ok) return authResult.response;

    if (authResult.token.email !== "chasemarshall.f@gmail.com") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 });
    }

    const { entries } = await req.json();
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "No log entries provided" }, { status: 400 });
    }

    const summary = entries.map((e: { user: string; startedAt: number; endedAt: number; durationSeconds: number }) => ({
      user: e.user,
      date: new Date(e.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: new Date(e.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      durationMin: Math.round(e.durationSeconds / 60),
    }));

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          {
            role: "system",
            content: "You are a fun, witty analyst for a family shower coordination app called Water HQ. The family members are Chase, Livia, A.J., Dad, and Mom. Analyze their shower patterns and give 3-5 short, punchy insights. Be playful and specific. Use data to back up claims. Keep each insight to 1-2 sentences. No markdown formatting — plain text with emoji allowed.",
          },
          {
            role: "user",
            content: `Here are the shower logs from the last 30 days:\n\n${JSON.stringify(summary, null, 2)}\n\nWhat patterns and fun insights do you see?`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "No insights available.";

    return NextResponse.json({ insights: text });
  } catch (err) {
    console.error("analytics-insights error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
