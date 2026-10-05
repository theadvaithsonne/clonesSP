"use client";

import React from "react";
import { Loader2, Plus } from "lucide-react";
import type { IntegrationItem } from "./integration-view-shell";

export function IntegrationEmptyState({
    isLoading,
    loadingLabel,
    icon,
    title,
    description,
    cta,
    onCta,
}: {
    isLoading: boolean;
    loadingLabel: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    cta: string;
    onCta: () => void;
}) {
    return (
        <div className="flex h-full items-center justify-center bg-[#0e0e12] px-4">
            {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    <span className="text-[13px] text-white/40">{loadingLabel}</span>
                </div>
            ) : (
                <div className="max-w-sm text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 border border-brand/20">
                        {icon}
                    </div>
                    <h2 className="text-[15px] sm:text-[16px] font-semibold text-white">{title}</h2>
                    <p className="text-[12px] sm:text-[13px] text-white/40 mt-2">{description}</p>
                    <button
                        type="button"
                        onClick={onCta}
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13px] font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] touch-manipulation"
                    >
                        <Plus className="h-4 w-4" />
                        {cta}
                    </button>
                </div>
            )}
        </div>
    );
}

export function IntegrationInvalidState({ message }: { message: string }) {
    return (
        <div className="flex h-full items-center justify-center bg-[#0e0e12] px-4">
            <div className="max-w-sm text-center rounded-2xl border border-white/[0.08] bg-[#14141a] p-6 sm:p-8">
                <p className="text-[13px] font-medium text-white">Invalid URL</p>
                <p className="text-[12px] text-white/40 mt-2">{message}</p>
            </div>
        </div>
    );
}

export function IntegrationIframe({
    src,
    title,
    allow,
}: {
    src: string;
    title: string;
    allow?: string;
}) {
    return (
        <iframe
            src={src}
            title={title}
            className="w-full h-full min-h-[240px] border-none bg-white"
            allow={allow ?? "autoplay; encrypted-media; clipboard-read; clipboard-write; fullscreen"}
            allowFullScreen
        />
    );
}

export function IntegrationYoutubeIframe({ src, title }: { src: string; title: string }) {
    return (
        <div className="flex h-full flex-col min-h-0 bg-black">
            <div className="relative w-full flex-1 min-h-[200px] sm:min-h-0">
                <iframe
                    src={src}
                    title={title}
                    className="absolute inset-0 w-full h-full border-none"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                />
            </div>
        </div>
    );
}
