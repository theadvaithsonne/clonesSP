// src/routes/call.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { Types } from "mongoose";
import * as callService from "../services/call";
import { CallOffering } from "../models/callOffering.model";
import { CallPurchase } from "../models/callPurchase.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { notifyNewCallCreated } from "../services/bulkEmail";
import { distributeCommissions } from "../services/commission";
import { createOrder, verifyPaymentSignature } from "../services/razorpay";

const router = Router();

// Helper to check if user is founder of the org
async function isFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  const membership = user.organizations?.find(
    (org) => org.organization.toString() === orgId
  );

  return membership ? hasFounderAccess(membership) : false;
}

// ==================== CALL OFFERING CRUD ====================

// Create call offering (founder only)
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can create call offerings" });
    }

    const {
      title,
      description,
      coverImage,
      pricePerCall,
      currency,
      duration,
      channelIds,
      intakeQuestions,
      status,
      whatsIncluded,
      topicsWeCover,
      howItWorks,
      faqs,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const callOffering = await callService.createCallOffering({
      title,
      description,
      coverImage,
      pricePerCall: pricePerCall || 0,
      currency,
      duration: duration || 30,
      organizationId: orgId,
      createdBy: userId,
      channelIds,
      intakeQuestions,
      status,
      whatsIncluded,
      topicsWeCover,
      howItWorks,
      faqs,
    });

    // Notify org members about the new call offering (only for published).
    // Scoped to this office so members of unrelated orgs aren't spammed.
    if (callOffering.status === "published") {
      const org = await Organization.findById(orgId).select("name").lean();
      notifyNewCallCreated(
        {
          _id: callOffering._id.toString(),
          name: callOffering.title,
          pricePerCall: callOffering.pricePerCall,
          currency: callOffering.currency,
          description: callOffering.description,
          coverImage: callOffering.coverImage,
          duration: callOffering.duration,
        },
        (org as any)?.name || "an organization",
        orgId
      );
    }

    res.status(201).json({ success: true, callOffering });
  } catch (error: any) {
    console.error("Error creating call offering:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get all call offerings for org (founder view - includes drafts)
router.get("/manage", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res.status(403).json({ error: "Only founders can manage calls" });
    }

    const callOfferings = await callService.getCallOfferingsByOrganization(
      orgId,
      { includeArchived: req.query.includeArchived === "true" }
    );

    res.json({ success: true, callOfferings, isFounder: true });
  } catch (error: any) {
    console.error("Error fetching call offerings:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get published call offerings (stakeholder view)
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);

    let callOfferings;
    if (isUserFounder) {
      callOfferings = await callService.getCallOfferingsByOrganization(orgId);
    } else {
      callOfferings = await callService.getPublishedCallOfferings(orgId);
    }

    res.json({ success: true, callOfferings, isFounder: isUserFounder });
  } catch (error: any) {
    console.error("Error fetching call offerings:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get single call offering
router.get("/:callId", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    const callOffering = await callService.getCallOfferingById(callId);

    if (!callOffering) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    // Handle populated organizationId (object with _id) or plain ObjectId
    const orgIdField = callOffering.organizationId as any;
    const callOrgId = typeof orgIdField === "object" && orgIdField !== null
      ? (orgIdField._id?.toString() || orgIdField.toString())
      : orgIdField.toString();

    if (callOrgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const isUserFounder = await isFounder(userId, orgId);

    if (!isUserFounder && callOffering.status !== "published") {
      return res.status(404).json({ error: "Call offering not found" });
    }

    res.json({ success: true, callOffering, isFounder: isUserFounder });
  } catch (error: any) {
    console.error("Error fetching call offering:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Update call offering (founder only)
router.put("/:callId", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can update call offerings" });
    }

    const existingCall = await CallOffering.findById(callId);
    if (!existingCall) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    if (existingCall.organizationId.toString() !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const {
      title,
      description,
      coverImage,
      pricePerCall,
      currency,
      duration,
      channelIds,
      status,
      whatsIncluded,
      topicsWeCover,
      howItWorks,
      faqs,
    } = req.body;

    const callOffering = await callService.updateCallOffering(callId, {
      title,
      description,
      coverImage,
      pricePerCall,
      currency,
      duration,
      channelIds,
      status,
      whatsIncluded,
      topicsWeCover,
      howItWorks,
      faqs,
    });

    res.json({ success: true, callOffering });
  } catch (error: any) {
    console.error("Error updating call offering:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Delete call offering (founder only)
router.delete("/:callId", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can delete call offerings" });
    }

    const existingCall = await CallOffering.findById(callId);
    if (!existingCall) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    if (existingCall.organizationId.toString() !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await callService.deleteCallOffering(callId);

    res.json({ success: true, message: "Call offering deleted" });
  } catch (error: any) {
    console.error("Error deleting call offering:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ==================== INTAKE QUESTIONS ====================

// Add intake question
router.post("/:callId/questions", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can manage intake questions" });
    }

    const { question, answerType, isRequired } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const callOffering = await callService.addIntakeQuestion(callId, {
      question,
      answerType: answerType || "text",
      isRequired: isRequired || false,
    });

    if (!callOffering) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    res.json({ success: true, callOffering });
  } catch (error: any) {
    console.error("Error adding intake question:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Update intake question
router.put("/:callId/questions/:questionId", requireAuth, async (req, res) => {
  try {
    const { callId, questionId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can manage intake questions" });
    }

    const { question, answerType, isRequired } = req.body;

    const callOffering = await callService.updateIntakeQuestion(
      callId,
      questionId,
      { question, answerType, isRequired }
    );

    if (!callOffering) {
      return res
        .status(404)
        .json({ error: "Call offering or question not found" });
    }

    res.json({ success: true, callOffering });
  } catch (error: any) {
    console.error("Error updating intake question:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Delete intake question
router.delete("/:callId/questions/:questionId", requireAuth, async (req, res) => {
  try {
    const { callId, questionId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can manage intake questions" });
    }

    const callOffering = await callService.deleteIntakeQuestion(
      callId,
      questionId
    );

    if (!callOffering) {
      return res
        .status(404)
        .json({ error: "Call offering or question not found" });
    }

    res.json({ success: true, callOffering });
  } catch (error: any) {
    console.error("Error deleting intake question:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Reorder intake questions
router.put("/:callId/questions/reorder", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can manage intake questions" });
    }

    const { questionIds } = req.body;

    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({ error: "questionIds array is required" });
    }

    const callOffering = await callService.reorderIntakeQuestions(
      callId,
      questionIds
    );

    if (!callOffering) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    res.json({ success: true, callOffering });
  } catch (error: any) {
    console.error("Error reordering intake questions:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ==================== PURCHASES ====================

// Create Razorpay order for call purchase
router.post("/:callId/create-order", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    const callOffering = await CallOffering.findById(callId);
    if (!callOffering) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    if (callOffering.status !== "published") {
      return res.status(400).json({ error: "Call offering not available" });
    }

    if (callOffering.isFree || callOffering.pricePerCall === 0) {
      return res.status(400).json({
        error: "This is a free call offering. Use /purchase-free endpoint.",
      });
    }

    const totalAmount = callOffering.pricePerCall * quantity;
    const amountInPaise = Math.round(totalAmount * 100);

    const order = await createOrder({
      amount: amountInPaise,
      currency: callOffering.currency || "USD",
      notes: {
        callOfferingId: callId,
        userId,
        orgId,
        quantity: quantity.toString(),
        type: "call_purchase",
      },
    });

    // Create invoice
    let invoiceId: string | undefined;
    try {
      const { createInvoice } = require("../services/invoice");
      const userDoc = await User.findById(userId).select("email").lean();
      const invoice = await createInvoice({
        organizationId: orgId,
        sellerId: callOffering.createdBy,
        userId,
        customerEmail: userDoc?.email || "",
        lineItems: [{
          itemType: "call",
          itemId: callId,
          itemName: callOffering.title,
          itemDescription: `Call offering: ${callOffering.title} x${quantity}`,
          quantity,
          unitPrice: Math.round(callOffering.pricePerCall * 100),
          originalCurrency: callOffering.currency || "USD",
        }],
        itemCurrency: callOffering.currency || "USD",
        metadata: { type: "call_purchase" },
      });
      invoiceId = invoice._id.toString();
    } catch (invoiceError) {
      console.error("[Call] Invoice creation error (non-blocking):", invoiceError);
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      call: {
        id: callOffering._id,
        title: callOffering.title,
        pricePerCall: callOffering.pricePerCall,
      },
      quantity,
      totalPrice: totalAmount,
      invoiceId,
    });
  } catch (error: any) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Verify payment and create purchase
router.post("/:callId/verify-payment", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      quantity,
      intakeAnswers,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: "Payment details required" });
    }

    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const callOffering = await CallOffering.findById(callId);
    if (!callOffering) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    const totalAmount = callOffering.pricePerCall * quantity;

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

    res.json({
      success: true,
      message: "Payment verified and calls purchased",
      purchase,
    });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Purchase free calls
router.post("/:callId/purchase-free", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const { quantity, intakeAnswers } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    const callOffering = await CallOffering.findById(callId);
    if (!callOffering) {
      return res.status(404).json({ error: "Call offering not found" });
    }

    if (callOffering.status !== "published") {
      return res.status(400).json({ error: "Call offering not available" });
    }

    if (!callOffering.isFree && callOffering.pricePerCall > 0) {
      return res.status(400).json({
        error: "This is a paid call offering. Use payment flow.",
      });
    }

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

    res.json({
      success: true,
      message: "Free calls acquired",
      purchase,
    });
  } catch (error: any) {
    console.error("Error purchasing free calls:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get user's call purchases
router.get("/purchases/me", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const purchases = await callService.getUserCallPurchases(userId, orgId);

    res.json({ success: true, purchases });
  } catch (error: any) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get all purchases for a call offering (founder only)
router.get("/:callId/purchases", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can view all purchases" });
    }

    const purchases = await callService.getCallOfferingPurchases(callId);

    res.json({ success: true, purchases });
  } catch (error: any) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get purchase details
router.get("/purchases/:purchaseId", requireAuth, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const purchase = await callService.getPurchaseById(purchaseId);

    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    const isOwner = purchase.userId.toString() === userId;

    if (!isUserFounder && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ success: true, purchase });
  } catch (error: any) {
    console.error("Error fetching purchase:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get call offering stats (founder only)
router.get("/:callId/stats", requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res.status(403).json({ error: "Only founders can view stats" });
    }

    const stats = await callService.getCallOfferingStats(callId);

    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
