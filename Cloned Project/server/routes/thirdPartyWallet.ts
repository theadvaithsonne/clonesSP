import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import {
  requireThirdPartyApiKey,
  requireScope,
} from "../middleware/thirdPartyAuth";
import { IThirdPartyClient } from "../models/thirdPartyClient.model";
import { User } from "../models/user.model";
import { creditStoreWalletExternal } from "../services/wallet";

/**
 * Partner-facing wallet credits.
 *
 * This is the only way money leaves the platform to a user under an API key,
 * and it exists because the first-party route cannot serve the case:
 * `/wallet/store/credit` is `requireAuth, requireOrgAdmin`, which proves *which
 * signed-in human* is calling. A partner settling a completed job has no human
 * in the loop — the recipient tapped a button, and the recipient must never be
 * the one authorising their own payment.
 *
 * The alternative a partner might reach for, minting a user token from the
 * shared JWT secret, is precisely what this prevents: it would work, leave no
 * audit trail distinguishing the service from that person, and turn a leaked
 * secret into account takeover instead of one revocable key.
 *
 * Mounted under /api/v1/third-party alongside the invoice routes.
 */

const router = Router();

router.use(requireThirdPartyApiKey);

function getClient(req: Request): IThirdPartyClient {
  return (req as any).thirdPartyClient as IThirdPartyClient;
}

const creditSchema = z.object({
  /** Identify the recipient by either. Email is the friendlier key for a
   *  partner that never stores Garage ids. */
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),

  /**
   * Minor units — paise for INR, cents for USD. Integers only.
   *
   * A partner sending a float would eventually send 8.174999999999999, and
   * money that cannot be written down exactly should not be transmitted at all.
   */
  amountMinor: z.number().int().positive(),

  /** ISO-4217. Required and never defaulted: a wallet is per-currency, and
   *  guessing here credits the wrong ledger silently. */
  currency: z.string().length(3).toUpperCase(),

  /**
   * Stable per credit, chosen by the partner (e.g. "homeease:booking:HEAB12CD").
   * Replays return the original transaction instead of paying twice.
   */
  dedupeKey: z.string().min(6).max(200),

  description: z.string().min(1).max(500),
  note: z.string().max(1000).optional(),

  /** Defaults to the client's configured platform org. */
  orgId: z.string().optional(),
});

/**
 * POST /api/v1/third-party/wallet/credit
 *
 * Idempotent. Calling twice with the same `dedupeKey` credits once and reports
 * `replayed: true` the second time.
 */
router.post(
  "/wallet/credit",
  requireScope("wallet:credit"),
  async (req: Request, res: Response) => {
    const parsed = creditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        code: "INVALID_INPUT",
        details: parsed.error.issues,
      });
    }

    const client = getClient(req);
    const body = parsed.data;

    if (!body.userId && !body.userEmail) {
      return res.status(400).json({
        error: "Either userId or userEmail is required",
        code: "INVALID_INPUT",
      });
    }

    // The org whose wallet is credited. Defaults to the client's configured
    // platform org so a partner does not have to know Garage's org ids at all.
    const orgId = body.orgId || client.productConfig?.platformOrgId;
    if (!orgId) {
      return res.status(403).json({
        error:
          "No organisation to credit: pass orgId, or configure productConfig.platformOrgId on this client",
        code: "ORG_NOT_CONFIGURED",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ error: "Invalid orgId", code: "INVALID_INPUT" });
    }

    try {
      const user = body.userId
        ? mongoose.Types.ObjectId.isValid(body.userId)
          ? await User.findById(body.userId).select("_id organizations").lean()
          : null
        : await User.findOne({ email: body.userEmail!.toLowerCase() })
            .select("_id organizations")
            .lean();

      if (!user) {
        return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      }

      // A wallet belongs to a membership. Crediting someone who is not in the
      // org would create a balance they can never see or spend — the money
      // would look paid and be unreachable.
      const isMember = (user.organizations || []).some(
        (m: any) => String(m.organization) === String(orgId)
      );
      if (!isMember) {
        return res.status(400).json({
          error: "User is not a member of that organisation",
          code: "NOT_ORG_MEMBER",
        });
      }

      // Minor units on the wire, major units in the ledger — StoreWallet
      // balances are majors (a USD wallet holds 12.50, not 1250).
      const amount = body.amountMinor / 100;

      const result = await creditStoreWalletExternal({
        userId: String(user._id),
        orgId: String(orgId),
        amount,
        currency: body.currency,
        description: body.description,
        note: body.note,
        dedupeKey: body.dedupeKey,
        clientId: String(client._id),
        clientName: client.name,
      });

      return res.status(result.replayed ? 200 : 201).json({
        replayed: result.replayed,
        credit: {
          userId: String(user._id),
          orgId: String(orgId),
          currency: body.currency,
          amountMinor: body.amountMinor,
          dedupeKey: body.dedupeKey,
          transactionId: String((result.transaction as any)?._id ?? ""),
          balanceAfter: (result.transaction as any)?.balanceAfter ?? null,
        },
      });
    } catch (err) {
      console.error(
        `[ThirdPartyWallet] credit failed for client "${client.name}" (${client._id}), dedupeKey ${body.dedupeKey}:`,
        err
      );
      return res.status(500).json({
        error: "Failed to credit wallet",
        code: "CREDIT_FAILED",
      });
    }
  }
);

export default router;
