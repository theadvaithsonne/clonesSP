"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { X, FileText } from "lucide-react";
import type { InlineAppProps } from "../registry";

type ThoughtsSection =
  | "all-notes"
  | "starred"
  | "templates"
  | "archive"
  | "trash"
  | "recovery";

const ThoughtsAllNotesPage = dynamic(() => import("@/app/(dashboard)/thoughts/page"), {
  ssr: false,
});
const ThoughtsStarredPage = dynamic(() => import("@/app/(dashboard)/thoughts/starred/page"), {
  ssr: false,
});
const ThoughtsTemplatesPage = dynamic(() => import("@/app/(dashboard)/thoughts/templates/page"), {
  ssr: false,
});
const ThoughtsArchivePage = dynamic(() => import("@/app/(dashboard)/thoughts/archive/page"), {
  ssr: false,
});
const ThoughtsTrashPage = dynamic(() => import("@/app/(dashboard)/thoughts/trash/page"), {
  ssr: false,
});
const ThoughtsRecoveryPage = dynamic(() => import("@/app/(dashboard)/thoughts/recovery/page"), {
  ssr: false,
});

const SECTION_TITLE: Record<ThoughtsSection, string> = {
  "all-notes": "All Notes",
  starred: "Starred",
  templates: "Templates",
  archive: "Archive",
  trash: "Trash",
  recovery: "Recovery",
};

function resolveSection(section?: string): ThoughtsSection {
  if (
    section === "all-notes" ||
    section === "starred" ||
    section === "templates" ||
    section === "archive" ||
    section === "trash" ||
    section === "recovery"
  ) {
    return section;
  }
  return "all-notes";
}

