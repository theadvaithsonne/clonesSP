import { Schema, model } from "mongoose";

const EducationSchema = new Schema(
  {
    degreeName: { type: String },
    yearOfPassing: { type: String },
    certificateUrl: { type: String },
  },
  { _id: false }
);

const WorkExperienceSchema = new Schema(
  {
    companyName: { type: String },
    yearsOfExperience: { type: String },
    designation: { type: String },
    referenceName: { type: String },
    referenceContact: { type: String },
  },
  { _id: false }
);

const CustomAmountSchema = new Schema(
  {
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const TeamforceEmployeeProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    // Teamforce-specific role (does NOT affect Garage org role)
    teamforceRole: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },

    // Basic & Personal
    mobileNumber: { type: String },
    pan: { type: String, trim: true, uppercase: true },
    /** ISO date — drives age-tiered Old Regime tax slabs and senior-citizen
     *  declarations (80D parent cap, 80TTB). Optional for back-compat. */
    dateOfBirth: { type: Date },
    permanentAddress: { type: String },
    currentAddress: { type: String },
    sameAsPermanent: { type: Boolean, default: false },

    // Joining & Organization
    dateOfJoining: { type: Date },
    placeOfJoining: { type: String },
    branchId: { type: Schema.Types.ObjectId, ref: "TeamforceBranch" },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "TeamforceDepartment",
    },
    designation: { type: String },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "intern", "freelance"],
    },
    state: { type: String, trim: true },
    cityType: { type: String, enum: ["METRO", "NON_METRO"] },

    // Reporting & Hierarchy
    reportingManagerId: { type: Schema.Types.ObjectId, ref: "User" },
    secondaryReviewerId: { type: Schema.Types.ObjectId, ref: "User" },
    managesTeam: { type: Boolean, default: false },

    // Education
    education: [EducationSchema],

    // Work Experience
    workExperience: [WorkExperienceSchema],

    // Salary Structure
    salaryStructureId: {
      type: Schema.Types.ObjectId,
      ref: "TeamforceSalaryStructure",
    },
    /** Monthly CTC anchor — drives % of CTC components. Engine reads this. */
    monthlyCtc: { type: Number, default: 0 },
    basicSalary: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    providentFund: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    variablePay: { type: Number, default: 0 },
    customAllowances: [CustomAmountSchema],
    customDeductions: [CustomAmountSchema],
    pfOption: { type: String, enum: ["CEILING", "ACTUAL"], default: "CEILING" },
    esiApplicable: { type: Boolean, default: false },

    // Tax (TDS)
    tdsRegime: { type: String, enum: ["new", "old"] },
    estimatedAnnualTds: { type: Number, default: 0 },
    autoCalculateTds: { type: Boolean, default: false },

    // Attendance & Policy
    shiftId: { type: Schema.Types.ObjectId, ref: "TeamforceShift" },
    weeklyOffPatternId: {
      type: Schema.Types.ObjectId,
      ref: "TeamforceWeeklyOffPattern",
    },
    /** Grace-window LOP days carried forward from the joining-month
     *  payroll. Consumed (and reset to 0) by the next payroll run. */
    deferredLopDays: { type: Number, default: 0, min: 0 },

    // Exit (Full & Final settlement) — spec §13.2
    /** Last working day. When set, the employee's next payroll run is
     *  treated as their final F&F run: TDS is the full remaining liability
     *  (not spread across remaining months). */
    exitedAt: { type: Date, default: null },
    exitReason: { type: String, default: "", trim: true },

    // Documents (S3 URLs)
    offerLetterUrl: { type: String },
    idProofUrl: { type: String },
    educationCertificatesUrl: { type: String },
    experienceLettersUrl: { type: String },

    // Bank Account Details
    bankAccountHolderName: { type: String },
    bankAccountType: { type: String, enum: ["savings", "current"] },
    bankAccountNumber: { type: String },
    bankIfscCode: { type: String },
  },
  { timestamps: true }
);

TeamforceEmployeeProfileSchema.index(
  { userId: 1, orgId: 1 },
  { unique: true }
);
TeamforceEmployeeProfileSchema.index({ orgId: 1 });

export const TeamforceEmployeeProfile = model(
  "TeamforceEmployeeProfile",
  TeamforceEmployeeProfileSchema
);
