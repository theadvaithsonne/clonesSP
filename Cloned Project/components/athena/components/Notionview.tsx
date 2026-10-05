"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, RefreshCw, BookOpen } from "lucide-react";
import dynamic from "next/dynamic";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import axios from "axios";
import {
    IntegrationViewShell,
    IntegrationRoomNotFound,
    useIntegrationSidebar,
    type IntegrationItem,
} from "./integration-view-shell";

const TASKROOM_BASE_URL = (process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/").replace(/\/+$/, "") + "/";
const INTEGRATIONS_URL = `${TASKROOM_BASE_URL}external/integrations`;
const PAGE_SIZE = 10;

const NOTION_CONFIG = {
    brandLetter: "N",
    brandTitle: "Documents",
    brandSubtitle: "Notion",
    drawerLabel: "Pages",
    searchPlaceholder: "Search...",
    emptyTitle: "No documents",
    emptyDescription: "Link a Notion page to get started",
    emptyIcon: <BookOpen className="h-5 w-5 text-brand/70" />,
    emptyCta: "Add page",
    formNewTitle: "New document",
    formEditTitle: "Edit document",
    formDescription: "Paste your Notion page URL",
    nameLabel: "Title",
    namePlaceholder: "e.g. Product Roadmap",
    linkLabel: "Notion URL",
    linkPlaceholder: "https://www.notion.so/...",
    saveLabel: "Connect",
    updateLabel: "Save changes",
    loadingListLabel: "Loading pages...",
    loadingMoreLabel: "Loading more...",
    noSearchResultsLabel: "No pages match your search",
    connectedCountLabel: (n: number) => `${n} connected`,
    selectItemLabel: "Select a document",
    chooseSidebarLabel: "Choose from the list",
    roomNotFoundTitle: "Room not found",
    roomNotFoundDescription: "Unable to load documents — taskroom room ID is missing.",
};

const NotionPageViewer = dynamic(() => import("./NotionPageViewer"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-white text-[#0b0b0f]/45 text-[13px]">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            Loading document...
        </div>
    ),
});

function extractNotionUrlFromInput(input: string) {
    const trimmed = input.trim();
    const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch?.[1]) return iframeMatch[1].trim();
    return trimmed;
}

function isValidNotionUrl(url: string) {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace(/^www\./, "");
        if (!hostname.endsWith("notion.so") && !hostname.endsWith("notion.site") && !hostname.endsWith("notion.com")) return false;
        return parsed.pathname.length > 1;
    } catch {
        return false;
    }
}

