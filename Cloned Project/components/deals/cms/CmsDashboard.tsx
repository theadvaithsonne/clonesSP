"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Copy,
  Eye,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  cloneCmsPage,
  createCmsPage,
  deleteCmsPage,
  listCmsPages,
  updateCmsPageStatus,
} from "@/lib/cms/api";
import type { CmsPage } from "@/lib/cms/types";
import { useDealsInlineRefresh } from "@/lib/deals-events";
import DomainSettingsModal from "./DomainSettingsModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FilterChip = "all" | "published" | "draft" | "archived";
type SortBy = "recent" | "name" | "leads";

function statusBadge(status: string) {
  if (status === "published") {
    return "bg-[#22C55E]/15 text-[#22C55E]";
  }
  if (status === "draft") {
    return "bg-[#2A2A2A] text-[#AAAAAA]";
  }
  return "bg-[#2A2A2A] text-[#888]";
}

function formatRelative(date?: string) {
  if (!date) return "—";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CmsDashboard({
  onOpenBuilder,
}: {
  onOpenBuilder: (pageId: string) => void;
}) {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [filter, setFilter] = useState<FilterChip>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [loading, setLoading] = useState(true);
  const [domainOpen, setDomainOpen] = useState(false);
  const [domainSlug, setDomainSlug] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCmsPages(filter === "all" ? undefined : filter);
      setPages(data.pages || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useDealsInlineRefresh("cms", () => {
    load();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => createPage();
    window.addEventListener("deals:open-new-cms-page", handler);
    return () => window.removeEventListener("deals:open-new-cms-page", handler);
  }, []);

  const createPage = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { page } = await createCmsPage({ name: "Untitled Page" });
      toast.success("Page created");
      onOpenBuilder(page.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create page");
    } finally {
      setCreating(false);
    }
  };

  const clonePage = async (id: string) => {
    try {
      const { page } = await cloneCmsPage(id);
      toast.success("Page cloned");
      await load();
      onOpenBuilder(page.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to clone page");
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await updateCmsPageStatus(id, status);
      toast.success(`Page ${status}`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const deletePage = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCmsPage(deleteTarget.id);
      toast.success("Page deleted");
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete page");
    } finally {
      setDeleting(false);
    }
  };

  const openDomain = (slug?: string) => {
    setDomainSlug(slug);
    setDomainOpen(true);
  };

  const filtered = useMemo(() => {
    let list = pages.filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "leads") return (b.leadCount || 0) - (a.leadCount || 0);
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

    return list;
  }, [pages, search, sortBy]);

  const sortLabel =
    sortBy === "name" ? "Name" : sortBy === "leads" ? "Leads" : "Recent";

  return (
    <div className="cms-ui min-h-full bg-[#0F0F0F] text-white">
      <div className="px-5 py-5">
        {/* Filter bar — matches Figma: chips left, search + sort right */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "published", "draft", "archived"] as FilterChip[]).map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setFilter(chip)}
                className={`h-7 cursor-pointer rounded-full px-4 text-[13px] font-medium capitalize transition ${
                  filter === chip
                    ? "border border-brand bg-brand !text-brand-foreground"
                    : "border border-[#2A2A2A] bg-[#1E1E1E] text-[#888] hover:border-[#555] hover:text-white"
                }`}
              >
                {chip === "all" ? "All" : chip.charAt(0).toUpperCase() + chip.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#555]" />
              <input
                className="h-8 w-[200px] rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] py-0 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-[#555] focus:border-brand"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 text-[13px] text-[#ccc]"
                >
                  Sort by: {sortLabel}
                  <ChevronDown className="h-3 w-3 text-[#888]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-[#2A2A2A] bg-[#1E1E1E] text-white"
              >
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-white/10 focus:text-white"
                  onClick={() => setSortBy("recent")}
                >
                  Recent
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-white/10 focus:text-white"
                  onClick={() => setSortBy("name")}
                >
                  Name
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-white/10 focus:text-white"
                  onClick={() => setSortBy("leads")}
                >
                  Leads
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-[#888]">Loading pages...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2A2A2A] py-16 text-center">
            <p className="text-sm text-[#888]">No landing pages yet</p>
            <button
              type="button"
              onClick={createPage}
              disabled={creating}
              className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold !text-brand-foreground disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create your first page
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((page) => (
              <div
                key={page.id}
                className="overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#141414]"
              >
                {/* Thumbnail with browser chrome */}
                <div className="relative h-[180px] bg-[#0a0a0a]">
                  <div className="flex h-6 items-center gap-1.5 border-b border-white/10 bg-[#1A1A1A] px-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                    <span className="ml-2 truncate font-mono text-[10px] text-[#666]">
                      garage.app/p/{page.slug}
                    </span>
                  </div>
                  <div className="flex h-[calc(100%-24px)] flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#1a1a2e] to-[#111118] px-6">
                    <div className="h-2 w-24 rounded-full bg-white/25" />
                    <div className="h-1.5 w-36 rounded-full bg-white/15" />
                    <div className="mt-1 flex gap-1.5">
                      <div className="h-3 w-10 rounded bg-brand/80" />
                      <div className="h-3 w-10 rounded bg-white/20" />
                    </div>
                  </div>
                  <span
                    className={`absolute right-2 top-8 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${statusBadge(
                      page.status
                    )}`}
                  >
                    {page.status}
                  </span>
                </div>

                <div className="p-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="truncate text-[15px] font-semibold">{page.name}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 cursor-pointer rounded p-0.5 text-[#555] hover:bg-white/10 hover:text-white"
                          aria-label="Page actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 border-[#2A2A2A] bg-[#1E1E1E] text-white"
                      >
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-white/10 focus:text-white"
                          onClick={() => openDomain(page.slug)}
                        >
                          <Globe className="mr-2 h-3.5 w-3.5" />
                          Connect Domain
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#2A2A2A]" />
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-white/10 focus:text-white"
                          onClick={() => clonePage(page.id)}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Clone
                        </DropdownMenuItem>
                        {page.status !== "published" ? (
                          <DropdownMenuItem
                            className="mx-1 my-0.5 cursor-pointer rounded-md border border-[#2A2A2A] focus:bg-white/10 focus:text-white"
                            onClick={() => setStatus(page.id, "published")}
                          >
                            Publish
                          </DropdownMenuItem>
                        ) : null}
                        {page.status !== "draft" ? (
                          <DropdownMenuItem
                            className="mx-1 my-0.5 cursor-pointer rounded-md border border-[#2A2A2A] focus:bg-white/10 focus:text-white"
                            onClick={() => setStatus(page.id, "draft")}
                          >
                            Move to Draft
                          </DropdownMenuItem>
                        ) : null}
                        {page.status !== "archived" ? (
                          <DropdownMenuItem
                            className="mx-1 my-0.5 cursor-pointer rounded-md border border-[#2A2A2A] focus:bg-white/10 focus:text-white"
                            onClick={() => setStatus(page.id, "archived")}
                          >
                            Archive
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator className="bg-[#2A2A2A]" />
                        <DropdownMenuItem
                          className="mx-1 my-0.5 cursor-pointer rounded-md border border-[#EF4444]/40 text-[#EF4444] focus:bg-red-500/10 focus:text-[#EF4444]"
                          onClick={() => setDeleteTarget({ id: page.id, name: page.name })}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete Page
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="truncate font-mono text-[12px] text-[#888]">
                    garage.app/p/{page.slug}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-[12px] text-[#888]">
                    <span>{page.leadCount || 0} leads</span>
                    <span className="h-3 w-px bg-[#2A2A2A]" />
                    <span>{page.conversionRate || 0}% CVR</span>
                    <span className="ml-auto">Edited {formatRelative(page.updatedAt)}</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenBuilder(page.id)}
                      className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] py-2 text-xs font-medium text-white hover:border-brand"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <a
                      href={page.status === "published" ? `/p/${page.slug}` : undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (page.status !== "published") {
                          e.preventDefault();
                          toast.message("Publish the page to view it live");
                        }
                      }}
                      className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] py-2 text-xs font-medium text-white hover:border-brand"
                    >
                      <Eye className="h-3 w-3" /> View
                    </a>
                    <button
                      type="button"
                      onClick={() => clonePage(page.id)}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2.5 py-2 text-xs text-white hover:border-brand"
                      title="Clone"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DomainSettingsModal
        open={domainOpen}
        onClose={() => setDomainOpen(false)}
        pageSlug={domainSlug || filtered[0]?.slug}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-[420px] rounded-[14px] border border-[#2A2A2A] bg-[#141414] text-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cms-delete-title"
          >
            <div className="flex items-start justify-between border-b border-[#2A2A2A] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EF4444]/15">
                  <Trash2 className="h-4 w-4 text-[#EF4444]" />
                </div>
                <div>
                  <h2 id="cms-delete-title" className="text-[16px] font-bold">
                    Delete page?
                  </h2>
                  <p className="mt-1 text-sm text-[#888]">
                    This will permanently remove the page and its form config. This cannot be
                    undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer rounded p-1 text-[#888] hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-3">
                <p className="truncate text-sm font-semibold text-white">{deleteTarget.name}</p>
                <p className="mt-0.5 text-xs text-[#888]">Landing page</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#2A2A2A] px-5 py-4">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-4 py-2 text-sm text-white hover:border-[#555] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={deletePage}
                className="cursor-pointer rounded-lg border border-[#EF4444] bg-[#EF4444] px-4 py-2 text-sm font-bold text-white hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Page"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
