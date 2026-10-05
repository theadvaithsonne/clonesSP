import { Router, Response } from "express";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";

/**
 * The "Support Agent" dashboard's data — everything scoped to the SIGNED-IN
 * admin, not a chosen one. Any garage admin may call it (they only ever see
 * their own assignments), so it's an ALWAYS_ALLOWED path rather than a
 * page-gated one.
 *
 * "Assigned affiliates" are the users carrying this admin as their
 * assignedSupportAgentId — the same field One Time Affiliates and NetworkChain
 * Subs set. The agent's job is then visible at a glance: who they support, who
 * still needs an NVC chat, and who has converted to a subscriber.
 */
const router = Router();

router.get(
  "/support/my-assignments",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const agentId = req.garageAdmin?.id;
      if (!agentId || !Types.ObjectId.isValid(agentId)) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const users = await User.find({
        assignedSupportAgentId: new Types.ObjectId(agentId),
      })
        .select(
          "name email phone profilePicture country city state createdAt assignedSupportAgentAt nvcChatCreatedAt"
        )
        .sort({ assignedSupportAgentAt: -1 })
        .lean();

      const ids = users.map((u) => u._id);

      // NetworkChain-subscriber flag — the same signal One Time Affiliates
      // uses: any parent recurring third-party subscription invoice that isn't
      // cancelled counts as a subscriber.
      const subHolders = ids.length
        ? await Invoice.find(
            {
              userId: { $in: ids },
              isRecurring: true,
              parentInvoiceId: { $exists: false },
              "lineItems.itemType": "third_party_subscription",
              cancelledAt: { $exists: false },
              $or: [
                { "metadata.kind": { $exists: false } },
                { "metadata.kind": { $ne: "topup" } },
              ],
            },
            { userId: 1 }
          ).lean()
        : [];
      const subscribers = new Set(subHolders.map((i: any) => String(i.userId)));

      const affiliates = users.map((u) => {
        const key = String(u._id);
        return {
          userId: key,
          user: {
            _id: key,
            name: u.name || null,
            email: u.email || null,
            phone: u.phone || null,
            profilePicture: u.profilePicture || null,
            country: u.country || null,
          },
          location: {
            city: u.city || null,
            state: u.state || null,
            country: u.country || null,
          },
          joinedAt: u.createdAt || null,
          assignedAt: (u as any).assignedSupportAgentAt || null,
          hasNvcChat: !!(u as any).nvcChatCreatedAt,
          isNetworkChainSubscriber: subscribers.has(key),
        };
      });

      const nvcDone = affiliates.filter((a) => a.hasNvcChat).length;

      return res.json({
        agent: {
          id: agentId,
          name: req.garageAdmin?.name || null,
          email: req.garageAdmin?.email || null,
          role: req.garageAdmin?.role || null,
        },
        stats: {
          assigned: affiliates.length,
          nvcDone,
          nvcPending: affiliates.length - nvcDone,
          subscribers: affiliates.filter((a) => a.isNetworkChainSubscriber)
            .length,
        },
        affiliates,
      });
    } catch (err) {
      console.error("[garage-admin/support/my-assignments] error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

export default router;
