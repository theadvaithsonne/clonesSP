import { Schema, model } from "mongoose";

const OpenClawAgentSchema = new Schema(
  {
    agentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    role: { type: String, default: "" },
    emoji: { type: String, default: "" },
    // Agent type discriminator — mirrors agent_registry.agent_type on
    // OpenClawApi. Default preserves historical behavior for legacy docs
    // that were created before this field existed.
    agentType: {
      type: String,
      enum: ["default", "qa", "voice"],
      default: "default",
    },
    // Q&A-specific settings. Only meaningful when agentType === "qa" but
    // we don't enforce that — founders can flip an agent between types
    // without losing their Q&A config.
    qaWelcomeMessage: { type: String, default: "" },
    qaPersonaInstructions: { type: String, default: "" },
    qaPageTitle: { type: String, default: "" },
    qaPageSubtitle: { type: String, default: "" },
    // Per-agent LLM model (e.g. "openai/gpt-4o", "anthropic/claude-sonnet-4-5").
    // Picked at create time and locked — PATCH never updates this field.
    // Mirrors agent_registry.llm_model on OpenClawApi.
    llmModel: {
      type: String,
      enum: [
        "openai/gpt-5.1",
        "openai/gpt-4.1",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "anthropic/claude-opus-4-5",
        "anthropic/claude-sonnet-4-5",
        "anthropic/claude-haiku-4-5",
      ],
      default: null,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Soft-delete timestamp. `null` / missing = active.
    // When set, the doc is hidden from list/get by default but kept in
    // MongoDB so the agent can be restored later via POST /openclaw-agent/:id/restore.
    // Mirrors the `deleted_at` column on OpenClawApi's agent_registry table.
    deletedAt: { type: Date, default: null, index: true },
    // Employees who have been explicitly granted access to this agent by
    // the founder. Empty array means founder-exclusive — no employee sees
    // the agent in their list. Founders of the agent's org always see all
    // agents in their org regardless of this field.
    assignedUserIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

OpenClawAgentSchema.index({ orgId: 1 });
OpenClawAgentSchema.index({ createdBy: 1 });
OpenClawAgentSchema.index({ orgId: 1, deletedAt: 1 });

export const OpenClawAgent = model("OpenClawAgent", OpenClawAgentSchema);
