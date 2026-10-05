"use client";

import React from "react";
import { LayoutGrid, LayoutList, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "./members-table";

export type MemberViewMode = "table" | "card";

export type PeopleScopeTabItem = {
    id: string;
    label: string;
    name: string;
    count: number;
    disabled?: boolean;
};

export function PeopleScopeTabs({
    tabs,
    activeId,
    onChange,
    className,
}: {
    tabs: PeopleScopeTabItem[];
    activeId: string;
    onChange: (id: string) => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex mb-4 shrink-0 rounded-full border border-[#2d2d2d] bg-[#121212] overflow-hidden",
                className
            )}
        >
            {tabs.map((tab, index) => {
                const isActive = activeId === tab.id;
                return (
                    <React.Fragment key={tab.id}>
                        {index > 0 && <div className="w-px shrink-0 self-stretch bg-[#2d2d2d]" />}
                        <button
                            type="button"
                            disabled={tab.disabled}
                            onClick={() => {
                                if (!tab.disabled) onChange(tab.id);
                            }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 min-w-0 px-3.5 py-2 transition-colors outline-none",
                                isActive
                                    ? "bg-brand text-brand-foreground"
                                    : "bg-transparent text-white/85 hover:bg-white/[0.03]",
                                tab.disabled && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <span className="min-w-0 flex items-center gap-1 text-[12px] leading-tight">
                                <span className="font-semibold shrink-0">{tab.label}</span>
                                <span className={cn("shrink-0", isActive ? "text-black/60" : "text-white/35")}>•</span>
                                <span
                                    className={cn(
                                        "font-normal truncate",
                                        isActive ? "text-black/80" : "text-white/65"
                                    )}
                                    title={tab.name}
                                >
                                    {tab.name}
                                </span>
                            </span>
                            <span
                                className={cn(
                                    "shrink-0 inline-flex items-center justify-center rounded-full min-w-[24px] h-[22px] px-1.5 text-[11px] font-bold leading-none",
                                    isActive ? "bg-[#2a2a32] text-white" : "bg-brand text-brand-foreground"
                                )}
                            >
                                {tab.count}
                            </span>
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

export type PeopleSubTabItem = {
    id: string;
    label: string;
};

export function PeopleSubTabs({
    tabs,
    activeId,
    onChange,
    className,
}: {
    tabs: PeopleSubTabItem[];
    activeId: string;
    onChange: (id: string) => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "inline-flex items-center p-1 rounded-full border border-[#2d2d2d] bg-[#121212] shrink-0",
                className
            )}
        >
            {tabs.map((tab) => {
                const isActive = activeId === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-[13px] transition-colors whitespace-nowrap",
                            isActive
                                ? "bg-brand text-brand-foreground font-semibold"
                                : "text-white/40 hover:text-white/60 font-medium"
                        )}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

export function MembersViewToggle({
    viewMode,
    onViewModeChange,
    className,
}: {
    viewMode: MemberViewMode;
    onViewModeChange: (mode: MemberViewMode) => void;
    className?: string;
}) {
    return (
        <div className={cn("flex items-center rounded-lg cursor-pointer p-0.5 shrink-0", className)}>
            <button
                type="button"
                onClick={() => onViewModeChange("table")}
                className={cn(
                    "p-1.5 rounded-md transition-colors",
                    viewMode === "table" ? "bg-[#2a2a30] text-white" : "text-white/35 hover:text-white/60"
                )}
                title="Table view"
            >
                <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => onViewModeChange("card")}
                className={cn(
                    "p-1.5 rounded-md transition-colors cursor-pointer",
                    viewMode === "card" ? "bg-[#2a2a30] text-white" : "text-white/35 hover:text-white/60"
                )}
                title="Card view"
            >
                <LayoutGrid className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

export function MembersSearchToolbar({
    value,
    onChange,
    viewMode,
    onViewModeChange,
    placeholder = "Search…",
    className,
    trailing,
    align = "split",
}: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    viewMode: MemberViewMode;
    onViewModeChange: (mode: MemberViewMode) => void;
    placeholder?: string;
    className?: string;
    trailing?: React.ReactNode;
    /** split: search left, controls right (default). end: search + controls grouped on the right. */
    align?: "split" | "end";
}) {
    const controls = (
        <>
            {trailing}
            <MembersViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </>
    );

    const searchInput = (
        <div className="relative w-40 sm:w-48 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
            <input
                type="text"
                placeholder={placeholder}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-white/[0.08] bg-transparent placeholder:text-[13px] text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/15 transition-colors"
                value={value}
                onChange={onChange}
            />
        </div>
    );

    if (align === "end") {
        return (
            <div className={cn("flex items-center gap-2 shrink-0", className)}>
                {searchInput}
                {controls}
            </div>
        );
    }

    return (
        <div className={cn("flex items-center justify-between gap-3", className)}>
            {searchInput}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
                {controls}
            </div>
        </div>
    );
}

export function MembersCardGrid({
    children,
    className,
    sentinel,
    footer,
}: {
    children: React.ReactNode;
    className?: string;
    sentinel?: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <div className={cn("flex-1 min-h-0 flex flex-col overflow-hidden", className)}>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5">
                <div
                    className={cn(
                        "grid gap-2 pb-2",
                        "grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))]",
                        "sm:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]",
                        "md:grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))]",
                        "lg:grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))]",
                        "xl:grid-cols-[repeat(auto-fill,minmax(7.75rem,1fr))]",
                    )}
                >
                    {children}
                </div>
                {sentinel}
            </div>
            {footer}
        </div>
    );
}

export function MemberCard({
    userData,
    role,
    roleClassName,
    status,
    isSelected,
    onClick,
    actions,
    badge,
}: {
    userData: any;
    role?: string;
    roleClassName?: string;
    status?: string;
    isSelected?: boolean;
    onClick?: () => void;
    actions?: React.ReactNode;
    badge?: React.ReactNode;
}) {
    const avatarUrl = userData?.profilePicture || userData?.image || userData?.avatar;
    const isActive = status === "active";
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : undefined;

    return (
        <div
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
            className={cn(
                "flex flex-col w-full rounded-lg overflow-hidden border transition-all",
                isSelected
                    ? "border-brand/50 ring-1 ring-brand/30"
                    : "border-white/[0.06] hover:border-white/[0.12]",
                onClick && "cursor-pointer"
            )}
        >
            <div className="relative w-full aspect-square bg-[#d9d9d9] flex items-center justify-center overflow-hidden shrink-0">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={userData?.name ?? "member"} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-base sm:text-lg font-bold text-black/55 leading-none select-none">
                        {getInitials(userData?.name)}
                    </span>
                )}
                {actions && (
                    <div
                        className="absolute top-1 right-1 scale-90 origin-top-right"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {actions}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1 bg-[#0a0a0d] h-8 shrink-0">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-0.5 min-w-0">
                        <span className="text-[10px] sm:text-[11px] font-medium text-white/80 truncate capitalize leading-tight">
                            {userData?.name || "—"}
                        </span>
                        {badge}
                    </div>
                    {roleLabel && (
                        <span className={cn("text-[9px] sm:text-[10px] capitalize truncate block leading-tight", roleClassName || "text-white/35")}>
                            {roleLabel}
                        </span>
                    )}
                </div>
                {status !== undefined ? (
                    <span
                        className={cn(
                            "h-2 w-2 rounded-full border shrink-0",
                            isActive ? "bg-emerald-400/80 border-emerald-400/40" : "bg-transparent border-white/40"
                        )}
                        title={status || "offline"}
                    />
                ) : isSelected !== undefined ? (
                    <span
                        className={cn(
                            "h-2 w-2 rounded-full border shrink-0",
                            isSelected ? "bg-brand border-brand" : "bg-transparent border-white/40"
                        )}
                    />
                ) : null}
            </div>
        </div>
    );
}

export function MemberCardSkeletonGrid({ count = 8 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex flex-col w-full rounded-lg overflow-hidden border border-white/[0.06] animate-pulse">
                    <div className="w-full aspect-square bg-white/5" />
                    <div className="h-8 bg-[#0a0a0d] px-1.5 flex items-center">
                        <div className="h-2 bg-white/5 rounded-full w-2/3" />
                    </div>
                </div>
            ))}
        </>
    );
}
