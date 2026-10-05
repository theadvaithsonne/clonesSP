"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Figma, ExternalLink } from "lucide-react";
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

const FIGMA_CONFIG = {
    brandLetter: "F",
    brandTitle: "Designs",
    brandSubtitle: "Figma",
    drawerLabel: "Files",
    searchPlaceholder: "Search...",
    emptyTitle: "No files",
    emptyDescription: "Link a Figma file to get started",
    emptyIcon: <Figma className="h-5 w-5 text-brand/70" />,
    emptyCta: "Add file",
    formNewTitle: "New file",
    formEditTitle: "Edit file",
    formDescription: "Paste your Figma file URL",
    nameLabel: "Title",
    namePlaceholder: "e.g. Dashboard Designs",
    linkLabel: "Figma URL",
    linkPlaceholder: "https://www.figma.com/file/...",
    saveLabel: "Connect",
    updateLabel: "Save changes",
    loadingListLabel: "Loading files...",
    loadingMoreLabel: "Loading more...",
    noSearchResultsLabel: "No files match your search",
    connectedCountLabel: (n: number) => `${n} connected`,
    selectItemLabel: "Select a file",
    chooseSidebarLabel: "Choose from the list",
    roomNotFoundTitle: "Room not found",
    roomNotFoundDescription: "Unable to load Figma files — taskroom room ID is missing.",
};

function buildIframeUrl(url: string) {
    if (!url) return "";
    try {
        const parsed = new URL(url);
        if (parsed.hostname === "www.figma.com" || parsed.hostname === "figma.com") {
            if (parsed.pathname.startsWith("/embed")) return url;
            return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
        }
    } catch {
        // fall through
    }
    return url;
}

function isValidFigmaUrl(url: string) {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace(/^www\./, "");
        if (hostname !== "figma.com") return false;
        return /^\/(file|proto|board|embed|design)\//.test(parsed.pathname);
    } catch {
        return false;
    }
}

export default function FigmaView({ roomId: propRoomId }: { roomId?: string }) {
    const searchParams = useSearchParams();
    const { currentRoomDetail } = useTaskroomWorkspacetore();
    const resolvedRoomId = useMemo(() => {
        if (propRoomId) return propRoomId;
        if (searchParams?.get("shareTask")) return searchParams.get("roomId") || "";
        return currentRoomDetail?._id || "";
    }, [propRoomId, searchParams, currentRoomDetail]);

    const list = useIntegrationList(resolvedRoomId, "figma");

    const handleSave = () =>
        list.saveIntegration((link) =>
            isValidFigmaUrl(link) ? null : "Please provide a valid Figma URL (e.g. figma.com/file/...).",
        );

    if (!resolvedRoomId) {
        return (
            <IntegrationRoomNotFound
                icon={<Figma className="h-8 w-8 text-brand" />}
                title={FIGMA_CONFIG.roomNotFoundTitle}
                description={FIGMA_CONFIG.roomNotFoundDescription}
            />
        );
    }

    const { activeIntegration } = list;

    return (
        <IntegrationViewShell
            config={FIGMA_CONFIG}
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
                        <span className="hidden sm:inline">Open in Figma</span>
                    </a>
                ) : null
            }
        >
            {activeIntegration && isValidFigmaUrl(activeIntegration.link) ? (
                <IntegrationIframe
                    src={buildIframeUrl(activeIntegration.link)}
                    title={activeIntegration.name}
                    allow="autoplay; encrypted-media; clipboard-read; clipboard-write; camera; microphone"
                />
            ) : activeIntegration ? (
                <IntegrationInvalidState message="Edit this file from the list to fix the link." />
            ) : (
                <IntegrationEmptyState
                    isLoading={list.isLoading}
                    loadingLabel="Loading files..."
                    icon={<Figma className="h-7 w-7 text-brand" />}
                    title="Design workspace"
                    description="Connect Figma files and preview them in-app."
                    cta="Connect a file"
                    onCta={() => {
                        list.setSidebarOpen(true);
                        list.openForm();
                    }}
                />
            )}
        </IntegrationViewShell>
    );
}
