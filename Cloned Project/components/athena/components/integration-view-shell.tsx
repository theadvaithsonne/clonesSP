"use client";

import React from "react";
import {
    Loader2,
    Plus,
    Trash2,
    PanelLeftClose,
    PanelLeft,
    Search,
    X,
    MoreHorizontal,
    Pencil,
    Link2,
    ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface IntegrationItem {
    _id: string;
    name: string;
    link: string;
    type: string;
    roomId: string;
}

export interface IntegrationShellConfig {
    brandLetter: string;
    brandTitle: string;
    brandSubtitle: string;
    drawerLabel: string;
    searchPlaceholder?: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyIcon: React.ReactNode;
    emptyCta: string;
    formNewTitle: string;
    formEditTitle: string;
    formDescription: string;
    nameLabel: string;
    namePlaceholder: string;
    linkLabel: string;
    linkPlaceholder: string;
    saveLabel: string;
    updateLabel: string;
    loadingListLabel: string;
    loadingMoreLabel: string;
    noSearchResultsLabel?: string;
    connectedCountLabel: (n: number) => string;
    selectItemLabel: string;
    chooseSidebarLabel: string;
    roomNotFoundTitle: string;
    roomNotFoundDescription: string;
}

interface IntegrationViewShellProps {
    config: IntegrationShellConfig;
    resolvedRoomId: string;
    integrations: IntegrationItem[];
    filteredIntegrations: IntegrationItem[];
    activeIntegration: IntegrationItem | null;
    activeIntegrationId: string | null;
    onSelectIntegration: (id: string) => void;
    isLoading: boolean;
    isSaving: boolean;
    isFormOpen: boolean;
    formName: string;
    formLink: string;
    formError: string | null;
    editingIntegration: IntegrationItem | null;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    sidebarSearch: string;
    setSidebarSearch: (value: string) => void;
    loadError: string | null;
    hasMore: boolean;
    sentinelRef: React.RefObject<HTMLDivElement | null>;
    onOpenForm: (integration?: IntegrationItem) => void;
    onCloseForm: () => void;
    onSave: () => void;
    onDelete: (id: string, event?: React.MouseEvent) => void;
    setFormName: (value: string) => void;
    setFormLink: (value: string) => void;
    headerExtra?: React.ReactNode;
    children: React.ReactNode;
}

function SidebarList({
    config,
    integrations,
    filteredIntegrations,
    activeIntegrationId,
    onSelectIntegration,
    isLoading,
    loadError,
    hasMore,
    sentinelRef,
    onOpenForm,
    onDelete,
    setSidebarOpen,
}: Pick<
    IntegrationViewShellProps,
    | "config"
    | "integrations"
    | "filteredIntegrations"
    | "activeIntegrationId"
    | "onSelectIntegration"
    | "isLoading"
    | "loadError"
    | "hasMore"
    | "sentinelRef"
    | "onOpenForm"
    | "onDelete"
    | "setSidebarOpen"
>) {
    const isEmpty = !isLoading && integrations.length === 0;

    return (
        <>
            {isLoading && integrations.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-white/50 text-[12px]">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {config.loadingListLabel}
                </div>
            ) : null}

            {loadError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
                    {loadError}
                </div>
            ) : null}

            {filteredIntegrations.map((integration) => {
                const isActive = activeIntegrationId === integration._id;
                return (
                    <div
                        key={integration._id}
                        onClick={() => {
                            onSelectIntegration(integration._id);
                            setSidebarOpen(false);
                        }}
                        className={cn(
                            "group w-full flex items-center gap-3 rounded-lg px-3 py-2 mb-1.5 cursor-pointer transition-all duration-150",
                            isActive
                                ? "bg-brand/10 text-white"
                                : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
                        )}
                    >
                        <span
                            className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                                isActive ? "bg-brand" : "bg-white/15 group-hover:bg-white/30",
                            )}
                        />
                        <span className="min-w-0 flex-1 text-xs font-medium truncate">{integration.name}</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(
                                        "shrink-0 flex h-7 w-7 items-center justify-center rounded-md transition-all",
                                        "text-white/30 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100",
                                        "hover:text-brand data-[state=open]:text-brand",
                                        isActive && "opacity-70",
                                    )}
                                    title="Actions"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                sideOffset={6}
                                className="w-44 bg-[#14141a] border-white/[0.08] text-white p-1 rounded-xl shadow-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenForm(integration);
                                    }}
                                    className="flex items-center gap-2.5 px-3 py-2 text-[12px] cursor-pointer rounded-lg focus:bg-brand/10 focus:text-brand"
                                >
                                    <Pencil className="h-3.5 w-3.5 text-brand" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void navigator.clipboard.writeText(integration.link);
                                    }}
                                    className="flex items-center gap-2.5 px-3 py-2 text-[12px] cursor-pointer rounded-lg focus:bg-white/5"
                                >
                                    <Link2 className="h-3.5 w-3.5 text-white/45" />
                                    Copy link
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void onDelete(integration._id, e);
                                    }}
                                    className="flex items-center gap-2.5 px-3 py-2 text-[12px] cursor-pointer rounded-lg text-red-400 focus:bg-red-500/10"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remove
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            })}

            {integrations.length > 0 && filteredIntegrations.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-white/35">
                    {config.noSearchResultsLabel ?? "No results"}
                </div>
            ) : null}

            {hasMore ? (
                <div ref={sentinelRef} className="h-10 flex items-center justify-center text-[12px] text-white/40">
                    {config.loadingMoreLabel}
                </div>
            ) : null}

            {isEmpty ? (
                <div className="mx-1 mt-4 px-4 py-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-brand/30 bg-brand/5">
                        {config.emptyIcon}
                    </div>
                    <p className="text-[12px] font-medium text-white/70">{config.emptyTitle}</p>
                    <p className="text-[11px] text-white/30 mt-1 mb-5">{config.emptyDescription}</p>
                    <button
                        type="button"
                        onClick={() => onOpenForm()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[11px] font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-colors touch-manipulation"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {config.emptyCta}
                    </button>
                </div>
            ) : null}
        </>
    );
}

