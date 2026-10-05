"use client";

// Action panel for an affiliate (or their upline), opened from the Name /
// Upline Details cells of the One Time Affiliates table. Two actions, mirroring
// the NetworkChains downline panel:
//   - Open View    — view the affiliates table from this person's perspective
//                    (their downline; backend ?rootUserId).
//   - View Profile — open this person's full profile page.
// Same portal + framer-motion right-side shell as InvoiceDetailDrawer.

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronRight, UserRound, Eye } from "lucide-react";
import { useRouter } from "next/navigation";

// The extra fields are optional so existing callers that pass only
// `{_id, name}` still typecheck; callers that have the richer user summary
// get it handed back through onOpenView (the scope chip needs the avatar).
export type AffiliatePerson = {
  _id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  profilePicture?: string | null;
  country?: string | null;
} | null;

export function AffiliateMemberDrawer({
  person,
  onClose,
  onOpenView,
  profileBasePath = "/garage-admin/one-time-affiliates",
}: {
  person: AffiliatePerson;
  onClose: () => void;
  onOpenView: (p: NonNullable<AffiliatePerson>) => void;
  /** Route the "View Profile" action navigates to, as `<base>/<userId>`. Each
   *  admin page has its own profile page (own breadcrumb), so it passes its own
   *  base — One Time Affiliates / Users / NetworkChain Subs. */
  profileBasePath?: string;
}) {
  const router = useRouter();
  const open = !!person;
  if (typeof document === "undefined") return null;

  const body = (
    <AnimatePresence>
      {open && person && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-end bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="mr-6 flex h-[calc(100vh-48px)] w-[440px] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <p className="truncate text-base font-bold text-white">
                {person.name || "Member"}
              </p>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {/* Open View — re-root the table at this person. */}
              <button
                type="button"
                onClick={() => onOpenView(person)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/80">
                  <Eye className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">Open View</div>
                  <div className="text-xs text-zinc-500">
                    View the table from this person&apos;s perspective
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
              </button>

              {/* View Profile — open the full profile page. */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`${profileBasePath}/${person._id}`);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/80">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">View Profile</div>
                  <div className="text-xs text-zinc-500">
                    See this person&apos;s full profile
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(body, document.body);
}
