import mongoose, { Schema, Document, Types } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";
import {
  founderAlertsSchemaField,
  type IFounderAlerts,
} from "./founderAlerts.schema";

// A file attached to a milestone (brief, spec, asset pack, ...)
export interface IMilestoneAttachment {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
}

// Milestone interface - individual deliverable within a service
export interface IMilestone {
  _id: Types.ObjectId;
  order: number;
  title: string;
  description?: string;
  duration?: string; // e.g., "1-2 weeks"
  deliverables: string[]; // What the client receives at this stage
  attachments: IMilestoneAttachment[];
  paymentAmount: number;
  currency: string;
  // Per-milestone payment timing. Undefined on legacy documents, in which case
  // the service-level `paymentTiming` decides. See resolveMilestoneTiming().
  paymentTiming?: "advance" | "on_completion";
}

// Why Choose Us card
export interface IWhyChooseUs {
  icon: string;
  title: string;
  description: string;
}

// Contact info for "Reach out to us"
export interface IServiceContactInfo {
  phone?: string;
  email?: string;
  whatsapp?: string;
}

// A default task seeded into a provisioned engagement room.
// `kind` drives the badge shown in the board preview and decides whether the
// task is cloned into the client-visible part of the room.
// Who a seeded card belongs to. Provisioning resolves `userId` to a Taskroom
// user, adds them to the engagement room and creates the card in their name, so
// an assignment made in the wizard needs no repeating inside Taskroom.
export interface IServiceTaskAssignee {
  userId: string;
  name: string;
  email: string;
  image?: string;
}

export interface IServiceTaskTemplate {
  title: string;
  description?: string;
  kind: "required" | "task" | "internal";
  priority?: "low" | "medium" | "high";
  // Checklist items cloned as Taskroom subtasks under this card. A milestone
  // column seeds one card per milestone with its deliverables in here.
  subtasks?: string[];
  assignee?: IServiceTaskAssignee;
}

// A Kanban column seeded into a provisioned engagement room. Columns generated
// from milestones carry `milestoneIndex`; standalone columns (Internal Notes,
// Backlog) leave it undefined.
export interface IServiceStageTemplate {
  name: string;
  color?: string;
  // Taskroom v2 stage types: tostart | active | done | closed
  stageType: "tostart" | "active" | "done" | "closed";
  isInternal: boolean;
  milestoneIndex?: number;
  tasks: IServiceTaskTemplate[];
}

// What the client is allowed to see inside their engagement. Enforced
// server-side by the board proxy — never by the browser.
export interface IServiceClientAccess {
  showTaskroomBoard: boolean;
  showActivityLogs: boolean;
  enableFilesTab: boolean;
  revealTimelogSheet: boolean;
  showProgressStatusGauge: boolean;
}

// Blueprint copied into a fresh Taskroom room on every opt-in.
export interface IServiceTaskroomConfig {
  enabled: boolean;
  stages: IServiceStageTemplate[];
  clientAccess: IServiceClientAccess;
  // Optional pinned destination. When absent, provisioning resolves (or
  // creates) a "Client Engagements" space in the founder's workspace.
  workspaceId?: string;
  spaceId?: string;
}

/**
 * Hourly / retainer billing configuration, used when `pricingModel` is
 * "billable". Milestones are not part of that model — the engagement is billed
 * from the hours logged on its Taskroom room instead.
 */
export type BillingModelType = "hourly" | "retainer";
export type BillingCycle = "weekly" | "bi_weekly" | "monthly";
export type BillingStartDay =
  | "1st_of_month"
  | "15th_of_month"
  | "contract_start"
  | "monday";

/**
 * A person delivering a billable engagement, and what an hour of their time
 * costs.
 *
 * `payRate` is internal: it is the cost side of the margin against
 * `hourlyRate`, which is what the client is billed. Rates differ per person, so
 * they are held per member rather than on the service, and every route that can
 * answer a non-founder strips this field before responding.
 */
export interface IServiceTeamMember {
  userId: string;
  name: string;
  email: string;
  image?: string;
  payRate: number;
  role?: string;
}

export interface IServiceHourlyConfig {
  billingModelType: BillingModelType;
  /** Rate per hour, in the service's currency. */
  hourlyRate: number;
  /** What the founder expects to bill in a month — a projection, not a floor. */
  estimatedMonthlyHours: number;
  /** When true, the client is not held to the estimate. */
  noMinimumCommitment: boolean;
  billingCycle: BillingCycle;
  billingStartDay: BillingStartDay;
  /** Hard ceiling on billable hours per cycle. */
  hardCapEnabled: boolean;
  maxHoursPerMonth?: number;
  /** Hours must be approved on the timesheet before they can be invoiced. */
  timesheetApprovalRequired: boolean;
  securityDepositEnabled: boolean;
  securityDepositAmount?: number;
  // Who delivers the engagement, and what each of them is paid per hour. Every
  // member is added to the provisioned Taskroom room.
  team?: IServiceTeamMember[];
}

