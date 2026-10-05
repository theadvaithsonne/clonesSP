"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ExtendedRecordMap } from "notion-types";
import { AlertCircle, RefreshCw } from "lucide-react";
import "react-notion-x/styles.css";
import "./notion-shell.css";

const NotionRenderer = dynamic(
    () => import("react-notion-x").then((mod) => mod.NotionRenderer),
    { ssr: false },
);

const Collection = dynamic(() =>
    import("react-notion-x/build/third-party/collection").then((m) => m.Collection),
);
const Code = dynamic(() =>
    import("react-notion-x/build/third-party/code").then((m) => m.Code),
);
const Modal = dynamic(() =>
    import("react-notion-x/build/third-party/modal").then((m) => m.Modal),
);

interface NotionPageViewerProps {
    pageUrl: string;
    pageTitle?: string;
    refreshToken?: number;
}

export default function NotionPageViewer({ pageUrl, pageTitle, refreshToken = 0 }: NotionPageViewerProps) {
    const [recordMap, setRecordMap] = useState<ExtendedRecordMap | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const loadPage = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        setRecordMap(null);

        try {
            const res = await fetch(`/api/notion/page?url=${encodeURIComponent(pageUrl)}`, { signal });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || "Failed to load Notion page");
            }
            setRecordMap(json.recordMap);
        } catch (err) {
            if (signal?.aborted) return;
            setError(err instanceof Error ? err.message : "Failed to load Notion page");
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [pageUrl]);

    useEffect(() => {
        const controller = new AbortController();
        void loadPage(controller.signal);
        return () => controller.abort();
    }, [loadPage, refreshToken]);

    if (loading) {
        return (
            <div className="garage-notion-loading">
                <div className="garage-notion-loading-bar" />
                <span>Loading document...</span>
            </div>
        );
    }

    if (error || !recordMap) {
        return (
            <div className="flex h-full items-center justify-center bg-[#0e0e12] px-6 py-10">
                <div className="max-w-md rounded-2xl border border-white/[0.08] bg-[#14141a] p-8 text-center">
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-white">Unable to load document</p>
                    <p className="mt-2 text-[13px] text-white/50 leading-relaxed">{error}</p>
                    <button
                        type="button"
                        onClick={() => void loadPage()}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-colors"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="garage-notion-canvas">
            <div className="garage-notion-document">
                <NotionRenderer
                    recordMap={recordMap}
                    fullPage
                    darkMode={false}
                    disableHeader
                    previewImages
                    isImageZoomable
                    pageTitle={pageTitle}
                    components={{ Code, Collection, Modal }}
                />
            </div>
        </div>
    );
}
