// Public unauthenticated exchange for the admin-initiated save-card
// link (see garageAdminSavedCards.ts::create-add-link).
//
// Flow:
//   1. Super-admin mints a link via
//      POST /garage-admin/users/:userId/saved-cards/create-add-link.
//   2. Admin sends the URL `${FE}/save-card/<token>` to the user.
//   3. User opens the URL. FE page calls this endpoint to exchange
//      the token for the SetupIntent's client_secret + publishable
//      key + display context (email/name so the page can greet them).
//   4. FE renders Stripe Elements bound to the SetupIntent, user
//      enters card + confirms mandate, existing
//      `setup_intent.succeeded` webhook persists the PM to the User
//      doc — same code path as the user's own settings page.
//
// The token IS the auth for this call — no bearer needed. It's a
// short-lived JWT scoped to `purpose: "save_card_admin_link"`; the
// endpoint rejects anything without that exact purpose, so an
// arbitrary auth JWT can't be substituted.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { verifyJwt } from "../services/jwt";
import { User } from "../models/user.model";
import { Types } from "mongoose";

const router = Router();

const bodySchema = z.object({
  token: z.string().min(20),
});

interface AddLinkPayload {
  purpose: string;
  userId: string;
  customerId: string;
  setupIntentId: string;
  clientSecret: string;
  initiatedByGarageAdminId: string;
  initiatedByGarageAdminEmail: string;
  iat: number;
  exp: number;
}

router.post("/exchange", async (req: Request, res: Response) => {
  try {
    const { token } = bodySchema.parse(req.body);

    let payload: AddLinkPayload;
    try {
      payload = verifyJwt<AddLinkPayload>(token);
    } catch (err: any) {
      // jsonwebtoken throws with a specific `name` ("TokenExpiredError"
      // or "JsonWebTokenError"). Surface a distinct 410 for expired
      // so the FE can render "This link has expired, ask for a new one."
      const name = err?.name || "";
      if (name === "TokenExpiredError") {
        return res
          .status(410)
          .json({ success: false, error: "Link expired" });
      }
      return res
        .status(400)
        .json({ success: false, error: "Invalid or malformed link" });
    }

    if (payload.purpose !== "save_card_admin_link") {
      return res.status(400).json({
        success: false,
        error: "Token is not scoped for save-card use",
      });
    }
    if (!payload.userId || !Types.ObjectId.isValid(payload.userId)) {
      return res
        .status(400)
        .json({ success: false, error: "Token missing user context" });
    }
    if (!payload.clientSecret || !payload.setupIntentId) {
      return res.status(400).json({
        success: false,
        error: "Token missing setup-intent context",
      });
    }

    // Hydrate the display context. If the user was deleted between
    // link creation + open, refuse cleanly.
    const user = await User.findById(payload.userId)
      .select("_id email name")
      .lean<{ _id: any; email?: string; name?: string }>();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "User no longer exists" });
    }

    return res.json({
      success: true,
      clientSecret: payload.clientSecret,
      setupIntentId: payload.setupIntentId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      recipient: {
        userId: String(user._id),
        email: user.email || null,
        name: user.name || null,
      },
    });
  } catch (err: any) {
    console.error("[public-save-card] exchange:", err);
    res
      .status(500)
      .json({ success: false, error: err?.message || "Server error" });
  }
});

export default router;
