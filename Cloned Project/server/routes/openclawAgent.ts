import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth, requireFounder } from "../middleware/auth";
import { OpenClawAgent } from "../models/openclawAgent.model";
import { callOpenClaw } from "../utils/openclaw";

const router = Router();

// GET /openclaw-agent — list active agents for the user's current org.
// Soft-deleted docs (deletedAt != null) are hidden by default. Pass
// ?include_deleted=1 to include them (e.g. for an admin "trash" view).
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const orgId = req.query.org_id || req.user.orgId;
    if (!orgId) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const includeDeleted = req.query.include_deleted === "1"
      || req.query.include_deleted === "true";

    // Visibility is driven entirely by the local `deletedAt` field now.
    // We still fetch subscription statuses so the UI can render the
    // "locked" badge if the subscription model is enforced — but the
    // list is no longer gated on subscription.status == "deleted".
    const mongoFilter: Record<string, any> = { orgId };
    if (!includeDeleted) {
      mongoFilter.deletedAt = null;
    }
    // RBAC: founders of the org see every agent. Employees see only
    // agents that explicitly include their userId in assignedUserIds.
    if (req.user.role !== "founder") {
      mongoFilter.assignedUserIds = new Types.ObjectId(req.user.userId);
    }

    const [agents, subsRes] = await Promise.all([
      OpenClawAgent.find(mongoFilter).populate("createdBy", "name email").lean(),
      callOpenClaw(`/api/billing/subscriptions`, "GET", {
        query: { org_id: orgId, include_deleted: "true" },
        user: req.user,
      })
        .then((r) => {
          if (r.status < 200 || r.status >= 300) {
            console.error(`[OpenClawAgent] Subscription fetch failed: ${r.status}`);
            return [];
          }
          return r.data;
        })
        .catch((err) => {
          console.error("[OpenClawAgent] Subscription fetch error:", err.message || err);
          return [];
        }),
    ]);

    const subStatusMap: Record<string, string> = {};
    if (Array.isArray(subsRes)) {
      for (const s of subsRes) {
        subStatusMap[s.agent_id] = s.status;
      }
    }

    return res.json({
      agents: agents.map((a: any) => ({
        agent_id: a.agentId,
        name: a.name,
        role: a.role || "",
        emoji: a.emoji || "",
        org_id: a.orgId,
        created_by: a.createdBy,
        created_at: a.createdAt,
        deleted_at: a.deletedAt || null,
        subscription_status: subStatusMap[a.agentId] || "active",
        agent_type: a.agentType || "default",
        qa_welcome_message: a.qaWelcomeMessage || null,
        qa_persona_instructions: a.qaPersonaInstructions || null,
        qa_page_title: a.qaPageTitle || null,
        qa_page_subtitle: a.qaPageSubtitle || null,
        llm_model: a.llmModel || null,
        assigned_user_ids: (a.assignedUserIds || []).map((id: any) => id.toString()),
      })),
    });
  } catch (err) {
    console.error("[OpenClawAgent] GET error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /openclaw-agent — create agent scoped to an org. Founder-only.
router.post("/", requireAuth, requireFounder, async (req: any, res: any) => {
  try {
    const {
      name,
      soul,
      identity,
      emoji,
      agent_type,
      qa_welcome_message,
      qa_persona_instructions,
      qa_page_title,
      qa_page_subtitle,
      llm_model,
    } = req.body;
    const org_id = req.body.org_id || req.user.orgId;
    const role = req.body.role?.trim() || "";

    if (!name?.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!role) {
      return res.status(400).json({ error: "role is required" });
    }
    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
    }

    // Normalize agent_type — only "default", "qa", "voice" are valid.
    // Unknown values fall back to "default" to stay forward-compatible
    // with older clients.
    const ALLOWED_TYPES = ["default", "qa", "voice"] as const;
    const normalizedType: "default" | "qa" | "voice" =
      ALLOWED_TYPES.includes(agent_type) ? agent_type : "default";

    // LLM model selection — required, picked by the user at create time.
    // Allowed values mirror the openclaw gateway allowlist
    // (agents.defaults.models in openclaw.json). Reject anything else
    // here so we fail fast with 400 instead of the gateway 500'ing mid-chat.
    const ALLOWED_LLM_MODELS = [
      "openai/gpt-5.1",
      "openai/gpt-4.1",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "anthropic/claude-opus-4-5",
      "anthropic/claude-sonnet-4-5",
      "anthropic/claude-haiku-4-5",
    ] as const;
    if (!llm_model || !ALLOWED_LLM_MODELS.includes(llm_model)) {
      return res.status(400).json({
        error: `llm_model is required and must be one of ${ALLOWED_LLM_MODELS.join(", ")}`,
      });
    }

    const suffix = Math.random().toString(16).slice(2, 8);
    const agentId = `garage${req.user.userId}${suffix}`;
    const user_id = req.user.userId;

    const r = await callOpenClaw(`/api/agents`, "POST", {
      user: req.user,
      body: {
        agent_id: agentId,
        name: name.trim(),
        role: role.trim(),
        ...(soul ? { soul } : {}),
        ...(identity ? { identity } : {}),
        ...(org_id ? { org_id } : {}),
        ...(user_id ? { user_id } : {}),
        agent_type: normalizedType,
        ...(qa_welcome_message ? { qa_welcome_message } : {}),
        ...(qa_persona_instructions ? { qa_persona_instructions } : {}),
        ...(qa_page_title ? { qa_page_title } : {}),
        ...(qa_page_subtitle ? { qa_page_subtitle } : {}),
        llm_model,
      },
    });

    if (r.status < 200 || r.status >= 300) {
      console.error("[OpenClawAgent] Create error:", r.status, r.data);
      // Forward 402 (payment) and 409 (conflict) errors as-is
      const forwardStatus = [402, 409].includes(r.status) ? r.status : 502;
      return res
        .status(forwardStatus)
        .json({ error: "Agent Manager error", detail: r.data?.detail || r.data });
    }

    const agent = await OpenClawAgent.create({
      agentId,
      name: name.trim(),
      role: role.trim(),
      emoji: emoji || "",
      orgId: org_id,
      createdBy: req.user.userId,
      agentType: normalizedType,
      qaWelcomeMessage: qa_welcome_message || "",
      qaPersonaInstructions: qa_persona_instructions || "",
      qaPageTitle: qa_page_title || "",
      qaPageSubtitle: qa_page_subtitle || "",
      llmModel: llm_model,
    });

    return res.status(201).json({
      agent: {
        agent_id: agent.agentId,
        name: agent.name,
        role: agent.role,
        emoji: agent.emoji,
        org_id: agent.orgId,
        created_by: agent.createdBy,
        agent_type: (agent as any).agentType,
        qa_welcome_message: (agent as any).qaWelcomeMessage || null,
        qa_persona_instructions: (agent as any).qaPersonaInstructions || null,
        qa_page_title: (agent as any).qaPageTitle || null,
        qa_page_subtitle: (agent as any).qaPageSubtitle || null,
        llm_model: (agent as any).llmModel || null,
      },
    });
  } catch (err) {
    console.error("[OpenClawAgent] POST error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /openclaw-agent/:agentId — update agent (org_id is immutable). Founder-only.
router.patch("/:agentId", requireAuth, requireFounder, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const orgId = req.user.orgId;

    const entry = await OpenClawAgent.findOne({ agentId, orgId });
    if (!entry) return res.status(404).json({ error: "Agent not found" });

    const {
      name,
      role,
      soul,
      identity,
      emoji,
      agent_type,
      qa_welcome_message,
      qa_persona_instructions,
      qa_page_title,
      qa_page_subtitle,
      llm_model,
    } = req.body;

    // Validate llm_model if present. Same allowlist as create — keep
    // them in lockstep.
    const ALLOWED_LLM_MODELS = [
      "openai/gpt-5.1",
      "openai/gpt-4.1",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "anthropic/claude-opus-4-5",
      "anthropic/claude-sonnet-4-5",
      "anthropic/claude-haiku-4-5",
    ] as const;
    if (llm_model !== undefined && !ALLOWED_LLM_MODELS.includes(llm_model)) {
      return res.status(400).json({
        error: `llm_model must be one of ${ALLOWED_LLM_MODELS.join(", ")}`,
      });
    }

    // Fields that go to agent-manager
    const updateBody: Record<string, string> = {};
    if (name !== undefined) updateBody.name = name;
    if (role !== undefined) updateBody.role = role;
    if (soul !== undefined) updateBody.soul = soul;
    if (identity !== undefined) updateBody.identity = identity;
    if (agent_type !== undefined) updateBody.agent_type = agent_type;
    if (qa_welcome_message !== undefined) updateBody.qa_welcome_message = qa_welcome_message;
    if (qa_persona_instructions !== undefined) updateBody.qa_persona_instructions = qa_persona_instructions;
    if (qa_page_title !== undefined) updateBody.qa_page_title = qa_page_title;
    if (qa_page_subtitle !== undefined) updateBody.qa_page_subtitle = qa_page_subtitle;
    if (llm_model !== undefined) updateBody.llm_model = llm_model;

    // Only call agent-manager if there are fields it cares about
    if (Object.keys(updateBody).length > 0) {
      const r = await callOpenClaw(`/api/agents/${agentId}`, "PATCH", {
        user: req.user,
        body: updateBody,
      });

      if (r.status < 200 || r.status >= 300) {
        console.error("[OpenClawAgent] PATCH error:", r.status, r.data);
        return res
          .status(502)
          .json({ error: "Agent Manager error", detail: r.data });
      }
    }

    // Update local MongoDB fields
    if (name !== undefined) entry.name = name.trim();
    if (role !== undefined) (entry as any).role = role.trim();
    if (emoji !== undefined) (entry as any).emoji = emoji;
    if (agent_type !== undefined && ["default", "qa", "voice"].includes(agent_type)) {
      (entry as any).agentType = agent_type;
    }
    if (qa_welcome_message !== undefined) (entry as any).qaWelcomeMessage = qa_welcome_message;
    if (qa_persona_instructions !== undefined) (entry as any).qaPersonaInstructions = qa_persona_instructions;
    if (qa_page_title !== undefined) (entry as any).qaPageTitle = qa_page_title;
    if (qa_page_subtitle !== undefined) (entry as any).qaPageSubtitle = qa_page_subtitle;
    if (llm_model !== undefined) (entry as any).llmModel = llm_model;
    await entry.save();

    return res.json({
      agent: {
        agent_id: entry.agentId,
        name: entry.name,
        role: (entry as any).role || "",
        emoji: (entry as any).emoji || "",
        org_id: entry.orgId,
        created_by: entry.createdBy,
        agent_type: (entry as any).agentType || "default",
        qa_welcome_message: (entry as any).qaWelcomeMessage || null,
        qa_persona_instructions: (entry as any).qaPersonaInstructions || null,
        qa_page_title: (entry as any).qaPageTitle || null,
        qa_page_subtitle: (entry as any).qaPageSubtitle || null,
        llm_model: (entry as any).llmModel || null,
      },
    });
  } catch (err) {
    console.error("[OpenClawAgent] PATCH error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /openclaw-agent/:agentId — soft-delete agent within the user's org.
//
// Visibility is now gated by the local `deletedAt` field (and mirrored
// on the OpenClawApi side by `agent_registry.deleted_at`). Soft-delete
// preserves the doc in MongoDB so the agent can be restored via
// POST /openclaw-agent/:agentId/restore without losing chat history,
// identity, or ownership.
router.delete("/:agentId", requireAuth, requireFounder, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const orgId = req.query.org_id || req.user.orgId;

    const entry = await OpenClawAgent.findOne({ agentId, orgId });
    if (!entry) return res.status(404).json({ error: "Agent not found" });

    // Forward the delete to agent-manager first. 404 upstream means
    // the agent is already gone — still soft-delete our doc to keep
    // the two sides consistent.
    const upstream = await callOpenClaw(`/api/agents/${agentId}`, "DELETE", {
      user: req.user,
      query: { org_id: orgId },
    });
    if (upstream.status >= 400 && upstream.status !== 404) {
      console.error(
        `[OpenClawAgent] agent-manager delete failed: ${upstream.status}`,
        upstream.data,
      );
      return res.status(upstream.status).json({
        error: "agent_manager_delete_failed",
        detail: upstream.data,
      });
    }

    // Stamp deletedAt on the local MongoDB doc. The doc stays in the
    // collection so a future POST /openclaw-agent/:id/restore can
    // recover it — both here and on the OpenClawApi side.
    await OpenClawAgent.updateOne(
      { agentId, orgId },
      { $set: { deletedAt: new Date() } },
    );

    return res.json({ ok: true, agent_id: agentId });
  } catch (err) {
    console.error("[OpenClawAgent] DELETE error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /openclaw-agent/:agentId/restore — recover a previously
// soft-deleted agent within the user's org.
router.post("/:agentId/restore", requireAuth, requireFounder, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const orgId = req.query.org_id || req.user.orgId;

    // Find the doc even if it's soft-deleted — include the filter
    // explicitly so `deletedAt` being set doesn't hide it.
    const entry = await OpenClawAgent.findOne({ agentId, orgId });
    if (!entry) return res.status(404).json({ error: "Agent not found" });
    if (!entry.deletedAt) {
      return res.status(200).json({ ok: true, agent_id: agentId, already_active: true });
    }

    // Forward the restore to agent-manager. If the upstream restore
    // fails we refuse to clear our own deletedAt — otherwise the two
    // sides would drift (our doc visible, theirs still deleted).
    const upstream = await callOpenClaw(`/api/agents/${agentId}/restore`, "POST", {
      user: req.user,
      query: { org_id: orgId },
    });
    if (upstream.status >= 400) {
      console.error(
        `[OpenClawAgent] agent-manager restore failed: ${upstream.status}`,
        upstream.data,
      );
      return res.status(upstream.status).json({
        error: "agent_manager_restore_failed",
        detail: upstream.data,
      });
    }

    await OpenClawAgent.updateOne(
      { agentId, orgId },
      { $set: { deletedAt: null } },
    );

    return res.json({ ok: true, agent_id: agentId });
  } catch (err) {
    console.error("[OpenClawAgent] RESTORE error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /openclaw-agent/:agentId/assignments — list employees currently
// granted access to this agent. Founder-only (employees shouldn't see
// who else has access).
router.get("/:agentId/assignments", requireAuth, requireFounder, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const orgId = req.user.orgId;
    const agent = await OpenClawAgent.findOne({ agentId, orgId }).select("assignedUserIds").lean();
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    return res.json({
      agent_id: agentId,
      assigned_user_ids: (agent.assignedUserIds || []).map((id: any) => id.toString()),
    });
  } catch (err) {
    console.error("[OpenClawAgent] GET assignments error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /openclaw-agent/:agentId/assignments — replace the assignment
// list. Body: { user_ids: string[] }. Founder-only.
//
// Semantics: passing [] = founder-exclusive (no employee sees it).
// Any id not in the agent's org is silently dropped — we intersect the
// provided list with actual org members before saving, so you can't
// accidentally grant access to outsiders by pasting the wrong ids.
router.put("/:agentId/assignments", requireAuth, requireFounder, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const orgId = req.user.orgId;
    const { user_ids } = req.body ?? {};
    if (!Array.isArray(user_ids)) {
      return res.status(400).json({ error: "user_ids[] is required" });
    }

    const agent = await OpenClawAgent.findOne({ agentId, orgId });
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    // Intersect with actual org members. A user counts as a member if
    // any of their organizations[] entries references this org.
    const { User } = await import("../models/user.model");
    const validIds = await User.find({
      _id: { $in: user_ids.filter((s: unknown) => typeof s === "string") },
      $or: [
        { organization: orgId },
        { "organizations.organization": orgId },
      ],
    }).select("_id").lean();
    const validObjectIds = validIds.map((u: any) => u._id);

    (agent as any).assignedUserIds = validObjectIds;
    await agent.save();

    return res.json({
      agent_id: agentId,
      assigned_user_ids: validObjectIds.map((id: any) => id.toString()),
      dropped: user_ids.length - validObjectIds.length,
    });
  } catch (err) {
    console.error("[OpenClawAgent] PUT assignments error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
