// src/routes/callCheckout.ts
// Public checkout routes for call purchase links
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { CallOffering } from "../models/callOffering.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Channel } from "../models/channel.model";
import { Floor } from "../models/floor.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, EMAIL_FROM_OTP, senderForHost} from "../services/mailer";
import { signJwt } from "../services/jwt";
import {
  verifyPaymentSignature,
} from "../services/razorpay";
import * as callService from "../services/call";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import {
  ensureUserHasAffiliateId,
  setReferredBy,
  setReferredByAffiliateId,
} from "../services/affiliate";
import { distributeCommissions } from "../services/commission";
import { createInvoice, getNextChargeDate } from "../services/invoice";

const router = Router();

/**
 * GET /checkout/call/:callId
 * Fetch call offering and organization details for checkout page (public)
 */
router.get("/call/:callId", async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    if (!Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ success: false, error: "Invalid call ID" });
    }

    const callOffering = await CallOffering.findOne({
      _id: new Types.ObjectId(callId),
      status: "published",
    })
      .populate("createdBy", "name profilePicture")
      .lean();

    if (!callOffering) {
      return res
        .status(404)
        .json({ success: false, error: "Call offering not found or not available" });
    }

    const organization = await Organization.findById(callOffering.organizationId)
      .select("_id name slug icon coverPhoto description")
      .lean();

    if (!organization) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    res.json({
      success: true,
      callOffering: {
        _id: callOffering._id,
        title: callOffering.title,
        description: callOffering.description,
        coverImage: callOffering.coverImage,
        pricePerCall: callOffering.pricePerCall,
        currency: callOffering.currency,
        isFree: callOffering.isFree,
        duration: callOffering.duration,
        intakeQuestions: callOffering.intakeQuestions,
        averageRating: callOffering.averageRating,
        reviewCount: callOffering.reviewCount,
        totalPurchased: callOffering.totalPurchased,
        createdBy: callOffering.createdBy,
      },
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
        description: organization.description,
      },
    });
  } catch (error) {
    console.error("Error fetching call offering for checkout:", error);
    res.status(500).json({ success: false, error: "Failed to fetch call details" });
  }
});

/**
 * POST /checkout/call/:callId/request-otp
 * Request OTP for checkout (public)
 */
router.post("/call/:callId/request-otp", async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ success: false, error: "Invalid call ID" });
    }

    // Verify call offering exists and is published
    const callOffering = await CallOffering.findOne({
      _id: new Types.ObjectId(callId),
      status: "published",
    }).lean();

    if (!callOffering) {
      return res
        .status(404)
        .json({ success: false, error: "Call offering not found or not available" });
    }

    const E = email.trim().toLowerCase();
    const code = await createOtp(E, "guest-login");

    await sendMail(
      E,
      "Your Call Purchase Verification Code",
      `<p>Your verification code for purchasing <b>${callOffering.title}</b> is <b>${code}</b> (valid 10 minutes)</p>`,
      `Your verification code is ${code}`,
      // Buyer is on the seller's site — the sender follows that domain.
      await senderForHost(req, EMAIL_FROM_OTP)
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error requesting checkout OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to send OTP" });
  }
});

/**
 * POST /checkout/call/:callId/verify-otp
 * Verify OTP and check user membership status (public)
 */
router.post("/call/:callId/verify-otp", async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      code: z.string().min(4),
    });
    const { email, code } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ success: false, error: "Invalid call ID" });
    }

    const E = email.trim().toLowerCase();
    const valid = await verifyOtp(E, code, "guest-login");

    if (!valid) {
      return res.status(400).json({ success: false, error: "Invalid or expired code" });
    }

    // Check if user exists
    const user = await User.findOne({ email: E }).lean();

    // Check if user is a member of the organization
    const callOffering = await CallOffering.findById(callId).lean();
    if (!callOffering) {
      return res.status(404).json({ success: false, error: "Call offering not found" });
    }

    let isMember = false;
    let needsProfileUpdate = false;

    if (user) {
      const membership = user.organizations?.find(
        (org) => org.organization.toString() === callOffering.organizationId.toString()
      );
      isMember = !!membership;
      needsProfileUpdate = !user.name;
    }

    res.json({
      success: true,
      userId: user?._id?.toString(),
      isMember,
      needsProfileUpdate,
    });
  } catch (error: any) {
    console.error("Error verifying checkout OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to verify OTP" });
  }
});

/**
 * POST /checkout/call/:callId/process-checkout
 * Process checkout - create user if needed, add to org, create order
 */
