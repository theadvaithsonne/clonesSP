// The composed store shape. Lives in its own file so each slice can type its `set`/`get`
// against the whole store (a slice legitimately reads fields other slices own) without the
// slices having to import the store module that creates them.

import type { SharedSlice } from "./sharedSlice";
import type { InternalSlice } from "./internalSlice";
import type { ExternalSlice } from "./externalSlice";

export type DocusignState = SharedSlice & InternalSlice & ExternalSlice;
