"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Video, ExternalLink } from "lucide-react";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import {
    IntegrationViewShell,
    IntegrationRoomNotFound,
} from "./integration-view-shell";
import {
    IntegrationEmptyState,
    IntegrationInvalidState,
    IntegrationYoutubeIframe,
} from "./integration-iframe-content";
import { useIntegrationList } from "./use-integration-list";

const YOUTUBE_CONFIG = {
    brandLetter: "Y",
    brandTitle: "Videos",
    brandSubtitle: "YouTube",
    drawerLabel: "Videos",
    searchPlaceholder: "Search...",
    emptyTitle: "No videos",
    emptyDescription: "Link a YouTube video to get started",
    emptyIcon: <Video className="h-5 w-5 text-brand/70" />,
    emptyCta: "Add video",
    formNewTitle: "New video",
    formEditTitle: "Edit video",
    formDescription: "Paste your YouTube video URL",
    nameLabel: "Title",
    namePlaceholder: "e.g. Launch Demo",
    linkLabel: "YouTube URL",
    linkPlaceholder: "https://youtube.com/watch?v=...",
    saveLabel: "Connect",
    updateLabel: "Save changes",
    loadingListLabel: "Loading videos...",
    loadingMoreLabel: "Loading more...",
    noSearchResultsLabel: "No videos match your search",
    connectedCountLabel: (n: number) => `${n} connected`,
    selectItemLabel: "Select a video",
    chooseSidebarLabel: "Choose from the list",
    roomNotFoundTitle: "Room not found",
    roomNotFoundDescription: "Unable to load YouTube videos — taskroom room ID is missing.",
};

function buildIframeUrl(url: string) {
    if (!url) return "";
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace(/^(www\.|m\.|music\.)/, "").toLowerCase();
        let videoId = "";
        if (hostname === "youtu.be") {
            videoId = parsed.pathname.slice(1);
        } else if (hostname === "youtube.com" || hostname === "youtube-nocookie.com") {
            if (parsed.pathname.startsWith("/watch")) {
                videoId = parsed.searchParams.get("v") || "";
            } else if (parsed.pathname.startsWith("/embed/")) {
                videoId = parsed.pathname.split("/embed/")[1] || "";
            } else if (parsed.pathname.startsWith("/shorts/")) {
                videoId = parsed.pathname.split("/shorts/")[1] || "";
            }
        }
        if (videoId) {
            return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;
        }
    } catch {
        // fall through
    }
    return url;
}

function isValidYoutubeUrl(url: string) {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace(/^(www\.|m\.|music\.)/, "").toLowerCase();
        if (!["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(hostname)) return false;
        if (hostname === "youtu.be") return parsed.pathname.length > 1;
        if (parsed.pathname.startsWith("/watch")) return !!parsed.searchParams.get("v");
        return parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/");
    } catch {
        return false;
    }
}

export default function Youtubeview({ roomId: propRoomId }: { roomId?: string }) {
    const searchParams = useSearchParams();
    const { currentRoomDetail } = useTaskroomWorkspacetore();
    const resolvedRoomId = useMemo(() => {
        if (propRoomId) return propRoomId;
        if (searchParams?.get("shareTask")) return searchParams.get("roomId") || "";
        return currentRoomDetail?._id || "";
    }, [propRoomId, searchParams, currentRoomDetail]);

    const list = useIntegrationList(resolvedRoomId, "youtube");

    const handleSave = () =>
        list.saveIntegration((link) =>
            isValidYoutubeUrl(link) ? null : "Please provide a valid YouTube video URL.",
        );

    if (!resolvedRoomId) {
        return (
            <IntegrationRoomNotFound
                icon={<Video className="h-8 w-8 text-brand" />}
                title={YOUTUBE_CONFIG.roomNotFoundTitle}
                description={YOUTUBE_CONFIG.roomNotFoundDescription}
            />
        );
    }

    const { activeIntegration } = list;

    return (
        <IntegrationViewShell
            config={YOUTUBE_CONFIG}
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
                        <span className="hidden sm:inline">Open on YouTube</span>
                    </a>
                ) : null
            }
        >
            {activeIntegration && isValidYoutubeUrl(activeIntegration.link) ? (
                <IntegrationYoutubeIframe
                    src={buildIframeUrl(activeIntegration.link)}
                    title={activeIntegration.name}
                />
            ) : activeIntegration ? (
                <IntegrationInvalidState message="Edit this video from the list to fix the link." />
            ) : (
                <IntegrationEmptyState
                    isLoading={list.isLoading}
                    loadingLabel="Loading videos..."
                    icon={<Video className="h-7 w-7 text-brand" />}
                    title="Video workspace"
                    description="Connect YouTube videos and watch them in-app."
                    cta="Connect a video"
                    onCta={() => {
                        list.setSidebarOpen(true);
                        list.openForm();
                    }}
                />
            )}
        </IntegrationViewShell>
    );
}
