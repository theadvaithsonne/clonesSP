import type { DsDeliveryMode } from "@/lib/docusign/types";
import type { DsDocument } from "@/lib/docusign/internal-api";
import type { DsExternalDocument } from "@/lib/docusign/external-api";

// What a caller already knows about a document at the moment it navigates into a field
// editor, handed over so the editor can render its shell and start downloading the PDF
// immediately rather than waiting a getDocumentDetail round-trip to learn it.
//
// Why this exists: the editor used to open on a strictly serial chain — fetch the detail
// JSON, THEN mount <Document>, THEN fetch the 1.26 MB pdf.js worker, THEN download the PDF
// from S3, THEN parse it — with an opaque overlay across all of it. The detail call and the
// S3 download have no actual dependency on each other; they were sequential only because
// the URL arrived with the JSON. Every entry point (list rows, template instantiation,
// upload dialogs) already holds the full document, so it can supply the URL up front and
// let the two overlap.
//
// This is a head start, never a source of truth: the editor's loadDocument() overwrites
// every one of these fields when it lands.
export interface DocumentSeed {
  title: string;
  status: string;
  // The PDF to render. MUST be resolved the same way the editors resolve it
  // (`flattenedFileUrl || originalFileUrl`) — seeding the original for an already-completed
  // document would download the wrong file and then re-download the flattened one, making
  // the open slower than before rather than faster.
  fileUrl: string;
  // Drives how many placeholder pages to show while pdf.js parses. Absent on older
  // documents (the backend takes pageCount from the client at upload time and never derives
  // it), in which case the editor just shows its spinner as it did before.
  pageCount?: number;
  deliveryMode?: DsDeliveryMode;
}

export const seedFromDocument = (doc: DsDocument | DsExternalDocument): DocumentSeed => ({
  title: doc.title,
  status: doc.status,
  fileUrl: doc.flattenedFileUrl || doc.originalFileUrl,
  pageCount: doc.pageCount,
  deliveryMode: doc.deliveryMode,
});
