import type { Chapter } from "../types";

export const ai: Chapter = {
  slug: "ai",
  number: 11,
  title: "AI employees",
  part: "AI",
  blurb:
    "Agents you hire, brief with context, connect to your tools, and put on a schedule — plus what any of it costs.",
  blocks: [
    {
      type: "prose",
      text: [
        "An AI employee is an agent with a job, a body of knowledge, a set of tools it can reach, and a schedule. The system behind it is called **OpenClaw**, and its pages sit in the workspace next to the human ones.",
      ],
    },
    {
      type: "flow",
      flow: {
        title: "Hiring an AI employee",
        steps: [
          { label: "Pick one from the marketplace", actor: "OpenClawMarketplacePage", kind: "start", detail: "Or start from a template and instantiate it." },
          { label: "Give it context", actor: "Context Library", detail: "Uploaded documents, manually written contexts, or pulled from a connected third-party source." },
          { label: "Connect integrations", actor: "Integrations", detail: "Gmail, Notion, the Garage feed. Each connection is tested before it is trusted." },
          { label: "Assign work", kind: "decision", branches: [
            { on: "On demand", steps: [{ label: "Chat with it", actor: "OpenClawChatPage" }] },
            { on: "On a schedule", steps: [{ label: "Create a job", actor: "Jobs", detail: "A cron expression, rendered in English by `cronstrue`." }] },
            { on: "As a task", steps: [{ label: "Hand it a task", actor: "Tasks", detail: "With issues it can raise back for a human to resolve." }] },
          ] },
          { label: "Watch it work", actor: "Activity & analytics", kind: "end", detail: "Heartbeats, run history, per-agent analytics." },
        ],
      },
    },
    { type: "heading", id: "agents", text: "Agents" },
    {
      type: "prose",
      text: [
        "`/api/openclaw/agent` creates and lists agents; each has an id, assignments, an activity log and a heartbeat that tells you whether it is actually alive. Group conversations can include several agents, with `group-agent-reply` deciding which one answers.",
      ],
    },
    { type: "heading", id: "contexts", text: "Contexts" },
    {
      type: "prose",
      text: [
        "A context is a piece of knowledge an agent can draw on. There are two kinds, kept deliberately separate because they are maintained differently.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Manual contexts", def: "Written or uploaded by you — `upload-document` ingests a file. You own them and they change when you change them." },
        { term: "Third-party contexts", def: "Pulled from a connected provider. Listed per provider, assigned to agents individually, and tracked to completion." },
        { term: "Assignment", def: "Contexts are assigned and unassigned per agent, so two agents can share a knowledge base without sharing a brief." },
        { term: "RAM", def: "`contexts/ram/context/active` and `contexts/ram/task/[taskId]` expose what an agent is holding in working memory right now — the answer to \"why did it say that\"." },
      ],
    },
    { type: "heading", id: "integrations", text: "Integrations" },
    {
      type: "prose",
      text: [
        "Integrations are the tools an agent can actually use. Each has a connection, a log of what it did, a test endpoint, and a list of agents not yet connected to it. The skills currently wired are **Gmail**, **Notion**, and the **Garage feed**.",
      ],
    },
    { type: "heading", id: "jobs-tasks", text: "Jobs and tasks" },
    {
      type: "prose",
      text: [
        "A **job** is recurring: a cron schedule, a run history, and a toggle to pause it. Each run expands to show what happened. A **task** is a single unit of work; when the agent gets stuck it raises an **issue** against a specific step, and `issues/[issueIndex]/resolve` is how a human unblocks it rather than restarting the whole task.",
      ],
    },
    { type: "heading", id: "qa", text: "Public Q&A agents" },
    {
      type: "prose",
      text: [
        "`/qa/[agentId]` puts one agent on the open internet with no login at all. Branding and the welcome message are fetched client-side so the route itself stays trivial. It is the simplest way to turn an internal agent into a public support desk.",
      ],
    },
    { type: "heading", id: "providers", text: "AI providers" },
    {
      type: "prose",
      text: [
        "An organisation brings its own model keys. Three providers are supported — **Google Gemini**, **OpenAI**, and **Anthropic (Claude)** — stored per organisation through `/founder-ai-providers/keys`. `AIProviderRequiredModal` blocks AI features when no key is configured, rather than letting them fail at the point of use.",
      ],
    },
    { type: "heading", id: "ai-billing", text: "What it costs" },
    {
      type: "prose",
      text: [
        "AI usage has its own billing surface under `/api/billing/*`: current-month spend, the last seven days, twelve months of history, and breakdowns by agent, by model and by user. Agents can be individually unlocked against a subscription, and `OpenClawBillingPage` and its wallet endpoints handle paying for them — including creating and verifying a payment order.",
      ],
    },
    { type: "heading", id: "elsewhere", text: "AI elsewhere in the app" },
    {
      type: "spec",
      items: [
        { term: "Ask Cabinet", def: "Analysis of files and session recordings. See chapter 7." },
        { term: "Taskroom descriptions", def: "`/api/taskroom/generate-description` drafts a task body from its title." },
        { term: "Betty", def: "`BettyAssistant` and `BettyDashboardPage` — an assistant surfaced in the dashboard." },
        { term: "Copilot", def: "A context provider (`lib/copilot/context.tsx`) that gives assistants the current page's situation." },
        { term: "AI Office", def: "An additional management tab for organisations running agents alongside employees." },
      ],
    },
  ],
};