export function IntegrationViewShell({
    config,
    resolvedRoomId,
    integrations,
    filteredIntegrations,
    activeIntegration,
    activeIntegrationId,
    onSelectIntegration,
    isLoading,
    isSaving,
    isFormOpen,
    formName,
    formLink,
    formError,
    editingIntegration,
    sidebarOpen,
    setSidebarOpen,
    sidebarSearch,
    setSidebarSearch,
    loadError,
    hasMore,
    sentinelRef,
    onOpenForm,
    onCloseForm,
    onSave,
    onDelete,
    setFormName,
    setFormLink,
    headerExtra,
    children,
}: IntegrationViewShellProps) {
    const sidebarHeader = (
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground font-bold text-sm">
                        {config.brandLetter}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-white truncate">{config.brandTitle}</p>
                        <p className="text-[10px] text-white/35 uppercase tracking-widest">{config.brandSubtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => onOpenForm()}
                        className="p-2 rounded-lg text-brand hover:bg-brand/10 transition-colors touch-manipulation"
                        title="Add"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors touch-manipulation"
                        title="Close"
                    >
                        <PanelLeftClose className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {integrations.length > 0 ? (
                <div className="relative mt-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25 pointer-events-none" />
                    <input
                        value={sidebarSearch}
                        onChange={(e) => setSidebarSearch(e.target.value)}
                        placeholder={config.searchPlaceholder ?? "Search..."}
                        className="w-full h-7 rounded-md border border-white/[0.07] bg-white/[0.03] py-0 pl-7 pr-2.5 text-[11px] leading-none text-white/75 placeholder:text-white/25 outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/15"
                    />
                </div>
            ) : null}
        </div>
    );

    const listProps = {
        config,
        integrations,
        filteredIntegrations,
        activeIntegrationId,
        onSelectIntegration,
        isLoading,
        loadError,
        hasMore,
        sentinelRef,
        onOpenForm,
        onDelete,
        setSidebarOpen,
    };

    return (
        <div className="flex h-full w-full bg-[#0b0b0f] overflow-hidden relative">
            {/* Desktop sidebar */}
            <aside
                className={cn(
                    "hidden md:flex flex-col border-r border-white/[0.06] bg-[#0b0b0f] transition-all duration-300 overflow-hidden shrink-0",
                    sidebarOpen ? "w-[260px]" : "w-0 border-none",
                )}
            >
                {sidebarHeader}
                <div className="flex-1 overflow-y-auto px-2 py-3">
                    <SidebarList {...listProps} />
                </div>
                {integrations.length > 0 ? (
                    <div className="px-4 py-3 border-t border-white/[0.06] text-[10px] text-white/25 uppercase tracking-wider shrink-0">
                        {config.connectedCountLabel(integrations.length)}
                    </div>
                ) : null}
            </aside>

            {/* Mobile drawer backdrop */}
            {sidebarOpen ? (
                <div
                    className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden
                />
            ) : null}

            {/* Mobile bottom drawer */}
            <div
                className={cn(
                    "md:hidden fixed bottom-0 left-0 right-0 z-40 flex flex-col bg-[#0b0b0f] border-t border-white/[0.08] rounded-t-2xl transition-transform duration-300 ease-out",
                    sidebarOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
                )}
                style={{ maxHeight: "75vh" }}
            >
                <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>
                {sidebarHeader}
                <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
                    <SidebarList {...listProps} />
                </div>
            </div>

            {/* Main */}
            <main className="flex-1 flex flex-col min-w-0 relative">
                {isFormOpen ? (
                    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6">
                        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/[0.08] bg-[#14141a] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-brand/5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground font-bold text-xs">
                                        {config.brandLetter}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-[14px] font-semibold text-white truncate">
                                            {editingIntegration ? config.formEditTitle : config.formNewTitle}
                                        </h2>
                                        <p className="text-[11px] text-white/40 truncate">{config.formDescription}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onCloseForm}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 touch-manipulation shrink-0"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2 block">
                                        {config.nameLabel}
                                    </label>
                                    <input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder={config.namePlaceholder}
                                        className="w-full rounded-lg border border-white/[0.08] bg-[#0b0b0f] px-3.5 py-2.5 text-[16px] sm:text-[13px] text-white placeholder:text-white/20 outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2 block">
                                        {config.linkLabel}
                                    </label>
                                    <input
                                        value={formLink}
                                        onChange={(e) => setFormLink(e.target.value)}
                                        placeholder={config.linkPlaceholder}
                                        className="w-full rounded-lg border border-white/[0.08] bg-[#0b0b0f] px-3.5 py-2.5 text-[16px] sm:text-[13px] text-white placeholder:text-white/20 outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                                    />
                                    {formError ? <p className="text-[12px] text-red-400 mt-2">{formError}</p> : null}
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={onCloseForm}
                                        className="rounded-lg px-4 py-2.5 text-[13px] text-white/50 hover:text-white/80 touch-manipulation"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onSave}
                                        disabled={isSaving || !formName.trim() || !formLink.trim()}
                                        className="rounded-lg bg-brand px-5 py-2.5 text-[13px] font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-40 touch-manipulation"
                                    >
                                        {isSaving ? "Saving..." : editingIntegration ? config.updateLabel : config.saveLabel}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                <header className="flex items-center justify-between gap-2 px-3 sm:px-5 h-[48px] sm:h-[52px] shrink-0 border-b border-white/[0.06] bg-[#0b0b0f]">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className={cn(
                                "p-2 rounded-lg text-white/35 hover:text-brand hover:bg-brand/10 transition-colors touch-manipulation shrink-0",
                                sidebarOpen && "md:hidden",
                            )}
                            title="Show list"
                        >
                            <PanelLeft className="h-4 w-4 md:hidden" />
                            {!sidebarOpen ? <PanelLeft className="h-4 w-4 hidden md:block" /> : null}
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-[13px] sm:text-[14px] font-semibold text-white truncate leading-tight">
                                {activeIntegration?.name ?? config.selectItemLabel}
                            </h1>
                            {activeIntegration ? (
                                <p className="text-[10px] sm:text-[11px] text-white/35 flex items-center gap-1.5 mt-0.5">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                                    Synced
                                </p>
                            ) : (
                                <p className="text-[10px] sm:text-[11px] text-white/30 mt-0.5 truncate">
                                    {config.chooseSidebarLabel}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {headerExtra}
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[10px] font-medium text-white/55 touch-manipulation"
                        >
                            <ChevronUp className="h-3.5 w-3.5 text-brand" />
                            {config.drawerLabel}
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenForm()}
                            className="md:hidden p-2 rounded-lg text-brand hover:bg-brand/10 touch-manipulation"
                            title="Add"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
            </main>
        </div>
    );
}

export function IntegrationRoomNotFound({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="flex h-full items-center justify-center p-6 bg-[#0b0b0f] text-white/70">
            <div className="max-w-md text-center px-4">
                <div className="inline-flex p-4 bg-brand/10 rounded-2xl mb-6 border border-brand/20">
                    {icon}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">{title}</h2>
                <p className="text-white/45 text-[13px]">{description}</p>
            </div>
        </div>
    );
}

export function useIntegrationSidebar(defaultOpen = false) {
    const [sidebarOpen, setSidebarOpen] = React.useState(defaultOpen);

    React.useEffect(() => {
        const mq = window.matchMedia("(min-width: 768px)");
        const sync = () => setSidebarOpen(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    return [sidebarOpen, setSidebarOpen] as const;
}
