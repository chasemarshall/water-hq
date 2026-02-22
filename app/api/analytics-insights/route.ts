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

    const { entries, spicy, followUpMessages } = await req.json();
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "No log entries provided" }, { status: 400 });
    }

    // Sort entries newest first so the model sees recent data prominently
    const sorted = [...entries].sort(
      (a: { startedAt: number }, b: { startedAt: number }) => b.startedAt - a.startedAt
    );

    const summary = sorted.map((e: { user: string; startedAt: number; endedAt: number; durationSeconds: number }) => ({
      user: e.user,
      date: new Date(e.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" }),
      time: new Date(e.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }),
      durationMin: Math.round(e.durationSeconds / 60),
    }));

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

    const systemPrompt = spicy
      ? `You are a ruthlessly sarcastic, no-holds-barred roast comedian analyzing a family's shower habits for their app Water HQ. Today is ${today}. The family members are Chase (15), Livia (10), A.J. (20), Dad (53), and Mom (50). The data is sorted newest first — focus heavily on the most recent days and patterns. Roast everyone. Be savage but ultimately loving — think family roast at Thanksgiving. Call people out by name. Reference specific recent dates and times. 3-5 brutal observations. Short and punchy. No markdown — plain text with emoji allowed. Go OFF. example: Bro must've been doing sus things. if the shower was long`
      : `You are a fun, witty analyst for a family shower coordination app called Water HQ. Today is ${today}. The family members are Chase, Livia, A.J., Dad, and Mom. The data is sorted newest first — prioritize recent patterns and trends. Analyze their shower patterns and give 3-5 short, punchy insights. Be playful and specific. Use data to back up claims. Keep each insight to 1-2 sentences. No markdown formatting — plain text with emoji allowed.`;

    const model = spicy ? "x-ai/grok-4.1-fast" : "google/gemini-2.0-flash-001";

    // Build messages array — initial request or follow-up conversation
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (Array.isArray(followUpMessages) && followUpMessages.length > 0) {
      // Conversation continuation — inject data context as first user message, then replay history
      messages.push({
        role: "user",
        content: `Here are the shower logs from the last 30 days:\n\n${JSON.stringify(summary, null, 2)}\n\nWhat patterns and fun insights do you see?`,
      });
      for (const msg of followUpMessages) {
        if (msg.role === "assistant" || msg.role === "user") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    } else {
      // Initial request
      messages.push({
        role: "user",
        content: `Here are the shower logs from the last 30 days:\n\n${JSON.stringify(summary, null, 2)}\n\nWhat patterns and fun insights do you see?`,
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
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
