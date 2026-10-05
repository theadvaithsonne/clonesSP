"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DsAssignableRole, DsRole } from "@/lib/docusign/types";

// What each assignable role means — the same rules lib/docusign/access.ts and the backend enforce.
const OPTIONS: Array<{ value: Exclude<DsAssignableRole, "none">; label: string; description: string }> = [
  { value: "admin", label: "Admin", description: "Manage members, settings and all documents" },
  { value: "sender", label: "Sender", description: "Send documents and create templates" },
];

interface RoleSelectProps {
  // The member's current role — never "founder" here (founders get a static chip instead).
  value: DsRole;
  onChange: (role: DsAssignableRole) => void;
  isSaving?: boolean;
  memberLabel: string;
}

export function RoleSelect({ value, onChange, isSaving, memberLabel }: RoleSelectProps) {
  const current = OPTIONS.find((o) => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isSaving}
        aria-label={`Change role for ${memberLabel}`}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-3 text-xs text-white/85 transition-colors hover:border-[#3b3b4a] focus:outline-none focus-visible:border-[#3b3b4a] disabled:opacity-60 data-[state=open]:border-[#3b3b4a]"
      >
        <span className={cn(!current && "text-[#7a7a90]")}>{current ? current.label : "No role"}</span>
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7a7a90]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#7a7a90]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px] rounded-xl border-[#2a2a35] bg-[#16161c] p-1 text-white">
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => o.value !== value && onChange(o.value)}
            className="items-start gap-3 rounded-lg px-3 py-2.5 focus:bg-white/[0.05] focus:text-white"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white/90">{o.label}</p>
              <p className="text-[11px] text-white/45">{o.description}</p>
            </div>
            {o.value === value && <Check className="mt-1.5 h-4 w-4 text-brand" />}
          </DropdownMenuItem>
        ))}
        {current && (
          <>
            <DropdownMenuSeparator className="bg-[#2a2a35]" />
            <DropdownMenuItem
              onSelect={() => onChange("none")}
              className="items-start rounded-lg px-3 py-2.5 focus:bg-red-500/10 focus:text-red-300"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-red-400">Remove role</p>
                <p className="text-[11px] text-white/45">Can still sign documents sent to them</p>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