router.post("/call/:callId/process-checkout", async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      quantity: z.number().min(1),
      intakeAnswers: z
        .array(
          z.object({
            questionId: z.string(),
            question: z.string(),
            answerType: z.enum(["text", "file"]),
            textAnswer: z.string().optional(),
            fileUrl: z.string().optional(),
            fileName: z.string().optional(),
          })
        )
        .optional(),
      referralId: z.string().optional(),
      couponCode: z.string().optional(),
      // When true, the N call credits land in the buyer's reserve pool
      // (one per credit) instead of being created as a single CallPurchase
      // for the buyer. The buyer can then assign each reserve to another
      // user via /item-reserves/:id/assign. Default false preserves the
      // existing "buy N for myself" behaviour.
      forReserve: z.boolean().optional().default(false),
    });

    const { email, name, quantity, intakeAnswers, referralId, couponCode, forReserve } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ success: false, error: "Invalid call ID" });
    }

    const callOffering = await CallOffering.findOne({
      _id: new Types.ObjectId(callId),
      status: "published",
    }).lean();

    if (!callOffering) {
      return res.status(404).json({ success: false, error: "Call offering not found" });
    }

    const E = email.trim().toLowerCase();
    let user = await User.findOne({ email: E });
    let isNewUser = false;

    // Create user if doesn't exist
    if (!user) {
      isNewUser = true;
      user = new User({
        email: E,
        name: name || E.split("@")[0],
        guest: true,
        isFirstTimeUser: true,
        organizations: [],
      });
      await user.save();

      // Ensure user has affiliate ID
      await ensureUserHasAffiliateId(user._id.toString());

      // Set referral
      if (referralId) {
        const wasSet = await setReferredByAffiliateId(user._id.toString(), referralId);
        if (!wasSet) {
          await setReferredBy(user._id.toString());
        }
      } else {
        await setReferredBy(user._id.toString());
      }
    } else if (name && !user.name) {
      // Update name if provided and user doesn't have one
      user.name = name;
      await user.save();
    }

    // Check org membership
    const orgId = callOffering.organizationId.toString();
    let isMember = user.organizations?.some(
      (org) => org.organization.toString() === orgId
    );

    // Add to org if not a member
    if (!isMember) {
      // Get default floor
      const defaultFloor = await Floor.findOne({
        orgId: new Types.ObjectId(orgId),
        name: { $regex: /lobby/i },
      }).lean();

      user.organizations = user.organizations || [];
      user.organizations.push({
        organization: new Types.ObjectId(orgId),
        role: "stakeholder",
        floorId: defaultFloor?._id,
        joinedAt: new Date(),
      });
      await user.save();
      isMember = true;

      // Add to GARAGE HQ as well
      await addUserToGarageHQ(user._id.toString());

      // Send welcome email for new users (fire-and-forget)
      if (isNewUser) {
        sendWelcomeEmail(user._id.toString(), orgId).catch((err) =>
          console.error("[WelcomeEmail] Failed:", err)
        );
      }
    }

    // Subscribe to call's channels if any
    // Subscribe user to the offering's FREE channels only. Two bugs fixed here:
    // this used to join every entry in channelIds including PAID communities,
    // and it wrote the row as { channelId, memberId } with no userId/orgId —
    // a shape no reader queries, so those memberships were orphaned. Going
    // through addUserToChannel gives the correct shape and mints the $0
    // invoice for each bundled join.
    if (callOffering.channelIds && callOffering.channelIds.length > 0) {
      const freeChannels = await Channel.find({
        _id: { $in: callOffering.channelIds },
        $or: [{ isFree: true }, { price: { $in: [null, 0] } }],
      })
        .select("_id")
        .lean();
      const { addUserToChannel } = await import("../services/channel");
      for (const ch of freeChannels) {
        await addUserToChannel(
          user._id.toString(),
          String(ch._id),
          callOffering.organizationId.toString(),
          { source: "bundled" },
        );
      }
      console.log(
        `✅ Subscribed user to ${freeChannels.length} free channels (skipped ${callOffering.channelIds.length - freeChannels.length} paid)`,
      );
    }

    const userId = user._id.toString();

    // Check if free call
    if (callOffering.isFree || callOffering.pricePerCall === 0) {
      // Create purchase directly for free calls
      const purchase = await callService.purchaseCalls({
        callOfferingId: callId,
        userId,
        organizationId: orgId,
        quantity,
        intakeAnswers,
        isPaid: false,
        totalAmount: 0,
        currency: callOffering.currency,
        paymentStatus: "completed",
      });

      // Generate JWT token
      const token = signJwt({
        userId,
        orgId,
        name: user.name,
        email: user.email,
      });

      // The $0 invoice is minted inside purchaseCalls now, so
      // POST /calls/:callId/purchase-free gets one too — not just this route.

      return res.json({
        success: true,
        isFree: true,
        purchase,
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    }

    // Create invoice for the payment flow
    const totalAmount = callOffering.pricePerCall * quantity;

    const { routeCoupon } = await import("../utils/couponRouting");
    const routedCoupon = await routeCoupon(couponCode);
    const platformCouponCode = routedCoupon.isPlatform ? couponCode : undefined;

    const invoice = await createInvoice({
      organizationId: orgId,
      sellerId: callOffering.createdBy.toString(),
      userId,
      customerEmail: E,
      customerName: name,
      lineItems: [{
        itemType: "call",
        itemId: callId,
        itemName: callOffering.title,
        itemDescription: callOffering.description,
        itemImage: callOffering.coverImage,
        quantity,
        unitPrice: Math.round(callOffering.pricePerCall * 100),
        originalCurrency: callOffering.currency || "USD",
      }],
      itemCurrency: callOffering.currency || "USD",
      discount: 0,
      platformCouponCode,
      referralId,
      // `forReserve` is read by fulfillInvoice's `case "call"` to decide
      // between creating a CallPurchase for the buyer (default) vs N reserve
      // licenses they can later assign.
      metadata: { type: "call_checkout", forReserve },
    });
    const invoiceId = invoice._id.toString();

    res.json({
      success: true,
      isFree: false,
      invoiceId,
      quantity,
      totalPrice: totalAmount,
      intakeAnswers, // Return so client can send back on verify
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error("Error processing call checkout:", error);
    res.status(400).json({ success: false, error: error.message || "Checkout failed" });
  }
});

/**
 * POST /checkout/call/:callId/verify-payment
 * Verify payment and complete purchase
 */
router.post("/call/:callId/verify-payment", async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
      userId: z.string(),
      quantity: z.number().min(1),
      intakeAnswers: z
        .array(
          z.object({
            questionId: z.string(),
            question: z.string(),
            answerType: z.enum(["text", "file"]),
            textAnswer: z.string().optional(),
            fileUrl: z.string().optional(),
            fileName: z.string().optional(),
          })
        )
        .optional(),
    });

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      userId,
      quantity,
      intakeAnswers,
    } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ success: false, error: "Invalid call ID" });
    }

    // Delegate to invoice system if invoice exists for this order
    const { Invoice: InvoiceModel } = require("../models/invoice.model");
    const { verifyAndCompletePayment: invoiceVerify, fulfillInvoice } = require("../services/invoice");
    const existingInvoice = await InvoiceModel.findOne({ razorpayOrderId });
    if (existingInvoice) {
      if (existingInvoice.status === "paid") {
        const user = await User.findById(userId).lean();
        const token = signJwt({ userId, orgId: existingInvoice.organizationId.toString(), name: user?.name || "", email: user?.email || "" });
        return res.json({ success: true, message: "Already fulfilled via invoice", token, orgId: existingInvoice.organizationId.toString() });
      }
      try {
        const paidInvoice = await invoiceVerify(existingInvoice._id.toString(), { razorpayOrderId, razorpayPaymentId, razorpaySignature });
        if (!paidInvoice.__alreadyFulfilled) {
          await fulfillInvoice(paidInvoice, razorpayPaymentId);
        }
        const user = await User.findById(userId).lean();
        const token = signJwt({ userId, orgId: paidInvoice.organizationId.toString(), name: user?.name || "", email: user?.email || "" });
        return res.json({ success: true, invoice: paidInvoice.invoiceNumber, token, orgId: paidInvoice.organizationId.toString() });
      } catch (invoiceErr: any) {
        return res.status(400).json({ success: false, error: invoiceErr.message });
      }
    }

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid payment signature" });
    }

    const callOffering = await CallOffering.findById(callId).lean();
    if (!callOffering) {
      return res.status(404).json({ success: false, error: "Call offering not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const orgId = callOffering.organizationId.toString();
    const totalAmount = callOffering.pricePerCall * quantity;

    // Create purchase
    const purchase = await callService.purchaseCalls({
      callOfferingId: callId,
      userId,
      organizationId: orgId,
      quantity,
      intakeAnswers,
      isPaid: true,
      totalAmount,
      currency: callOffering.currency,
      paymentId: razorpayPaymentId,
      paymentStatus: "completed",
    });

    // Distribute commissions
    try {
      await distributeCommissions({
        orgId,
        sellerId: callOffering.createdBy.toString(),
        customerId: userId,
        itemType: "call",
        itemId: callId,
        itemName: callOffering.title,
        saleAmount: totalAmount,
        currency: callOffering.currency || "USD",
        paymentId: razorpayPaymentId,
      });
    } catch (commissionError) {
      console.error("Error distributing commissions:", commissionError);
    }

    // Generate JWT token
    const token = signJwt({
      userId,
      orgId,
      name: user.name,
      email: user.email,
    });

    res.json({
      success: true,
      message: "Payment verified and calls purchased",
      purchase,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error("Error verifying call payment:", error);
    res.status(400).json({ success: false, error: error.message || "Payment verification failed" });
  }
});

export default router;
