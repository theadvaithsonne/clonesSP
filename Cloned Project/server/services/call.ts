// src/services/call.ts
import { Types } from "mongoose";
import {
  CallOffering,
  ICallOffering,
  IIntakeQuestion,
} from "../models/callOffering.model";
import { CallPurchase, ICallPurchase } from "../models/callPurchase.model";
import { CallBooking, ICallBooking } from "../models/callBooking.model";
import { Availability } from "../models/availability.model";

// ==================== CALL OFFERING CRUD ====================

interface CreateCallOfferingInput {
  title: string;
  description?: string;
  coverImage?: string;
  pricePerCall: number;
  currency?: string;
  duration: number;
  organizationId: string;
  createdBy: string;
  channelIds?: string[];
  intakeQuestions?: Array<{
    question: string;
    answerType: "text" | "file";
    isRequired: boolean;
  }>;
  status?: "draft" | "published";
  // Detail page fields
  whatsIncluded?: string[];
  topicsWeCover?: Array<{ title: string; description: string }>;
  howItWorks?: Array<{ icon: string; title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

export async function createCallOffering(
  data: CreateCallOfferingInput
): Promise<ICallOffering> {
  const intakeQuestions = (data.intakeQuestions || []).map((q, index) => ({
    question: q.question,
    answerType: q.answerType,
    isRequired: q.isRequired,
    order: index,
  }));

  const pricePerCall = data.pricePerCall || 0;
  const callOffering = new CallOffering({
    title: data.title,
    description: data.description,
    coverImage: data.coverImage,
    pricePerCall,
    isFree: pricePerCall === 0,
    currency: data.currency || "USD",
    duration: data.duration || 30,
    organizationId: new Types.ObjectId(data.organizationId),
    createdBy: new Types.ObjectId(data.createdBy),
    channelIds: (data.channelIds || []).map((id) => new Types.ObjectId(id)),
    intakeQuestions,
    status: data.status || "draft",
    // Detail page fields
    whatsIncluded: data.whatsIncluded,
    topicsWeCover: data.topicsWeCover,
    howItWorks: data.howItWorks,
    faqs: data.faqs,
  });

  await callOffering.save();
  return callOffering;
}

export async function getCallOfferingById(
  callId: string
): Promise<ICallOffering | null> {
  return CallOffering.findById(callId)
    .populate("createdBy", "name email profilePicture")
    .populate("organizationId", "name logo")
    .lean();
}

interface GetCallOfferingsOptions {
  status?: "draft" | "published" | "archived";
  includeArchived?: boolean;
  channelId?: string;
}

export async function getCallOfferingsByOrganization(
  orgId: string,
  options: GetCallOfferingsOptions = {}
): Promise<ICallOffering[]> {
  const query: any = {
    organizationId: new Types.ObjectId(orgId),
  };

  if (options.status) {
    query.status = options.status;
  } else if (!options.includeArchived) {
    query.status = { $ne: "archived" };
  }

  if (options.channelId) {
    query.channelIds = new Types.ObjectId(options.channelId);
  }

  return CallOffering.find(query)
    .populate("createdBy", "name email profilePicture")
    .sort({ createdAt: -1 })
    .lean();
}

export async function getPublishedCallOfferings(
  orgId: string,
  channelIds?: string[]
): Promise<ICallOffering[]> {
  const query: any = {
    organizationId: new Types.ObjectId(orgId),
    status: "published",
  };

  if (channelIds && channelIds.length > 0) {
    query.channelIds = { $in: channelIds.map((id) => new Types.ObjectId(id)) };
  }

  return CallOffering.find(query)
    .populate("createdBy", "name email profilePicture")
    .sort({ createdAt: -1 })
    .lean();
}

interface UpdateCallOfferingInput {
  title?: string;
  description?: string;
  coverImage?: string;
  pricePerCall?: number;
  currency?: string;
  duration?: number;
  channelIds?: string[];
  status?: "draft" | "published" | "archived";
  // Detail page fields
  whatsIncluded?: string[];
  topicsWeCover?: Array<{ title: string; description: string }>;
  howItWorks?: Array<{ icon: string; title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

export async function updateCallOffering(
  callId: string,
  data: UpdateCallOfferingInput
): Promise<ICallOffering | null> {
  const updateData: any = { ...data };

  if (data.channelIds) {
    updateData.channelIds = data.channelIds.map((id) => new Types.ObjectId(id));
  }

  // Update isFree based on pricePerCall
  if (data.pricePerCall !== undefined) {
    updateData.isFree = data.pricePerCall === 0;
  }

  return CallOffering.findByIdAndUpdate(callId, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("createdBy", "name email profilePicture")
    .lean();
}

export async function deleteCallOffering(callId: string): Promise<boolean> {
  // Check if there are any purchases
  const purchaseCount = await CallPurchase.countDocuments({
    callOfferingId: new Types.ObjectId(callId),
    paymentStatus: "completed",
  });

  if (purchaseCount > 0) {
    // Soft delete - archive instead of delete
    await CallOffering.findByIdAndUpdate(callId, { status: "archived" });
  } else {
    // Hard delete if no purchases
    await CallOffering.findByIdAndDelete(callId);
  }

  return true;
}

// ==================== INTAKE QUESTIONS ====================

interface AddIntakeQuestionInput {
  question: string;
  answerType: "text" | "file";
  isRequired: boolean;
}

export async function addIntakeQuestion(
  callId: string,
  questionData: AddIntakeQuestionInput
): Promise<ICallOffering | null> {
  const callOffering = await CallOffering.findById(callId);
  if (!callOffering) return null;

  const maxOrder = callOffering.intakeQuestions.reduce(
    (max, q) => Math.max(max, q.order),
    -1
  );

  callOffering.intakeQuestions.push({
    _id: new Types.ObjectId(),
    question: questionData.question,
    answerType: questionData.answerType,
    isRequired: questionData.isRequired,
    order: maxOrder + 1,
  });

  await callOffering.save();
  return callOffering;
}

export async function updateIntakeQuestion(
  callId: string,
  questionId: string,
  data: Partial<AddIntakeQuestionInput>
): Promise<ICallOffering | null> {
  const callOffering = await CallOffering.findById(callId);
  if (!callOffering) return null;

  const questionIndex = callOffering.intakeQuestions.findIndex(
    (q) => q._id.toString() === questionId
  );

  if (questionIndex === -1) return null;

  if (data.question !== undefined) {
    callOffering.intakeQuestions[questionIndex].question = data.question;
  }
  if (data.answerType !== undefined) {
    callOffering.intakeQuestions[questionIndex].answerType = data.answerType;
  }
  if (data.isRequired !== undefined) {
    callOffering.intakeQuestions[questionIndex].isRequired = data.isRequired;
  }

  await callOffering.save();
  return callOffering;
}

export async function deleteIntakeQuestion(
  callId: string,
  questionId: string
): Promise<ICallOffering | null> {
  const callOffering = await CallOffering.findById(callId);
  if (!callOffering) return null;

  callOffering.intakeQuestions = callOffering.intakeQuestions.filter(
    (q) => q._id.toString() !== questionId
  );

  // Reorder remaining questions
  callOffering.intakeQuestions.forEach((q, index) => {
    q.order = index;
  });

  await callOffering.save();
  return callOffering;
}

export async function reorderIntakeQuestions(
  callId: string,
  questionIds: string[]
): Promise<ICallOffering | null> {
  const callOffering = await CallOffering.findById(callId);
  if (!callOffering) return null;

  // Create a map of questionId to question
  const questionMap = new Map(
    callOffering.intakeQuestions.map((q) => [q._id.toString(), q])
  );

  // Reorder based on provided order
  const reorderedQuestions: IIntakeQuestion[] = [];
  questionIds.forEach((id, index) => {
    const question = questionMap.get(id);
    if (question) {
      question.order = index;
      reorderedQuestions.push(question);
    }
  });

  callOffering.intakeQuestions = reorderedQuestions;
  await callOffering.save();
  return callOffering;
}

// ==================== PURCHASES ====================

interface PurchaseCallsInput {
  callOfferingId: string;
  userId: string;
  organizationId: string;
  quantity: number;
  intakeAnswers?: Array<{
    questionId: string;
    question: string;
    answerType: "text" | "file";
    textAnswer?: string;
    fileUrl?: string;
    fileName?: string;
  }>;
  isPaid?: boolean;
  totalAmount?: number;
  currency?: string;
  paymentId?: string;
  paymentStatus?: "pending" | "completed" | "failed" | "refunded";
  invoiceShortUrl?: string;
}

export async function purchaseCalls(
  data: PurchaseCallsInput
): Promise<ICallPurchase> {
  const callOffering = await CallOffering.findById(data.callOfferingId);
  if (!callOffering) {
    throw new Error("Call offering not found");
  }

  const totalAmount =
    data.totalAmount ?? callOffering.pricePerCall * data.quantity;
  const isPaid = data.isPaid ?? totalAmount > 0;

  const purchase = new CallPurchase({
    callOfferingId: new Types.ObjectId(data.callOfferingId),
    userId: new Types.ObjectId(data.userId),
    organizationId: new Types.ObjectId(data.organizationId),
    quantityPurchased: data.quantity,
    quantityUsed: 0,
    quantityScheduled: 0,
    quantityRemaining: data.quantity,
    intakeAnswers: (data.intakeAnswers || []).map((a) => ({
      questionId: new Types.ObjectId(a.questionId),
      question: a.question,
      answerType: a.answerType,
      textAnswer: a.textAnswer,
      fileUrl: a.fileUrl,
      fileName: a.fileName,
    })),
    isPaid,
    totalAmount,
    currency: data.currency || callOffering.currency,
    paymentId: data.paymentId,
    paymentStatus: data.paymentStatus || (isPaid ? "completed" : "pending"),
    invoiceShortUrl: data.invoiceShortUrl,
    purchasedAt: new Date(),
  });

  await purchase.save();

  // Free calls get the same $0 paper trail a free /checkout/call/:id produces.
  // Closes POST /calls/:callId/purchase-free, which granted the calls with no
  // invoice. Purchase is saved first — the invoice is best-effort.
  if (!isPaid) {
    // Backgrounded: bookkeeping must not add latency to the purchase response.
    const { mintFreeItemInvoiceInBackground } = await import("./freeInvoice");
    mintFreeItemInvoiceInBackground({
      userId: data.userId,
      orgId: data.organizationId,
      sellerId: String((callOffering as any).createdBy),
      itemType: "call",
      itemId: String(callOffering._id),
      itemName: (callOffering as any).title,
      itemDescription: (callOffering as any).description,
      itemImage: (callOffering as any).coverImage,
      currency: data.currency || callOffering.currency,
      metadataType: "call_checkout",
      source: "checkout",
    });
  }

  // Update call offering stats
  await CallOffering.findByIdAndUpdate(data.callOfferingId, {
    $inc: {
      totalPurchased: data.quantity,
      purchaseCount: 1,
    },
  });

  return purchase;
}

export async function getUserCallPurchases(
  userId: string,
  orgId: string
): Promise<ICallPurchase[]> {
  return CallPurchase.find({
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(orgId),
    paymentStatus: "completed",
  })
    .populate({
      path: "callOfferingId",
      select: "title description coverImage duration pricePerCall createdBy",
      populate: { path: "createdBy", select: "name profilePicture" },
    })
    .sort({ purchasedAt: -1 })
    .lean();
}

export async function getCallOfferingPurchases(
  callOfferingId: string
): Promise<ICallPurchase[]> {
  return CallPurchase.find({
    callOfferingId: new Types.ObjectId(callOfferingId),
    paymentStatus: "completed",
  })
    .populate("userId", "name email profilePicture")
    .sort({ purchasedAt: -1 })
    .lean();
}

export async function getPurchaseById(
  purchaseId: string
): Promise<ICallPurchase | null> {
  return CallPurchase.findById(purchaseId)
    .populate({
      path: "callOfferingId",
      select: "title description coverImage duration pricePerCall createdBy",
      populate: { path: "createdBy", select: "name profilePicture" },
    })
    .populate("userId", "name email profilePicture")
    .lean();
}

// ==================== BOOKINGS ====================

interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export async function getFounderAvailableSlots(
  founderId: string,
  callOfferingId: string,
  date: Date,
  orgId: string
): Promise<TimeSlot[]> {
  const callOffering = await CallOffering.findById(callOfferingId);
  if (!callOffering) {
    throw new Error("Call offering not found");
  }

  const duration = callOffering.duration; // in minutes

  // Get day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = date.getDay();

  // Get founder's availability for this day
  const availability = await Availability.findOne({
    userId: new Types.ObjectId(founderId),
    orgId: new Types.ObjectId(orgId),
    dayOfWeek,
    enabled: true,
  });

  if (!availability) {
    return [];
  }

  // Parse availability times
  const [startHour, startMinute] = availability.startTime
    .split(":")
    .map(Number);
  const [endHour, endMinute] = availability.endTime.split(":").map(Number);

  // Create available slots
  const slots: TimeSlot[] = [];
  const dateStr = date.toISOString().split("T")[0];

  let currentTime = new Date(`${dateStr}T${availability.startTime}:00.000Z`);
  const endTime = new Date(`${dateStr}T${availability.endTime}:00.000Z`);

  // Get existing bookings for this day
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const existingBookings = await CallBooking.find({
    founderId: new Types.ObjectId(founderId),
    startTime: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["scheduled"] },
  }).lean();

  // Generate slots
  while (currentTime < endTime) {
    const slotEnd = new Date(currentTime.getTime() + duration * 60 * 1000);

    if (slotEnd <= endTime) {
      // Check if slot conflicts with existing booking
      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = new Date(booking.startTime);
        const bookingEnd = new Date(booking.endTime);
        return currentTime < bookingEnd && slotEnd > bookingStart;
      });

      // Check if slot is in the future
      const now = new Date();
      const isInFuture = currentTime > now;

      if (!hasConflict && isInFuture) {
        slots.push({
          startTime: new Date(currentTime),
          endTime: slotEnd,
        });
      }
    }

    // Move to next slot
    currentTime = new Date(currentTime.getTime() + duration * 60 * 1000);
  }

  return slots;
}

interface CreateCallBookingInput {
  callPurchaseId: string;
  startTime: Date;
  bookingNotes?: string;
}

export async function createCallBooking(
  data: CreateCallBookingInput
): Promise<ICallBooking> {
  const purchase = await CallPurchase.findById(data.callPurchaseId).populate(
    "callOfferingId"
  );
  if (!purchase) {
    throw new Error("Purchase not found");
  }

  const callOffering = purchase.callOfferingId as any;
  if (!callOffering) {
    throw new Error("Call offering not found");
  }

  // Check if user has remaining calls
  if (purchase.quantityRemaining <= 0) {
    throw new Error("No remaining calls in this purchase");
  }

  // Check if user already has a scheduled booking for this slot
  const duration = callOffering.duration;
  const endTime = new Date(
    new Date(data.startTime).getTime() + duration * 60 * 1000
  );

  // Check for conflicts
  const existingBooking = await CallBooking.findOne({
    founderId: callOffering.createdBy,
    status: "scheduled",
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: data.startTime },
      },
    ],
  });

  if (existingBooking) {
    throw new Error("This time slot is no longer available");
  }

  const booking = new CallBooking({
    callOfferingId: callOffering._id,
    callPurchaseId: purchase._id,
    organizationId: purchase.organizationId,
    founderId: callOffering.createdBy,
    bookerId: purchase.userId,
    startTime: data.startTime,
    endTime,
    status: "scheduled",
    bookingNotes: data.bookingNotes,
  });

  await booking.save();

  // Update purchase stats
  await CallPurchase.findByIdAndUpdate(data.callPurchaseId, {
    $inc: { quantityScheduled: 1 },
  });

  // Update call offering stats
  await CallOffering.findByIdAndUpdate(callOffering._id, {
    $inc: { totalScheduled: 1 },
  });

  return booking;
}

