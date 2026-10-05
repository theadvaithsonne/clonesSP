// Types for the Thoughts (Notes) application

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isStarred: boolean;
  isArchived: boolean;
  isDeleted?: boolean;
  isPinned?: boolean;
  /** Parent note id for Notion-style sub-pages; null/undefined = root */
  parentId?: string | null;
  /** Notion-style page emoji/icon */
  icon?: string | null;
  /** Notion-style cover image URL or `gradient:...` */
  coverUrl?: string | null;
  /** Cover focal point 0–100 (object-position Y) */
  coverPosition?: number | null;
  /** Page-level comments shown under the title */
  comments?: NotePageComment[];
  /** Whether the page comments section is open */
  commentsOpen?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  userId?: string;
  collaborators?: Array<{ userId?: string; id?: string; email?: string; name?: string; role?: string }>;
  accessRole?: "owner" | "Full access" | "Can edit" | "Can comment" | "Can view";
  canEdit?: boolean;
  canComment?: boolean;
  canShare?: boolean;
  isOwner?: boolean;
  hasChildren?: boolean;
}

export interface NotePageComment {
  id: string;
  author: string;
  authorInitials: string;
  text: string;
  createdAt: string;
}

export interface NoteBreadcrumbItem {
  id: string;
  title: string;
  icon?: string | null;
  hasChildren?: boolean;
  parentId?: string | null;
}

export interface NoteColor {
  name: string;
  value: string;
  class: string;
}

export interface CreateNoteData {
  title: string;
  content: string;
  color?: string;
  tags?: string[];
  parentId?: string | null;
  icon?: string | null;
  coverUrl?: string | null;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  color?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  isPinned?: boolean;
  tags?: string[];
  icon?: string | null;
  coverUrl?: string | null;
  coverPosition?: number | null;
  comments?: NotePageComment[];
  commentsOpen?: boolean;
}

export interface NoteFilter {
  query?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  color?: string;
  tags?: string[];
}

export interface NotesResponse {
  notes: Note[];
  total: number;
  page?: number;
  limit?: number;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  userId: string;
  versionNumber: number;
  title: string;
  content: string;
  tags: string[];
  color: string;
  createdAt: string;
  metadata?: {
    updatedFrom?: string;
    previousUpdatedAt?: string;
    restoredVersionId?: string;
    restoredVersionNumber?: number;
  };
}

export interface NoteVersionsResponse {
  noteId: string;
  versions: NoteVersion[];
  total: number;
}

export interface RestoreVersionResponse {
  message: string;
  note: Note;
  restoredVersion: NoteVersion;
}

export interface NoteActions {
  onStar: (noteId: string) => void;
  onArchive: (noteId: string) => void;
  onDelete: (noteId: string) => void;
  onRestore: (noteId: string) => void;
  onPin: (noteId: string) => void;
  onColorChange: (noteId: string, color: string) => void;
  onEdit: (note: Note) => void;
}

export type ViewMode = "grid" | "list";
export type SortBy = "updated" | "created" | "title";
export type SortOrder = "asc" | "desc";

// Default color palette for notes (lighter, more professional)
export const NOTE_COLORS: NoteColor[] = [
  { name: "Default", value: "#ffffff", class: "bg-white border border-gray-200" },
  { name: "Red", value: "#fef2f2", class: "bg-red-50 border border-red-100" },
  { name: "Orange", value: "#fff7ed", class: "bg-orange-50 border border-orange-100" },
  { name: "Yellow", value: "#fefce8", class: "bg-yellow-50 border border-yellow-100" },
  { name: "Green", value: "#f0fdf4", class: "bg-green-50 border border-green-100" },
  { name: "Teal", value: "#f0fdfa", class: "bg-teal-50 border border-teal-100" },
  { name: "Blue", value: "#eff6ff", class: "bg-blue-50 border border-blue-100" },
  { name: "Indigo", value: "#eef2ff", class: "bg-indigo-50 border border-indigo-100" },
  { name: "Purple", value: "#faf5ff", class: "bg-purple-50 border border-purple-100" },
  { name: "Pink", value: "#fdf2f8", class: "bg-pink-50 border border-pink-100" },
  { name: "Brown", value: "#fef3c7", class: "bg-amber-50 border border-amber-100" },
  { name: "Gray", value: "#f9fafb", class: "bg-gray-50 border border-gray-200" },
];

// Helper function to get color class from hex value
export const getColorClass = (color: string): string => {
  const colorOption = NOTE_COLORS.find(c => c.value === color);
  return colorOption?.class || "bg-white border border-gray-200";
};

// Helper function to format date
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffSeconds = Math.floor(diffTime / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
};

// Helper function to truncate text
export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

// Helper function to extract plain text from BlockNote JSON content
export const extractTextFromBlocks = (content: string): string => {
  try {
    // Try to parse as JSON (BlockNote format)
    const blocks = JSON.parse(content);

    if (!Array.isArray(blocks)) {
      return content; // Return as-is if not an array
    }

    // Extract text from all blocks recursively
    const extractFromBlock = (block: any): string => {
      let text = "";

      // Handle different block types
      if (block.content) {
        if (Array.isArray(block.content)) {
          // Nested content (like inline content)
          text += block.content.map((item: any) => {
            if (typeof item === "string") return item;
            if (item.text) return item.text;
            if (item.content) return extractFromBlock(item);
            return "";
          }).join("");
        } else if (typeof block.content === "string") {
          text += block.content;
        } else if (typeof block.content === "object") {
          text += extractFromBlock(block.content);
        }
      }

      // Handle text property (for inline content)
      if (block.text) {
        text += block.text;
      }

      // Handle children blocks
      if (block.children && Array.isArray(block.children)) {
        text += " " + block.children.map(extractFromBlock).join(" ");
      }

      return text;
    };

    // Extract text from all blocks and join with line breaks
    const extractedText = blocks
      .map(extractFromBlock)
      .filter(text => text.trim().length > 0)
      .join("\n");

    return extractedText || content;
  } catch (e) {
    // If parsing fails, return original content (old plain text format)
    return content;
  }
};

// Helper function to get note preview text
export const getNotePreview = (content: string, maxLength: number = 300): string => {
  const plainText = extractTextFromBlocks(content);
  return truncateText(plainText, maxLength);
};