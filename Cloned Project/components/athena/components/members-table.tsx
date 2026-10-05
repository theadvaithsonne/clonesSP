"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export type MemberColumnKey = "select" | "name" | "email" | "role" | "status" | "actions";

/** Name expands; other columns stay compact on the right with generous padding. */
export const MEMBER_COLUMNS: Record<MemberColumnKey, { label: string; thClass: string; tdClass: string }> = {
    select: {
        label: "",
        thClass: "w-12 px-4",
        tdClass: "w-12 px-4 align-middle",
    },
    name: {
        label: "Employee Name",
        thClass: "px-5 min-w-[180px]",
        tdClass: "px-5 py-4 align-middle min-w-0",
    },
    email: {
        label: "Email ID",
        thClass: "w-[22%] min-w-[180px] px-5 hidden md:table-cell",
        tdClass: "w-[22%] min-w-[180px] px-5 py-4 align-middle min-w-0 hidden md:table-cell",
    },
    role: {
        label: "Member Type",
        thClass: "w-[120px] px-5 whitespace-nowrap",
        tdClass: "w-[120px] px-5 py-4 align-middle whitespace-nowrap",
    },
    status: {
        label: "Status",
        thClass: "w-[110px] px-5 whitespace-nowrap hidden sm:table-cell",
        tdClass: "w-[110px] px-5 py-4 align-middle whitespace-nowrap hidden sm:table-cell",
    },
    actions: {
        label: "Actions",
        thClass: "w-[132px] px-5 text-right whitespace-nowrap",
        tdClass: "w-[132px] px-5 py-4 align-middle text-right whitespace-nowrap",
    },
};

export function getInitials(name?: string) {
    if (!name) return "??";
    return name.substring(0, 2).toUpperCase();
}

export function MemberAvatar({ userData, size = "sm" }: { userData: any; size?: "sm" | "md" }) {
    const dim = size === "md" ? "h-9 w-9" : "h-8 w-8";
    const textSize = size === "md" ? "text-xs" : "text-[11px]";
    const avatarUrl = userData?.profilePicture || userData?.image || userData?.avatar;
    return (
        <Avatar className={cn(dim, "ring-1 ring-white/10 shrink-0")}>
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={userData?.name ?? "member"} className="object-cover" /> : null}
            <AvatarFallback className={cn("bg-[#2a3040] border border-[#e5e7eb18] text-white/70 font-semibold", textSize)}>
                {getInitials(userData?.name)}
            </AvatarFallback>
        </Avatar>
    );
}

/** Square trigger for the horizontal ⋯ member menu */
export const MemberActionTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(function MemberActionTrigger({ className, disabled, children, ...props }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#2a2a32] border border-white/[0.08]",
                "text-white/70 hover:text-white hover:bg-[#323238] transition-colors disabled:opacity-30",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
});

/** Text button used on available-member rows */
export const MemberQuickAddButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
>(function MemberQuickAddButton({ className, disabled, loading, children, ...props }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            disabled={disabled || loading}
            className={cn(
                "inline-flex h-8 items-center justify-center px-3 rounded-lg",
                "bg-[#2a2a32] border border-white/[0.08] text-[12px] font-medium text-white/75",
                "hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-30",
                className
            )}
            {...props}
        >
            {children ?? "Quick Add"}
        </button>
    );
});

export function MembersTable({
    columns,
    children,
    className,
    minWidth = 640,
    scrollRef,
}: {
    columns: MemberColumnKey[];
    children: React.ReactNode;
    className?: string;
    minWidth?: number;
    /** Scroll container for sticky header + infinite-scroll IntersectionObserver root */
    scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
    return (
        <div
            ref={scrollRef}
            className={cn(
                "overflow-x-auto overflow-y-auto overscroll-contain flex-1 min-h-0 rounded-lg border border-[#2d2d2d] bg-[#121212]",
                className
            )}
        >
            <table
                className="w-full caption-bottom text-sm border-collapse table-fixed"
                style={{ minWidth }}
            >
                <thead>
                    <tr className="border-b border-[#2d2d2d]">
                        {columns.map((key) => {
                            const col = MEMBER_COLUMNS[key];
                            return (
                                <th
                                    key={key}
                                    className={cn(
                                        "sticky top-0 z-10 bg-[#222222] text-[12px] font-medium text-[#888888] tracking-normal h-11 py-0 text-left",
                                        col.thClass
                                    )}
                                >
                                    {col.label}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="bg-[#121212]">{children}</tbody>
            </table>
        </div>
    );
}

export function MemberTableRow({
    children,
    className,
    onClick,
}: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}) {
    return (
        <tr
            className={cn(
                "group border-b border-[#2d2d2d] bg-[#121212] transition-colors hover:bg-[#1a1a1a]",
                onClick && "cursor-pointer",
                className
            )}
            onClick={onClick}
        >
            {children}
        </tr>
    );
}

export function MemberNameCell({
    userData,
    badge,
}: {
    userData: any;
    badge?: React.ReactNode;
}) {
    return (
        <td className={MEMBER_COLUMNS.name.tdClass}>
            <div className="flex items-center gap-3 min-w-0">
                <MemberAvatar userData={userData} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[13px] font-medium text-white/85 capitalize truncate">
                            {userData?.name || "—"}
                        </span>
                        {badge}
                    </div>
                    <span className="text-[11px] text-white/35 truncate block md:hidden mt-0.5">
                        {userData?.email || ""}
                    </span>
                </div>
            </div>
        </td>
    );
}

export function MemberEmailCell({ email }: { email?: string }) {
    return (
        <td className={MEMBER_COLUMNS.email.tdClass}>
            <span className="text-[13px] text-white/70 truncate block">{email || "—"}</span>
        </td>
    );
}

export function MemberRoleCell({
    role,
    roleClassName: _roleClassName,
}: {
    role?: string;
    roleClassName?: string;
}) {
    const label = role ? role.charAt(0).toUpperCase() + role.slice(1) : "—";
    return (
        <td className={MEMBER_COLUMNS.role.tdClass}>
            <span className="text-[13px] capitalize text-white/75">{label}</span>
        </td>
    );
}

export function MemberStatusCell({ status }: { status?: string }) {
    const isActive = (status || "").toLowerCase() === "active";
    return (
        <td className={MEMBER_COLUMNS.status.tdClass}>
            <span
                className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
                    isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-white/90 text-neutral-800"
                )}
            >
                {status || "—"}
            </span>
        </td>
    );
}

export function MemberActionsCell({ children }: { children: React.ReactNode }) {
    return <td className={MEMBER_COLUMNS.actions.tdClass}>{children}</td>;
}

export function MemberSelectCell({ children }: { children: React.ReactNode }) {
    return <td className={MEMBER_COLUMNS.select.tdClass}>{children}</td>;
}

export function OwnerBadge() {
    return (
        <Badge className="bg-white/8 text-white/80 hover:bg-white/8 border-none text-[10px] px-1.5 h-[17px] shrink-0">
            Owner
        </Badge>
    );
}

export function MemberTableSkeletonRows({ cols, count = 6 }: { cols: number; count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-[#2d2d2d] bg-[#121212]">
                    {Array.from({ length: cols }).map((__, j) => (
                        <td key={j} className="px-5 py-4">
                            <div className="h-3 bg-white/5 rounded-full w-full max-w-[120px]" />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}
