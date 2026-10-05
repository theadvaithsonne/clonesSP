import { Types } from "mongoose";
export function dmConvId(
  a: string | Types.ObjectId,
  b: string | Types.ObjectId
) {
  const A = a.toString();
  const B = b.toString();
  return `dm:${[A, B].sort().join(":")}`;
}
