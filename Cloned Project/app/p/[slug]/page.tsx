"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchPublicCmsPage } from "@/lib/cms/api";
import type { CmsForm, CmsPageContent } from "@/lib/cms/types";
import PageRenderer from "@/components/deals/cms/PageRenderer";

function PublicCmsPageInner() {
  const params = useParams();
  const search = useSearchParams();
  const slug = String(params?.slug || "");
  const preview = search.get("preview") === "true";
  const [content, setContent] = useState<CmsPageContent | null>(null);
  const [form, setForm] = useState<CmsForm | null>(null);
  const [meta, setMeta] = useState<{ name?: string; metaTitle?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchPublicCmsPage(slug);
        if (cancelled) return;
        setContent(data.content || { modules: [] });
        setForm(data.form);
        setMeta({ name: data.name, metaTitle: data.metaTitle });
        if (data.metaTitle) document.title = data.metaTitle;
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Page not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F0F0F] text-white">
        Loading...
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F0F0F] text-white">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-[#888]">{error || "This landing page is unavailable."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {preview ? (
        <div className="bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-foreground">
          Preview mode — {meta.name || slug}
        </div>
      ) : null}
      <div className="mx-auto max-w-[720px] py-8">
        <PageRenderer content={content} form={form} interactive={!preview} width={680} />
      </div>
    </div>
  );
}

export default function PublicCmsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0F0F0F] text-white">
          Loading...
        </div>
      }
    >
      <PublicCmsPageInner />
    </Suspense>
  );
}
