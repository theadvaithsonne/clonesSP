import { Schema, model } from "mongoose";

const Bat246ConfigSchema = new Schema(
  {
    boardCounter:    { type: Number, default: 0 },
    familyCounter:   { type: Number, default: 0 },
    familySequences: { type: Schema.Types.Mixed, default: {} },
    distributorIdCounter: { type: Number, default: 1000 },
    // Global sequential counter for POD "team" IDs (P-1001, P-1002, ...) —
    // one issued per board the first time ANY player is placed into its POD
    // cycle. See placeUserInPod() in bat246PodInvite.service.ts.
    podTeamCounter: { type: Number, default: 1000 },
  },
  { timestamps: true }
);

export const Bat246Config = model("bat246Config", Bat246ConfigSchema);
