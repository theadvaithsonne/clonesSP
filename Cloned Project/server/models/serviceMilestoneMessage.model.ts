import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * A message on one milestone of one service engagement (opt-in).
 *
 * Scoped to (serviceOptId, milestoneId) so the client and the founder get a
 * separate thread per milestone rather than one thread for the whole service.
 */
export interface IServiceMilestoneMessage extends Document {
  _id: Types.ObjectId;
  serviceOptId: Types.ObjectId;
  serviceId: Types.ObjectId;
  milestoneId: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  authorRole: "client" | "founder";
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceMilestoneMessageSchema = new Schema<IServiceMilestoneMessage>(
  {
    serviceOptId: {
      type: Schema.Types.ObjectId,
      ref: "ServiceOpt",
      required: true,
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    milestoneId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorRole: {
      type: String,
      enum: ["client", "founder"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
  },
  { timestamps: true }
);

ServiceMilestoneMessageSchema.index({ serviceOptId: 1, milestoneId: 1, createdAt: 1 });

export const ServiceMilestoneMessage =
  mongoose.models.ServiceMilestoneMessage ||
  mongoose.model<IServiceMilestoneMessage>(
    "ServiceMilestoneMessage",
    ServiceMilestoneMessageSchema
  );
