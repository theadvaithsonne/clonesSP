"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, ExternalLink } from "lucide-react";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import {
    IntegrationViewShell,
    IntegrationRoomNotFound,
} from "./integration-view-shell";
import {
    IntegrationEmptyState,
    IntegrationInvalidState,
    IntegrationIframe,
} from "./integration-iframe-content";
import { useIntegrationList } from "./use-integration-list";

const SHEETS_CONFIG = {
    brandLetter: "S",
    brandTitle: "Spreadsheets",
    brandSubtitle: "Google Sheets",
    drawerLabel: "Sheets",
    searchPlaceholder: "Search...",
    emptyTitle: "No sheets",
    emptyDescription: "Link a Google Sheet to get started",
    emptyIcon: <FileSpreadsheet className="h-5 w-5 text-brand/70" />,
    emptyCta: "Add sheet",
    formNewTitle: "New sheet",
    formEditTitle: "Edit sheet",
    formDescription: "Paste your Google Sheet URL",
    nameLabel: "Title",
    namePlaceholder: "e.g. Budget 2024",
    linkLabel: "Sheet URL",
    linkPlaceholder: "https://docs.google.com/spreadsheets/d/...",
    saveLabel: "Connect",
    updateLabel: "Save changes",
    loadingListLabel: "Loading sheets...",
    loadingMoreLabel: "Loading more...",
    noSearchResultsLabel: "No sheets match your search",
    connectedCountLabel: (n: number) => `${n} connected`,
    selectItemLabel: "Select a sheet",
    chooseSidebarLabel: "Choose from the list",
    roomNotFoundTitle: "Room not found",
    roomNotFoundDescription: "Unable to load Google Sheets — taskroom room ID is missing.",
};

function buildIframeUrl(url: string) {
    if (!url) return "";
    if (url.includes("pubhtml")) return url;
    return url.split("?")[0].replace(/\/edit.*$/, "") + "/edit";
}

function isValidSheetUrl(url: string) {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes("docs.google.com") && parsed.pathname.includes("/spreadsheets/")) return true;
        if (url.includes("pubhtml")) return true;
        return false;
    } catch {
        return false;
    }
}

export default function SheetsView({ roomId: propRoomId }: { roomId?: string }) {
    const searchParams = useSearchParams();
    const { currentRoomDetail } = useTaskroomWorkspacetore();
    const resolvedRoomId = useMemo(() => {
        if (propRoomId) return propRoomId;
        if (searchParams?.get("shareTask")) return searchParams.get("roomId") || "";
        return currentRoomDetail?._id || "";
    }, [propRoomId, searchParams, currentRoomDetail]);

    const list = useIntegrationList(resolvedRoomId, "googlesheet");

    const handleSave = () =>
        list.saveIntegration((link) =>
            isValidSheetUrl(link) ? null : "Please provide a valid Google Sheet URL.",
        );

    if (!resolvedRoomId) {
        return (
            <IntegrationRoomNotFound
                icon={<FileSpreadsheet className="h-8 w-8 text-brand" />}
                title={SHEETS_CONFIG.roomNotFoundTitle}
                description={SHEETS_CONFIG.roomNotFoundDescription}
            />
        );
    }

    const { activeIntegration } = list;

    return (
        <IntegrationViewShell
            config={SHEETS_CONFIG}
            resolvedRoomId={resolvedRoomId}
            integrations={list.integrations}
            filteredIntegrations={list.filteredIntegrations}
            activeIntegration={list.activeIntegration}
            activeIntegrationId={list.activeIntegrationId}
            onSelectIntegration={list.setActiveIntegrationId}
            isLoading={list.isLoading}
            isSaving={list.isSaving}
            isFormOpen={list.isFormOpen}
            formName={list.formName}
            formLink={list.formLink}
            formError={list.formError}
            editingIntegration={list.editingIntegration}
            sidebarOpen={list.sidebarOpen}
            setSidebarOpen={list.setSidebarOpen}
            sidebarSearch={list.sidebarSearch}
            setSidebarSearch={list.setSidebarSearch}
            loadError={list.loadError}
            hasMore={list.hasMore}
            sentinelRef={list.sentinelRef}
            onOpenForm={list.openForm}
            onCloseForm={list.closeForm}
            onSave={handleSave}
            onDelete={list.deleteIntegration}
            setFormName={list.setFormName}
            setFormLink={list.setFormLink}
            headerExtra={
                activeIntegration ? (
                    <a
                        href={activeIntegration.link}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-1 rounded-lg border border-brand/25 bg-brand/8 px-2 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-medium text-brand hover:bg-brand/15 touch-manipulation"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Open in Sheets</span>
                    </a>
                ) : null
            }
        >
            {activeIntegration && isValidSheetUrl(activeIntegration.link) ? (
                <IntegrationIframe
                    src={buildIframeUrl(activeIntegration.link)}
                    title={activeIntegration.name}
                />
            ) : activeIntegration ? (
                <IntegrationInvalidState message="Edit this sheet from the list to fix the link." />
            ) : (
                <IntegrationEmptyState
                    isLoading={list.isLoading}
                    loadingLabel="Loading sheets..."
                    icon={<FileSpreadsheet className="h-7 w-7 text-brand" />}
                    title="Spreadsheet workspace"
                    description="Connect Google Sheets and edit them in-app."
                    cta="Connect a sheet"
                    onCta={() => {
                        list.setSidebarOpen(true);
                        list.openForm();
                    }}
                />
            )}
        </IntegrationViewShell>
    );
}
