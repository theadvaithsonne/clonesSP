export type NoteShareRole = "Full access" | "Can edit" | "Can comment" | "Can view";

export interface NoteCollaborator {
  userId?: string;
  id?: string;
  role?: string;
}

export interface NoteAccess {
  accessRole: "owner" | NoteShareRole | null;
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
  isOwner: boolean;
  label: string | null;
}

const EDIT_ROLES = new Set<NoteShareRole>(["Full access", "Can edit"]);
const COMMENT_ROLES = new Set<NoteShareRole>(["Full access", "Can edit", "Can comment"]);

export function resolveNoteAccess(
  note?: { userId?: string; collaborators?: NoteCollaborator[] } | null,
  currentUserId?: string | null
): NoteAccess {
  if (!note) {
    return {
      accessRole: null,
      canEdit: false,
      canComment: false,
      canShare: false,
      isOwner: false,
      label: null,
    };
  }

  // Unsaved local notes — full access for the creator
  if (!note.userId || note.userId === currentUserId) {
    return {
      accessRole: "owner",
      canEdit: true,
      canComment: true,
      canShare: true,
      isOwner: true,
      label: null,
    };
  }

  const collab = (note.collaborators || []).find(
    (c) => c.userId === currentUserId || c.id === currentUserId
  );
  const role = (collab?.role || "Can view") as NoteShareRole;
  const canEdit = EDIT_ROLES.has(role);
  const canComment = COMMENT_ROLES.has(role);

  return {
    accessRole: role,
    canEdit,
    canComment,
    canShare: false,
    isOwner: false,
    label: canEdit ? null : canComment ? "Can comment" : "View only",
  };
}