// Main Service interface
export interface IService extends Document {
  _id: Types.ObjectId;

  // Core identity
  title: string;
  slug: string;
  description?: string;
  longDescription?: string;

  // Visual/display
  icon?: string;
  iconBgColor?: string;
  coverImage?: string;

  // Metadata arrays
  tags: string[];
  features: string[];
  deliverables: string[];

  // Gallery media
  images: string[];
  videos: string[];
  youtubeUrl?: string;

  // Service info
  category?: string; // e.g., "UI/UX Design & Strategy"
  duration?: string; // e.g., "4-12 weeks"

  // Payment settings
  pricingModel: "milestone" | "billable";
  paymentTiming: "free" | "pay_before_milestone" | "pay_after_milestone";
  currency: string;
  totalPrice: number; // Sum of all milestone payments (computed)

  // Tax handling: "inclusive" = listed price already contains local taxes,
  // "exclusive" = tax is calculated at the invoice step.
  taxMode: "inclusive" | "exclusive";

  // Upfront retainer collected at booking, separate from milestone payments
  bookingAdvanceFeeEnabled: boolean;
  bookingAdvanceFee: number;

  cancellationPolicy?: string;

  // Hourly billing setup. Present only on `pricingModel: "billable"` services;
  // absent on milestone services and on anything created before this existed.
  hourlyConfig?: IServiceHourlyConfig;

  // Milestones (the core of the service)
  milestones: IMilestone[];

  // Ownership
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;

  // "Notify me when someone opts in" — founder-side alert, see
  // models/founderAlerts.schema.ts.
  founderAlerts?: IFounderAlerts;

  // Channel association (optional - for channel-specific services)
  channelIds: Types.ObjectId[];

  // User restriction (optional - when non-empty, only these users can see/opt into the service)
  allowedUserIds: Types.ObjectId[];

  // Status
  status: "draft" | "active" | "archived";

  // Stats
  projectsCompleted: number;
  activeOptIns: number;

  // Detail page fields
  whyChooseUs?: IWhyChooseUs[];
  contactInfo?: IServiceContactInfo;

  // Taskroom blueprint + client visibility switches
  taskroomConfig?: IServiceTaskroomConfig;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneAttachmentSchema = new Schema<IMilestoneAttachment>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    size: { type: Number },
    contentType: { type: String, trim: true },
  },
  { _id: false }
);

const MilestoneSchema = new Schema<IMilestone>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      default: () => new Types.ObjectId(),
    },
    order: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    duration: {
      type: String,
      trim: true,
    },
    deliverables: {
      type: [String],
      default: [],
    },
    attachments: {
      type: [MilestoneAttachmentSchema],
      default: [],
    },
    paymentAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "USD",
    },
    paymentTiming: {
      type: String,
      enum: ["advance", "on_completion"],
      // No default: legacy milestones fall back to the service-level setting.
    },
  },
  { _id: false }
);

const WhyChooseUsSchema = new Schema<IWhyChooseUs>(
  {
    icon: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ServiceContactInfoSchema = new Schema<IServiceContactInfo>(
  {
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
  },
  { _id: false }
);

const ServiceTaskAssigneeSchema = new Schema<IServiceTaskAssignee>(
  {
    userId: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    image: { type: String, trim: true },
  },
  { _id: false }
);

const ServiceTeamMemberSchema = new Schema<IServiceTeamMember>(
  {
    userId: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    image: { type: String, trim: true },
    // Internal cost per hour — stripped from every non-founder response.
    payRate: { type: Number, default: 0, min: 0 },
    role: { type: String, trim: true },
  },
  { _id: false }
);

const ServiceTaskTemplateSchema = new Schema<IServiceTaskTemplate>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    kind: {
      type: String,
      enum: ["required", "task", "internal"],
      default: "task",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    subtasks: {
      type: [String],
      default: [],
    },
    assignee: { type: ServiceTaskAssigneeSchema, default: undefined },
  },
  { _id: false }
);

const ServiceStageTemplateSchema = new Schema<IServiceStageTemplate>(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, trim: true, default: "#008080" },
    stageType: {
      type: String,
      enum: ["tostart", "active", "done", "closed"],
      default: "tostart",
    },
    isInternal: { type: Boolean, default: false },
    milestoneIndex: { type: Number },
    tasks: { type: [ServiceTaskTemplateSchema], default: [] },
  },
  { _id: false }
);

const ServiceClientAccessSchema = new Schema<IServiceClientAccess>(
  {
    showTaskroomBoard: { type: Boolean, default: true },
    showActivityLogs: { type: Boolean, default: true },
    enableFilesTab: { type: Boolean, default: true },
    revealTimelogSheet: { type: Boolean, default: false },
    showProgressStatusGauge: { type: Boolean, default: true },
  },
  { _id: false }
);

