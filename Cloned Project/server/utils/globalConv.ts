import { Types } from "mongoose";

export function globalDmConvId(
  a: string | Types.ObjectId,
  b: string | Types.ObjectId
) {
  const A = a.toString();
  const B = b.toString();
  return `global-dm:${[A, B].sort().join(":")}`;
}
