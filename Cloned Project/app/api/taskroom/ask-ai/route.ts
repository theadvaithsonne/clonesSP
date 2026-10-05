import { NextRequest, NextResponse } from "next/server";
import { TASKROOM_API_BASE, getBearerToken } from "@/lib/taskroomServerAuth";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AskAiBody = {
  roomId?: string;
  messages?: ChatMessage[];
};

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

function buildSystemPrompt(stages: any[]) {
  const stageSummary = stages.map((s: any) => ({
    name: s.name,
    stageType: s.stageType,
    taskCount: s.cardData?.length ?? 0,
    tasks: (s.cardData ?? []).map((c: any) => ({
      title: c.title,
      priority: c.priority,
      dueDate: c.dueDate ? new Date(c.dueDate).toLocaleDateString() : null,
      assignees: (c.assigneeData ?? []).map((a: any) => a.name),
      tags: (c.tagData ?? []).map((t: any) => t.name),
      commentCount: c.commentCount ?? 0,
      isOverDue: c.isOverDue,
      description: c.description?.slice(0, 120) || "",
    })),
  }));

  return `You are an AI project management assistant for Taskrooms (by Garage). You have full access to the current project board data and help users understand status, tasks, priorities, blockers, and team assignments.

Current Project Board Data:
${JSON.stringify(stageSummary, null, 2)}

Stage overview:
${stages.map((s: any) => `• ${s.name} (${s.stageType}): ${s.cardData?.length ?? 0} tasks`).join("\n")}

Rules for your responses:
- Be concise and direct — under 250 words unless the user asks for more detail
- Use bullet points with "•" for lists, never markdown asterisks or hyphens
- Do NOT use markdown headers (##, ###) — use plain text section labels if needed
- Reference actual task titles and assignee names from the data
- For "Project Update" requests, give a structured summary: overall health, what is in progress, what is done, urgent/overdue items, and backlog highlights
- For task-specific questions, pull exact details from the data
- If something is not in the data, say so clearly`;
}

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const messages = raw
    .slice(-MAX_MESSAGES)
    .filter(
      (m: any): m is ChatMessage =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim() !== ""
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Sign in to use Ask AI." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key is not configured on the server." }, { status: 503 });
  }

  let body: AskAiBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roomId = body.roomId?.trim();
  if (!roomId || !/^[a-f0-9]{24}$/i.test(roomId)) {
    return NextResponse.json({ error: "A valid roomId is required." }, { status: 400 });
  }
  const messages = sanitizeMessages(body.messages);
  if (!messages) {
    return NextResponse.json({ error: "A user message is required." }, { status: 400 });
  }

  // Loading the board with the caller's token also proves they can see this room.
  let stages: any[] = [];
  try {
    const roomRes = await fetch(
      `${TASKROOM_API_BASE}rooms/detail/${roomId}?page=1&size=30&cardSize=30`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );
    const roomJson = await roomRes.json().catch(() => null);
    if (!roomRes.ok || roomJson?.status === false) {
      const status = roomRes.status === 401 ? 401 : 403;
      return NextResponse.json({ error: roomJson?.message || "You don't have access to this room." }, { status });
    }
    stages = Array.isArray(roomJson?.data) ? roomJson.data : [];
  } catch (err) {
    console.error("[ask-ai] room detail", err);
    return NextResponse.json({ error: "Failed to load the project board." }, { status: 502 });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-2024-11-20",
        temperature: 0.7,
        max_tokens: 600,
        messages: [{ role: "system", content: buildSystemPrompt(stages) }, ...messages],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json();
    if (!res.ok) {
      const message = data?.error?.message || data?.message || "OpenAI request failed.";
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const reply =
      data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't get a response. Please try again.";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[ask-ai]", err);
    return NextResponse.json({ error: "Failed to get a response. Please try again." }, { status: 500 });
  }
}
