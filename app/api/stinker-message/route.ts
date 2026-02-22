import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthorizedRequest(req);
    if (!authResult.ok) return authResult.response;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const { user, daysSince } = await req.json();
    if (!user || typeof daysSince !== "number") {
      return NextResponse.json({ error: "Missing user or daysSince" }, { status: 400 });
    }

    const isChase = user === "Chase";
    const model = isChase ? "x-ai/grok-4.1-fast" : "google/gemini-2.0-flash-001";
    const systemPrompt = isChase
      ? "You generate a single short, ruthlessly savage message roasting a 15-year-old named Chase for not showering. Go absolutely unhinged — no mercy, no filter. Think Xbox lobby meets Comedy Central roast. Be brutal but ultimately funny. Output ONLY a JSON object with three fields: emoji (a single creative emoji — NEVER use 🦨, pick something unexpected and savage), title (2-4 words, ALL CAPS), body (1-2 sentences, savage and funny). No markdown, no code fences, just the raw JSON object."
      : "You generate a single short, funny, snarky message shaming someone for not showering. The message is for a family shower coordination app called Water HQ. Be playful and creative — think sibling roast energy. Output ONLY a JSON object with three fields: emoji (a single creative emoji — NEVER use 🦨, pick something unexpected and funny like 🧀🥦🗑️🪳🧟💩🌵🐀🧄🫠 or anything else creative), title (2-4 words, ALL CAPS), body (1 sentence, casual tone). No markdown, no code fences, just the raw JSON object.";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${user} hasn't showered in ${daysSince} days. Generate a unique, funny shame message.`,
          },
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        emoji: parsed.emoji ?? "🦨",
        title: parsed.title ?? "SERIOUSLY?!",
        body: parsed.body ?? "Go shower already.",
      });
    } catch {
      // If JSON parsing fails entirely, treat the raw text as the body
      return NextResponse.json({
        emoji: "🦨",
        title: "SERIOUSLY?!",
        body: raw.replace(/[{}"\n]/g, "").slice(0, 120) || "Go shower already.",
      });
    }
  } catch (err) {
    console.error("stinker-message error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
