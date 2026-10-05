// The editors store each field's owner as an INDEX into the recipients list (`recipientIndex`), which also
// drives its colour. When that list is reordered or someone is removed the indices must follow the people,
// otherwise every field silently changes owner: moving Bob above Alice would hand Alice's fields to Bob, and
// removing a middle recipient would pass their fields on to the next person.

export interface RemapResult<F> {
  // Fields with `recipientIndex` updated to the owner's new position; fields whose owner was removed are gone.
  fields: F[];
  removed: F[];
  // indexMap[oldIndex] = newIndex, or -1 when that recipient was removed.
  indexMap: number[];
  // Recipients that were in `prev` but are not in `next`.
  removedRecipients: unknown[];
}

export function remapFieldOwners<R, F extends { recipientIndex: number }>(
  prev: R[],
  next: R[],
  fields: F[],
  keyOf: (recipient: R) => string
): RemapResult<F> {
  const nextIndexByKey = new Map(next.map((r, i) => [keyOf(r), i]));
  const indexMap = prev.map((r) => nextIndexByKey.get(keyOf(r)) ?? -1);

  const kept: F[] = [];
  const removed: F[] = [];
  for (const f of fields) {
    const newIndex = indexMap[f.recipientIndex];
    if (newIndex === undefined || newIndex === -1) removed.push(f);
    else kept.push(newIndex === f.recipientIndex ? f : { ...f, recipientIndex: newIndex });
  }

  const removedRecipients = prev.filter((r) => !nextIndexByKey.has(keyOf(r)));
  return { fields: kept, removed, indexMap, removedRecipients };
}

// A short name for a recipient on a field label ("Alice" from "Alice Smith" or "alice@x.com").
export const shortRecipientName = (r: { name?: string; email?: string } | undefined) =>
  ((r?.name || r?.email || "").split(/[\s@]/)[0] || "").trim();
