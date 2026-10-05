import { NextRequest, NextResponse } from "next/server";
import { verifyTaskroomUser } from "@/lib/taskroomServerAuth";

type GenerateDescriptionBody = {
  taskName?: string;
  workspaceName?: string;
  spaceName?: string;
  roomName?: string;
  taskType?: "task" | "subtask";
};

function buildSystemPrompt({
  taskName,
  workspaceName,
  spaceName,
  roomName,
  taskType,
}: Required<Pick<GenerateDescriptionBody, "taskName">> & GenerateDescriptionBody) {
  const contextLines = [
    workspaceName ? `Workspace: ${workspaceName}` : null,
    spaceName ? `Space: ${spaceName}` : null,
    roomName ? `Room: ${roomName}` : null,
    `Task name: ${taskName}`,
    taskType ? `Type: ${taskType === "subtask" ? "Subtask" : "Task"}` : null,
  ].filter(Boolean);

  return `You are a helpful project management assistant. Write a clear, professional description for a task in a team workspace.

Context:
${contextLines.join("\n")}

Rules:
- Write 2–4 concise sentences or short bullet points using "•"
- Be specific to the task name and workspace context
- Focus on objective, scope, and expected outcome
- Use plain text only — no markdown headers, no code blocks
- Keep it under 180 words
- Do not invent assignees, dates, or details not implied by the task name`;
}

export async function POST(req: NextRequest) {
  const user = await verifyTaskroomUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in to generate descriptions." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured on the server." },
      { status: 503 }
    );
  }

  let body: GenerateDescriptionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const taskName = body.taskName?.trim();
  if (!taskName) {
    return NextResponse.json({ error: "Task name is required." }, { status: 400 });
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
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({ ...body, taskName }),
          },
          {
            role: "user",
            content: `Write a task description for "${taskName}".`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json();

    if (!res.ok) {
      const message =
        data?.error?.message || data?.message || "OpenAI request failed.";
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const description =
      data.choices?.[0]?.message?.content?.trim() ||
      "Could not generate a description. Please try again.";

    return NextResponse.json({ description });
  } catch (err) {
    console.error("[generate-description]", err);
    return NextResponse.json(
      { error: "Failed to generate description. Please try again." },
      { status: 500 }
    );
  }
}
