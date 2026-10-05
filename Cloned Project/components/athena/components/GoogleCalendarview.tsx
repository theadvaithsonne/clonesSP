"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ExternalLink } from "lucide-react";
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

const GOOGLE_CALENDAR_CONFIG = {
    brandLetter: "G",
    brandTitle: "Calendars",
    brandSubtitle: "Google Calendar",
    drawerLabel: "Calendars",
    searchPlaceholder: "Search...",
    emptyTitle: "No calendars",
    emptyDescription: "Link a Google Calendar to get started",
    emptyIcon: <CalendarDays className="h-5 w-5 text-brand/70" />,
    emptyCta: "Add calendar",
    formNewTitle: "New calendar",
    formEditTitle: "Edit calendar",
    formDescription: "Paste your Google Calendar embed URL or public calendar link",
    nameLabel: "Title",
    namePlaceholder: "e.g. Team Schedule",
    linkLabel: "Calendar URL",
    linkPlaceholder: "https://calendar.google.com/calendar/embed?src=...",
    saveLabel: "Connect",
    updateLabel: "Save changes",
    loadingListLabel: "Loading calendars...",
    loadingMoreLabel: "Loading more...",
    noSearchResultsLabel: "No calendars match your search",
    connectedCountLabel: (n: number) => `${n} connected`,
    selectItemLabel: "Select a calendar",
    chooseSidebarLabel: "Choose from the list",
    roomNotFoundTitle: "Room not found",
    roomNotFoundDescription: "Unable to load Google Calendars — taskroom room ID is missing.",
};

function extractCalendarUrlFromInput(input: string) {
    const trimmed = input.trim();
    const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch?.[1]) return iframeMatch[1].trim();
    return trimmed;
}

function isGoogleCalendarHost(hostname: string) {
    const host = hostname.replace(/^www\./, "").toLowerCase();
    return host === "calendar.google.com";
}

function buildIframeUrl(url: string) {
    if (!url) return "";
    try {
        const parsed = new URL(url);
        if (!isGoogleCalendarHost(parsed.hostname)) return url;

        if (parsed.pathname.includes("/embed")) {
            return parsed.toString();
        }

        const cid = parsed.searchParams.get("cid");
        if (cid) {
            const embed = new URL("https://calendar.google.com/calendar/embed");
            embed.searchParams.set("src", cid);
            return embed.toString();
        }

        const src = parsed.searchParams.get("src");
        if (src) {
            const embed = new URL("https://calendar.google.com/calendar/embed");
            embed.searchParams.set("src", src);
            for (const key of ["ctz", "mode", "showTitle", "showNav", "showDate", "showPrint", "showTabs", "showCalendars"]) {
                const value = parsed.searchParams.get(key);
                if (value) embed.searchParams.set(key, value);
            }
            return embed.toString();
        }

        const pathMatch = parsed.pathname.match(/\/calendar\/(?:u\/\d+\/)?r\/([^/?#]+)/);
        if (pathMatch?.[1]) {
            const embed = new URL("https://calendar.google.com/calendar/embed");
            embed.searchParams.set("src", decodeURIComponent(pathMatch[1]));
            return embed.toString();
        }
    } catch {
        // fall through
    }
    return url;
}

function isValidGoogleCalendarUrl(url: string) {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url);
        if (!isGoogleCalendarHost(parsed.hostname)) return false;
        if (parsed.pathname.includes("/embed")) return !!parsed.searchParams.get("src");
        if (parsed.searchParams.get("cid") || parsed.searchParams.get("src")) return true;
        return /\/calendar\/(?:u\/\d+\/)?r\//.test(parsed.pathname);
    } catch {
        return false;
    }
}

export default function GoogleCalendarview({ roomId: propRoomId }: { roomId?: string }) {
    const searchParams = useSearchParams();
    const { currentRoomDetail } = useTaskroomWorkspacetore();
    const resolvedRoomId = useMemo(() => {
        if (propRoomId) return propRoomId;
        if (searchParams?.get("shareTask")) return searchParams.get("roomId") || "";
        return currentRoomDetail?._id || "";
    }, [propRoomId, searchParams, currentRoomDetail]);

    const list = useIntegrationList(resolvedRoomId, "google-calendar");

    const handleSave = () =>
        list.saveIntegration(
            (link) =>
                isValidGoogleCalendarUrl(link)
                    ? null
                    : "Please provide a valid Google Calendar URL or embed link.",
            extractCalendarUrlFromInput,
        );

    if (!resolvedRoomId) {
        return (
            <IntegrationRoomNotFound
                icon={<CalendarDays className="h-8 w-8 text-brand" />}
                title={GOOGLE_CALENDAR_CONFIG.roomNotFoundTitle}
                description={GOOGLE_CALENDAR_CONFIG.roomNotFoundDescription}
            />
        );
    }

    const { activeIntegration } = list;

    return (
        <IntegrationViewShell
            config={GOOGLE_CALENDAR_CONFIG}
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
                        <span className="hidden sm:inline">Open in Google</span>
                    </a>
                ) : null
            }
        >
            {activeIntegration && isValidGoogleCalendarUrl(activeIntegration.link) ? (
                <IntegrationIframe
                    src={buildIframeUrl(activeIntegration.link)}
                    title={activeIntegration.name}
                    allow="clipboard-read; clipboard-write"
                />
            ) : activeIntegration ? (
                <IntegrationInvalidState message="Edit this calendar from the list to fix the link." />
            ) : (
                <IntegrationEmptyState
                    isLoading={list.isLoading}
                    loadingLabel="Loading calendars..."
                    icon={<CalendarDays className="h-7 w-7 text-brand" />}
                    title="Calendar workspace"
                    description="Connect Google Calendars and view them in-app."
                    cta="Connect a calendar"
                    onCta={() => {
                        list.setSidebarOpen(true);
                        list.openForm();
                    }}
                />
            )}
        </IntegrationViewShell>
    );
}
