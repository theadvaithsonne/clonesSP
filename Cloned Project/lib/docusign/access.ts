// Who may do what in Docusign, from the synced profile (`me`). The backend enforces all of this
// (middlewares/requireDocusignAdmin.js, utils/documentAccess.util.js); these only decide what to show.
//
// - Founder: always full access.
// - Admin:   manage members, settings and every document in the org (Dashboard, folders, Admin tab).
// - Sender:  create/send documents and templates, but only sees their own documents plus the ones
//            sent to them to sign — no Dashboard, folders or Admin tab.
// - Anyone else: signs what is sent to them ("Assigned to Me").

import type { DsRole, DsUser } from "./types";

type Profile = Pick<DsUser, "role" | "isDocusignAdmin" | "isDocusignSender"> | null | undefined;

export const isDocusignAdminUser = (me: Profile): boolean => !!me && (me.role === "founder" || !!me.isDocusignAdmin);

export const canSendDocuments = (me: Profile): boolean => isDocusignAdminUser(me) || !!me?.isDocusignSender;

export const docusignRoleOf = (me: Profile): DsRole =>
  !me ? null : me.role === "founder" ? "founder" : me.isDocusignAdmin ? "admin" : me.isDocusignSender ? "sender" : null;

export const ROLE_LABELS: Record<Exclude<DsRole, null>, string> = { founder: "Founder", admin: "Admin", sender: "Sender" };

// How the sender is attributed under their message in the emails ("— Name, Admin"). Same labels the
// backend's roleLabel uses.
export const senderRoleLabel = (me: Profile): string | undefined => {
  const role = docusignRoleOf(me);
  return role ? ROLE_LABELS[role] : undefined;
};