export default function NotionView({ roomId: propRoomId }: { roomId?: string }) {
    const searchParams = useSearchParams();
    const { currentRoomDetail } = useTaskroomWorkspacetore();
    const resolvedRoomId = useMemo(() => {
        if (propRoomId) return propRoomId;
        if (searchParams?.get("shareTask")) return searchParams.get("roomId") || "";
        return currentRoomDetail?._id || "";
    }, [propRoomId, searchParams, currentRoomDetail]);

    const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
    const [activeIntegrationId, setActiveIntegrationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingIntegration, setEditingIntegration] = useState<IntegrationItem | null>(null);
    const [formName, setFormName] = useState("");
    const [formLink, setFormLink] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useIntegrationSidebar();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [refreshToken, setRefreshToken] = useState(0);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef(false);

    const activeIntegration = integrations.find((item) => item._id === activeIntegrationId) ?? integrations[0] ?? null;

    const filteredIntegrations = useMemo(() => {
        const q = sidebarSearch.trim().toLowerCase();
        if (!q) return integrations;
        return integrations.filter(
            (item) => item.name.toLowerCase().includes(q) || item.link.toLowerCase().includes(q),
        );
    }, [integrations, sidebarSearch]);

    const fetchIntegrations = useCallback(async (page: number, append = false) => {
        if (!resolvedRoomId || isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoadError(null);
        setIsLoading((prev) => prev && !append);
        try {
            const url = new URL(INTEGRATIONS_URL);
            url.searchParams.append("size", PAGE_SIZE.toString());
            url.searchParams.append("page", page.toString());
            url.searchParams.append("roomId", resolvedRoomId);
            url.searchParams.append("type", "notion");
            const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
            const response = await axios.get(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
            const json = response.data;
            const items: IntegrationItem[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : json?.data || [];
            setIntegrations((prev) => (append ? [...prev, ...items.filter((i) => !prev.some((e) => e._id === i._id))] : items));
            const metadata = json?.metadata ?? {};
            setCurrentPage(metadata.currentPage ?? page);
            setTotalPages(metadata.totalPages ?? page);
            setHasMore((metadata.currentPage ?? page) < (metadata.totalPages ?? page));
            if (!append && items.length > 0) setActiveIntegrationId(items[0]._id);
        } catch {
            setLoadError("Could not load Notion integrations. Please refresh.");
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [resolvedRoomId]);

    useEffect(() => {
        setIntegrations([]);
        setCurrentPage(1);
        setTotalPages(1);
        setHasMore(false);
        setActiveIntegrationId(null);
        if (!resolvedRoomId) { setIsLoading(false); return; }
        fetchIntegrations(1, false);
    }, [resolvedRoomId, fetchIntegrations]);

    useEffect(() => {
        if (!sentinelRef.current || !hasMore) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !isFetchingRef.current && hasMore) {
                const nextPage = currentPage + 1;
                if (nextPage <= totalPages) fetchIntegrations(nextPage, true);
            }
        }, { threshold: 0.2 });
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [currentPage, totalPages, hasMore, fetchIntegrations]);

    const openForm = (integration?: IntegrationItem) => {
        setEditingIntegration(integration ?? null);
        setFormName(integration?.name ?? "");
        setFormLink(integration?.link ?? "");
        setFormError(null);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingIntegration(null);
        setFormName("");
        setFormLink("");
        setFormError(null);
    };

    const handleSaveIntegration = async () => {
        if (!formName.trim() || !formLink.trim() || !resolvedRoomId) return;
        const normalizedLink = extractNotionUrlFromInput(formLink.trim());
        if (!isValidNotionUrl(normalizedLink)) {
            setFormError("Please provide a valid Notion URL.");
            return;
        }
        setIsSaving(true);
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
            if (editingIntegration) {
                await axios.put(`${INTEGRATIONS_URL}/${editingIntegration._id}`, { name: formName.trim(), link: normalizedLink, type: "notion" }, { headers: { Authorization: `Bearer ${token}` } });
                setIntegrations((prev) => prev.map((item) => item._id === editingIntegration._id ? { ...item, name: formName.trim(), link: normalizedLink } : item));
            } else {
                const response = await axios.post(INTEGRATIONS_URL, { name: formName.trim(), link: normalizedLink, type: "notion", roomId: resolvedRoomId }, { headers: { Authorization: `Bearer ${token}` } });
                const created = response.data?.data ?? response.data;
                if (created?._id) {
                    setIntegrations((prev) => [created, ...prev]);
                    setActiveIntegrationId(created._id);
                } else await fetchIntegrations(1, false);
            }
        } catch {
            setFormError("Unable to save. Please try again.");
        } finally {
            setIsSaving(false);
            closeForm();
        }
    };

    const handleDeleteIntegration = async (id: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
            await axios.delete(`${INTEGRATIONS_URL}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setIntegrations((prev) => prev.filter((item) => item._id !== id));
            if (activeIntegrationId === id) {
                const next = integrations.find((item) => item._id !== id);
                setActiveIntegrationId(next ? next._id : null);
            }
        } catch (error) {
            console.error("Failed to delete Notion integration", error);
        }
    };

    if (!resolvedRoomId) {
        return (
            <IntegrationRoomNotFound
                icon={<BookOpen className="h-8 w-8 text-brand" />}
                title={NOTION_CONFIG.roomNotFoundTitle}
                description={NOTION_CONFIG.roomNotFoundDescription}
            />
        );
    }

    return (
        <IntegrationViewShell
            config={NOTION_CONFIG}
            resolvedRoomId={resolvedRoomId}
            integrations={integrations}
            filteredIntegrations={filteredIntegrations}
            activeIntegration={activeIntegration}
            activeIntegrationId={activeIntegrationId}
            onSelectIntegration={setActiveIntegrationId}
            isLoading={isLoading}
            isSaving={isSaving}
            isFormOpen={isFormOpen}
            formName={formName}
            formLink={formLink}
            formError={formError}
            editingIntegration={editingIntegration}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            sidebarSearch={sidebarSearch}
            setSidebarSearch={setSidebarSearch}
            loadError={loadError}
            hasMore={hasMore}
            sentinelRef={sentinelRef}
            onOpenForm={openForm}
            onCloseForm={closeForm}
            onSave={handleSaveIntegration}
            onDelete={handleDeleteIntegration}
            setFormName={setFormName}
            setFormLink={setFormLink}
            headerExtra={
                activeIntegration ? (
                    <button
                        type="button"
                        onClick={() => setRefreshToken((n) => n + 1)}
                        className="flex items-center gap-1 rounded-lg border border-brand/25 bg-brand/8 px-2 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-medium text-brand hover:bg-brand/15 touch-manipulation"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                ) : null
            }
        >
            {activeIntegration && isValidNotionUrl(activeIntegration.link) ? (
                <NotionPageViewer
                    key={`${activeIntegration.link}-${refreshToken}`}
                    pageUrl={activeIntegration.link}
                    pageTitle={activeIntegration.name}
                    refreshToken={refreshToken}
                />
            ) : activeIntegration ? (
                <div className="flex h-full items-center justify-center bg-[#0e0e12] px-4">
                    <div className="max-w-sm text-center rounded-2xl border border-white/[0.08] bg-[#14141a] p-6 sm:p-8">
                        <p className="text-[13px] font-medium text-white">Invalid URL</p>
                        <p className="text-[12px] text-white/40 mt-2">Edit this document from the list to fix the link.</p>
                    </div>
                </div>
            ) : (
                <div className="flex h-full items-center justify-center bg-[#0e0e12] px-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-brand" />
                            <span className="text-[13px] text-white/40">Loading documents...</span>
                        </div>
                    ) : (
                        <div className="max-w-sm text-center">
                            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 border border-brand/20">
                                <BookOpen className="h-7 w-7 text-brand" />
                            </div>
                            <h2 className="text-[15px] sm:text-[16px] font-semibold text-white">Document workspace</h2>
                            <p className="text-[12px] sm:text-[13px] text-white/40 mt-2">Connect Notion pages and read them in-app.</p>
                            <button
                                type="button"
                                onClick={() => { setSidebarOpen(true); openForm(); }}
                                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13px] font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] touch-manipulation"
                            >
                                <Plus className="h-4 w-4" />
                                Connect a page
                            </button>
                        </div>
                    )}
                </div>
            )}
        </IntegrationViewShell>
    );
}