const ServiceTaskroomConfigSchema = new Schema<IServiceTaskroomConfig>(
  {
    enabled: { type: Boolean, default: false },
    stages: { type: [ServiceStageTemplateSchema], default: [] },
    clientAccess: {
      type: ServiceClientAccessSchema,
      default: () => ({}),
    },
    workspaceId: { type: String, trim: true },
    spaceId: { type: String, trim: true },
  },
  { _id: false }
);

const ServiceHourlyConfigSchema = new Schema<IServiceHourlyConfig>(
  {
    billingModelType: {
      type: String,
      enum: ["hourly", "retainer"],
      default: "hourly",
    },
    hourlyRate: { type: Number, default: 0, min: 0 },
    estimatedMonthlyHours: { type: Number, default: 0, min: 0 },
    noMinimumCommitment: { type: Boolean, default: false },
    billingCycle: {
      type: String,
      enum: ["weekly", "bi_weekly", "monthly"],
      default: "monthly",
    },
    billingStartDay: {
      type: String,
      enum: ["1st_of_month", "15th_of_month", "contract_start", "monday"],
      default: "1st_of_month",
    },
    hardCapEnabled: { type: Boolean, default: false },
    // Only meaningful with the cap on; the route strips it otherwise.
    maxHoursPerMonth: { type: Number, min: 0 },
    timesheetApprovalRequired: { type: Boolean, default: true },
    securityDepositEnabled: { type: Boolean, default: false },
    securityDepositAmount: { type: Number, min: 0 },
    team: { type: [ServiceTeamMemberSchema], default: [] },
  },
  { _id: false }
);

const ServiceSchema = new Schema<IService>(
  {
    // Core identity
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    longDescription: {
      type: String,
      trim: true,
    },

    // Visual/display
    icon: {
      type: String,
      trim: true,
    },
    iconBgColor: {
      type: String,
      trim: true,
    },
    coverImage: {
      type: String,
      trim: true,
    },

    // Metadata arrays
    tags: {
      type: [String],
      default: [],
    },
    features: {
      type: [String],
      default: [],
    },
    deliverables: {
      type: [String],
      default: [],
    },

    // Gallery media
    images: {
      type: [String],
      default: [],
    },
    videos: {
      type: [String],
      default: [],
    },
    youtubeUrl: {
      type: String,
      trim: true,
    },

    // Service info
    category: {
      type: String,
      trim: true,
    },
    duration: {
      type: String,
      trim: true,
    },

    // Payment settings
    pricingModel: {
      type: String,
      enum: ["milestone", "billable"],
      default: "milestone",
    },
    paymentTiming: {
      type: String,
      enum: ["free", "pay_before_milestone", "pay_after_milestone"],
      default: "free",
    },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "USD",
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxMode: {
      type: String,
      enum: ["inclusive", "exclusive"],
      default: "inclusive",
    },
    bookingAdvanceFeeEnabled: {
      type: Boolean,
      default: false,
    },
    bookingAdvanceFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    cancellationPolicy: {
      type: String,
      trim: true,
    },

    // Milestones
    milestones: {
      type: [MilestoneSchema],
      default: [],
    },

    // Ownership
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Founder-side "someone opted into this service" alert. No template —
    // see services/founderAlertEmail.ts.
    founderAlerts: founderAlertsSchemaField,

    // Channel association
    channelIds: {
      type: [Schema.Types.ObjectId],
      ref: "Channel",
      default: [],
    },

    // User restriction (empty = visible to all, non-empty = restricted to listed users)
    allowedUserIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

    // Status
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
    },

    // Stats
    projectsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    activeOptIns: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Detail page fields
    whyChooseUs: {
      type: [WhyChooseUsSchema],
      default: undefined,
    },
    contactInfo: {
      type: ServiceContactInfoSchema,
      default: undefined,
    },

    // Hourly billing setup, for `pricingModel: "billable"` services.
    hourlyConfig: {
      type: ServiceHourlyConfigSchema,
      default: undefined,
    },

    // Taskroom blueprint. Absent on services created before the integration —
    // those simply never provision a room.
    taskroomConfig: {
      type: ServiceTaskroomConfigSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for organization + slug uniqueness
ServiceSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

// Index for status filtering
ServiceSchema.index({ organizationId: 1, status: 1 });

// Index for creator's services
ServiceSchema.index({ createdBy: 1, status: 1 });

// Index for channel filtering
ServiceSchema.index({ channelIds: 1 });

// Index for user-restricted service queries
ServiceSchema.index({ allowedUserIds: 1 });

// Pre-save hook to calculate total price from milestones
ServiceSchema.pre("save", function (next) {
  if (this.milestones && this.milestones.length > 0) {
    this.totalPrice = this.milestones.reduce(
      (sum, milestone) => sum + (milestone.paymentAmount || 0),
      0
    );
  } else {
    this.totalPrice = 0;
  }
  next();
});

installCatalogHooks(ServiceSchema, "service");

export const Service = mongoose.model<IService>("Service", ServiceSchema);