export async function getBookerBookings(
  bookerId: string,
  orgId: string
): Promise<ICallBooking[]> {
  return CallBooking.find({
    bookerId: new Types.ObjectId(bookerId),
    organizationId: new Types.ObjectId(orgId),
  })
    .populate("callOfferingId", "title duration coverImage")
    .populate("founderId", "name email profilePicture")
    .sort({ startTime: -1 })
    .lean();
}

export async function getFounderBookings(
  founderId: string,
  orgId: string,
  filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<ICallBooking[]> {
  const query: any = {
    founderId: new Types.ObjectId(founderId),
    organizationId: new Types.ObjectId(orgId),
  };

  if (filters?.status) {
    query.status = filters.status;
  }

  if (filters?.startDate || filters?.endDate) {
    query.startTime = {};
    if (filters.startDate) {
      query.startTime.$gte = filters.startDate;
    }
    if (filters.endDate) {
      query.startTime.$lte = filters.endDate;
    }
  }

  return CallBooking.find(query)
    .populate("callOfferingId", "title duration coverImage intakeQuestions")
    .populate("bookerId", "name email profilePicture")
    .populate("callPurchaseId", "intakeAnswers")
    .sort({ startTime: 1 })
    .lean();
}

export async function completeCallBooking(
  bookingId: string,
  completedBy: string,
  founderNotes?: string
): Promise<ICallBooking | null> {
  const booking = await CallBooking.findById(bookingId);
  if (!booking) return null;

  if (booking.status !== "scheduled") {
    throw new Error("Only scheduled bookings can be marked as completed");
  }

  booking.status = "completed";
  booking.completedAt = new Date();
  booking.completedBy = new Types.ObjectId(completedBy);
  if (founderNotes) {
    booking.founderNotes = founderNotes;
  }

  await booking.save();

  // Update purchase stats
  await CallPurchase.findByIdAndUpdate(booking.callPurchaseId, {
    $inc: { quantityUsed: 1, quantityScheduled: -1 },
  });

  // Update call offering stats
  await CallOffering.findByIdAndUpdate(booking.callOfferingId, {
    $inc: { totalUsed: 1 },
  });

  return booking;
}

export async function cancelCallBooking(
  bookingId: string,
  cancelledBy: string,
  reason?: string
): Promise<ICallBooking | null> {
  const booking = await CallBooking.findById(bookingId);
  if (!booking) return null;

  if (booking.status !== "scheduled") {
    throw new Error("Only scheduled bookings can be cancelled");
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancelledBy = new Types.ObjectId(cancelledBy);
  booking.cancellationReason = reason;

  await booking.save();

  // Update purchase stats - decrement scheduled count
  await CallPurchase.findByIdAndUpdate(booking.callPurchaseId, {
    $inc: { quantityScheduled: -1 },
  });

  return booking;
}

export async function rescheduleCallBooking(
  bookingId: string,
  newStartTime: Date
): Promise<ICallBooking | null> {
  const booking = await CallBooking.findById(bookingId).populate(
    "callOfferingId"
  );
  if (!booking) return null;

  if (booking.status !== "scheduled") {
    throw new Error("Only scheduled bookings can be rescheduled");
  }

  const callOffering = booking.callOfferingId as any;
  const duration = callOffering.duration;
  const newEndTime = new Date(
    new Date(newStartTime).getTime() + duration * 60 * 1000
  );

  // Check for conflicts (excluding current booking)
  const existingBooking = await CallBooking.findOne({
    _id: { $ne: bookingId },
    founderId: booking.founderId,
    status: "scheduled",
    $or: [
      {
        startTime: { $lt: newEndTime },
        endTime: { $gt: newStartTime },
      },
    ],
  });

  if (existingBooking) {
    throw new Error("This time slot is not available");
  }

  booking.startTime = newStartTime;
  booking.endTime = newEndTime;

  await booking.save();
  return booking;
}

export async function rateCallBooking(
  bookingId: string,
  rating: number,
  review?: string
): Promise<ICallBooking | null> {
  const booking = await CallBooking.findById(bookingId);
  if (!booking) return null;

  if (booking.status !== "completed") {
    throw new Error("Only completed bookings can be rated");
  }

  if (booking.rating) {
    throw new Error("This booking has already been rated");
  }

  booking.rating = rating;
  booking.review = review;
  booking.ratedAt = new Date();

  await booking.save();

  // Update call offering average rating
  const allRatings = await CallBooking.find({
    callOfferingId: booking.callOfferingId,
    rating: { $exists: true, $ne: null },
  }).lean();

  const totalRatings = allRatings.reduce((sum, b) => sum + (b.rating || 0), 0);
  const averageRating = totalRatings / allRatings.length;

  await CallOffering.findByIdAndUpdate(booking.callOfferingId, {
    averageRating: Math.round(averageRating * 10) / 10,
    reviewCount: allRatings.length,
  });

  return booking;
}

// ==================== STATS ====================

interface CallOfferingStats {
  totalPurchases: number;
  totalCallsPurchased: number;
  totalCallsUsed: number;
  totalCallsScheduled: number;
  totalRevenue: number;
  averageRating: number | null;
  reviewCount: number;
}

export async function getCallOfferingStats(
  callOfferingId: string
): Promise<CallOfferingStats> {
  const callOffering = await CallOffering.findById(callOfferingId);
  if (!callOffering) {
    throw new Error("Call offering not found");
  }

  const purchases = await CallPurchase.find({
    callOfferingId: new Types.ObjectId(callOfferingId),
    paymentStatus: "completed",
  }).lean();

  const totalRevenue = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

  return {
    totalPurchases: callOffering.purchaseCount,
    totalCallsPurchased: callOffering.totalPurchased,
    totalCallsUsed: callOffering.totalUsed,
    totalCallsScheduled: callOffering.totalScheduled,
    totalRevenue,
    averageRating: callOffering.averageRating || null,
    reviewCount: callOffering.reviewCount,
  };
}
