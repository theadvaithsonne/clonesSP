"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import type { IntegrationItem } from "./integration-view-shell";
import { useIntegrationSidebar } from "./integration-view-shell";

const TASKROOM_BASE_URL = (process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/").replace(/\/+$/, "") + "/";
const INTEGRATIONS_URL = `${TASKROOM_BASE_URL}external/integrations`;
const PAGE_SIZE = 10;

export function useIntegrationList(resolvedRoomId: string, integrationType: string) {
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
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

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
            url.searchParams.append("type", integrationType);
            const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
            const response = await axios.get(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
            const json = response.data;
            const items: IntegrationItem[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : json?.data || [];
            setIntegrations((prev) => (append ? [...prev, ...items.filter((i) => !prev.some((e) => e._id === i._id))] : items));
            const metadata = json?.metadata ?? {};
            const cp = metadata.currentPage ?? page;
            const tp = metadata.totalPages ?? cp;
            setCurrentPage(cp);
            setTotalPages(tp);
            setHasMore(cp < tp);
            if (!append && items.length > 0) setActiveIntegrationId(items[0]._id);
        } catch {
            setLoadError(`Could not load integrations. Please refresh.`);
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [resolvedRoomId, integrationType]);

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

    const saveIntegration = async (validateLink: (link: string) => string | null, normalizeLink?: (link: string) => string) => {
        if (!formName.trim() || !formLink.trim() || !resolvedRoomId) return;
        const link = normalizeLink ? normalizeLink(formLink.trim()) : formLink.trim();
        const validationError = validateLink(link);
        if (validationError) {
            setFormError(validationError);
            return;
        }
        setIsSaving(true);
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
            if (editingIntegration) {
                await axios.put(
                    `${INTEGRATIONS_URL}/${editingIntegration._id}`,
                    { name: formName.trim(), link, type: integrationType },
                    { headers: { Authorization: `Bearer ${token}` } },
                );
                setIntegrations((prev) =>
                    prev.map((item) => (item._id === editingIntegration._id ? { ...item, name: formName.trim(), link } : item)),
                );
            } else {
                const response = await axios.post(
                    INTEGRATIONS_URL,
                    { name: formName.trim(), link, type: integrationType, roomId: resolvedRoomId },
                    { headers: { Authorization: `Bearer ${token}` } },
                );
                const created = response.data?.data ?? response.data;
                if (created?._id) {
                    setIntegrations((prev) => [created, ...prev]);
                    setActiveIntegrationId(created._id);
                } else await fetchIntegrations(1, false);
            }
        } catch {
            setFormError("Unable to save. Please try again.");
            return;
        } finally {
            setIsSaving(false);
            closeForm();
        }
    };

    const deleteIntegration = async (id: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
            await axios.delete(`${INTEGRATIONS_URL}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setIntegrations((prev) => {
                const remaining = prev.filter((item) => item._id !== id);
                if (activeIntegrationId === id) {
                    setActiveIntegrationId(remaining[0]?._id ?? null);
                }
                return remaining;
            });
        } catch (error) {
            console.error("Failed to delete integration", error);
        }
    };

    return {
        integrations,
        activeIntegration,
        activeIntegrationId,
        setActiveIntegrationId,
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
        filteredIntegrations,
        openForm,
        closeForm,
        saveIntegration,
        deleteIntegration,
        setFormName,
        setFormLink,
    };
}