export default function ThoughtsApp({ onClose, section }: InlineAppProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Set synchronously so child route pages detect inline mode
  if (typeof window !== "undefined") {
    (window as any).__garageThoughtsInline = true;
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        (window as any).__garageThoughtsInline = false;
      }
    };
  }, []);

  const activeSection = useMemo(() => {
    return resolveSection(section);
  }, [section]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Dispatch local custom event to trigger refresh inside thoughts components
    window.dispatchEvent(new CustomEvent("thoughts:inline-refresh", { detail: { section: activeSection } }));
    window.setTimeout(() => setIsRefreshing(false), 600);
  };

  const renderSection = () => {
    switch (activeSection) {
      case "starred":
        return <ThoughtsStarredPage />;
      case "templates":
        return <ThoughtsTemplatesPage />;
      case "archive":
        return <ThoughtsArchivePage />;
      case "trash":
        return <ThoughtsTrashPage />;
      case "recovery":
        return <ThoughtsRecoveryPage />;
      case "all-notes":
      default:
        return <ThoughtsAllNotesPage />;
    }
  };

  return (
    <div className="thoughts-inline-shell dark relative flex h-full flex-col bg-[#0e0e0e] text-white">

      <main className="flex-1 min-h-0 min-w-0 overflow-auto scrollbar-thin scrollbar-thumb-white/10">{renderSection()}</main>
      <style jsx global>{`
        .thoughts-inline-shell {
          color-scheme: dark;
        }

        .thoughts-inline-shell main {
          overflow-x: hidden;
        }

        /* Force dark app canvas for inline Thoughts pages */
        .thoughts-inline-shell,
        .thoughts-inline-shell [class*="bg-background"] {
          background-color: #0e0e0e !important;
        }

        /* Route pages use h-screen; inside inline app they should fit container */
        .thoughts-inline-shell .h-screen {
          height: 100% !important;
        }

        /* Normalize common light surfaces that appear in routed pages */
        .thoughts-inline-shell .bg-white,
        .thoughts-inline-shell [class*="bg-white"] {
          background-color: #13131a !important;
          color: #e7e7ee !important;
        }

        /* Tags in NoteCard */
        .thoughts-inline-shell [class*="bg-gray-200"] {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: var(--brand) !important;
          border: 1px solid color-mix(in srgb, var(--brand) 15%, transparent) !important;
        }

        /* Note Colors Overrides for Dark Mode */
        .thoughts-inline-shell [class*="bg-white"] {
          background-color: #13131a !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
        }
        .thoughts-inline-shell [class*="bg-red-50"] {
          background-color: rgba(239, 68, 68, 0.12) !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-orange-50"] {
          background-color: rgba(249, 115, 22, 0.12) !important;
          border-color: rgba(249, 115, 22, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-yellow-50"] {
          background-color: rgba(234, 179, 8, 0.12) !important;
          border-color: rgba(234, 179, 8, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-green-50"] {
          background-color: rgba(34, 197, 94, 0.12) !important;
          border-color: rgba(34, 197, 94, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-teal-50"] {
          background-color: rgba(20, 184, 166, 0.12) !important;
          border-color: rgba(20, 184, 166, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-blue-50"] {
          background-color: rgba(59, 130, 246, 0.12) !important;
          border-color: rgba(59, 130, 246, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-indigo-50"] {
          background-color: rgba(99, 102, 241, 0.12) !important;
          border-color: rgba(99, 102, 241, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-purple-50"] {
          background-color: rgba(168, 85, 247, 0.12) !important;
          border-color: rgba(168, 85, 247, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-pink-50"] {
          background-color: rgba(236, 72, 153, 0.12) !important;
          border-color: rgba(236, 72, 153, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-amber-50"] {
          background-color: rgba(245, 158, 11, 0.12) !important;
          border-color: rgba(245, 158, 11, 0.3) !important;
        }
        .thoughts-inline-shell [class*="bg-gray-50"] {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        /* Force readable text contrast */
        .thoughts-inline-shell [class*="text-[#1f1f1f]"],
        .thoughts-inline-shell [class*="text-[#111827]"],
        .thoughts-inline-shell [class*="text-[#374151]"],
        .thoughts-inline-shell [class*="text-gray-900"],
        .thoughts-inline-shell [class*="text-gray-800"],
        .thoughts-inline-shell [class*="text-gray-700"],
        .thoughts-inline-shell [class*="text-gray-600"] {
          color: #ececf4 !important;
        }

        .thoughts-inline-shell [class*="text-[#6b7280]"],
        .thoughts-inline-shell [class*="text-gray-500"],
        .thoughts-inline-shell [class*="text-gray-400"] {
          color: #b8bbcc !important;
        }

        .thoughts-inline-shell .text-black,
        .thoughts-inline-shell [class*="text-black"] {
          color: #e7e7ee !important;
        }

        /* Ensure cursor pointer on buttons inside thoughts inline shell */
        .thoughts-inline-shell button:not(:disabled),
        .thoughts-inline-shell [role="button"]:not(:disabled) {
          cursor: pointer !important;
        }

        /* Specifically ensure brand yellow buttons retain correct styling in dark mode */
        .thoughts-inline-shell button[class*="bg-brand"],
        .thoughts-inline-shell [class*="bg-brand"] {
          background-color: var(--brand) !important;
          color: var(--brand-foreground) !important;
        }
        .thoughts-inline-shell button[class*="bg-brand"]:hover,
        .thoughts-inline-shell [class*="bg-brand"]:hover,
        .thoughts-inline-shell button[class*="hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"]:hover,
        .thoughts-inline-shell [class*="hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"]:hover {
          background-color: color-mix(in srgb, var(--brand) 92%, black) !important;
          color: var(--brand-foreground) !important;
        }

        .thoughts-inline-shell [class*="border-[#e5e7eb]"],
        .thoughts-inline-shell [class*="border-gray-200"] {
          border-color: rgba(255, 255, 255, 0.14) !important;
        }

        .thoughts-inline-shell input,
        .thoughts-inline-shell select,
        .thoughts-inline-shell textarea {
          background-color: #16161f;
          color: #ececf4;
          border-color: rgba(255, 255, 255, 0.18);
        }

        /* BlockNote Editor Theme Overrides for Dark Mode */
        .thoughts-inline-shell .bn-editor {
          background-color: transparent !important;
          color: #ececf4 !important;
        }
        .thoughts-inline-shell .bn-editor [class*="bn-"] {
          color: #ececf4 !important;
        }
        .thoughts-inline-shell .bn-editor [data-theme="light"] {
          --bn-colors-editor-text: #ececf4 !important;
          --bn-colors-editor-background: transparent !important;
        }
      `}</style>
    </div>
  );
}
