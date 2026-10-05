import { NextRequest, NextResponse } from "next/server";
import { verifyTaskroomUser } from "@/lib/taskroomServerAuth";

// Server-side stand-in for the chat-completions calls the legacy taskroom AI
// copilot used to make from the browser with a hard-coded key. The model and
// limits are fixed here so a signed-in caller can't turn it into a general proxy.
const MODEL = "gpt-4o-2024-11-20";
const MAX_TOKENS = 4000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 20_000;

type Role = "system" | "user" | "assistant";

export async function POST(req: NextRequest) {
  const user = await verifyTaskroomUser(req);
  if (!user) {
    return NextResponse.json({ error: { message: "Sign in to use the AI copilot." } }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: { message: "OpenAI API key is not configured on the server." } },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages)
    ? body.messages
        .slice(-MAX_MESSAGES)
        .filter(
          (m: any) =>
            (["system", "user", "assistant"] as Role[]).includes(m?.role) && typeof m?.content === "string"
        )
        .map((m: any) => ({ role: m.role as Role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: { message: "messages are required." } }, { status: 400 });
  }

  const temperature = Math.min(1, Math.max(0, Number(body?.temperature) || 0));
  const maxTokens = Math.min(MAX_TOKENS, Math.max(1, Number(body?.max_tokens) || 1000));

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature,
        max_tokens: maxTokens,
        ...(body?.response_format?.type === "json_object" ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    // Pass OpenAI's response through unchanged so existing callers keep parsing `choices`.
    const data = await res.json().catch(() => ({ error: { message: "Invalid response from OpenAI." } }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[ai-chat]", err);
    return NextResponse.json({ error: { message: "AI request failed. Please try again." } }, { status: 500 });
  }
}
