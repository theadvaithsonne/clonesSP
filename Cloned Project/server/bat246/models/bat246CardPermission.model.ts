import { Schema, model, Types } from "mongoose";

// Grants a specific user admin access to one Bat246 Admin card, without
// giving them full ("Alan K") access to everything. One doc per
// (user, card) grant. See bat246Permission.service.ts for the check helper
// and bat246Permission.routes.ts for the admin-facing grant/revoke API.
export const BAT246_CARD_KEYS = [
  "boards",
  "members",
  "distributors",
  "documentation",
  "lostmoney",
  "inviteandplace",
  "b2coinwallet",
  "snapbackloans",
] as const;

export type Bat246CardKey = (typeof BAT246_CARD_KEYS)[number];

export interface IBat246CardPermission {
  userId: Types.ObjectId;
  cardKey: Bat246CardKey;
  grantedByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const bat246CardPermissionSchema = new Schema<IBat246CardPermission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cardKey: { type: String, enum: BAT246_CARD_KEYS, required: true },
    grantedByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

// One grant per (user, card) — grant is idempotent via upsert against this.
bat246CardPermissionSchema.index({ userId: 1, cardKey: 1 }, { unique: true });

export const Bat246CardPermission = model<IBat246CardPermission>(
  "Bat246CardPermission",
  bat246CardPermissionSchema
);
