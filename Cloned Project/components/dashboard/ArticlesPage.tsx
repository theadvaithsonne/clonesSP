"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Clock, Loader2, Search, Send, Check, Link2,
  Settings2, List, LayoutGrid, GripVertical, Eye, EyeOff,
  ChevronDown, X, Play, ArrowLeft, ArrowRight,
} from "lucide-react";
import { getPosts, getPostShareLink, type Post } from "@/lib/feed-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBrandColors } from "@/lib/brand-color-context";
import DOMPurify from "dompurify";
import "@/components/feed/article-editor.css";

const formatDate = (dateString: string | Date) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const day = d.getDate();
    const standardMonths = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = standardMonths[d.getMonth()];
    return `${day} ${month}`;
  } catch {
    return "";
  }
};

const formatDetailDate = (dateString: string | Date) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = pad(d.getUTCHours());
    const minutes = pad(d.getUTCMinutes());
    return `${day} ${month} ${year} · ${hours}:${minutes} GMT`;
  } catch {
    return "";
  }
};

function isHtmlContent(content: string): boolean {
  return /<(?:p|h[1-6]|ul|ol|blockquote|pre|hr|strong|em|a|code)[\s>]/i.test(content);
}

function sanitizeArticleHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
  });
}

function renderArticleContent(content: string, brandColor: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  const textColorClass = "text-[#c8c8db]";
  const headerColorClass = "text-white";
  const quoteColorClass = "text-[#b0b0c8]";

  lines.forEach((line, i) => {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className={cn("text-xl font-bold mt-10 mb-4 tracking-tight", headerColorClass)}
        >
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className={cn("text-2xl font-bold mt-12 mb-4 tracking-tight", headerColorClass)}
        >
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className={cn("text-3xl font-bold mt-12 mb-5 tracking-tight", headerColorClass)}
        >
          {trimmed.slice(2)}
        </h1>
      );
    } else if (trimmed.startsWith("---") || trimmed.startsWith("***")) {
      elements.push(
        <hr
          key={i}
          className="my-10 border-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${brandColor}40, transparent)` }}
        />
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-3 mb-2 ml-1">
          <span className="mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: brandColor }} />
          <p className={cn("text-[17px] sm:text-[18px] leading-[1.85]", textColorClass)}>
            {trimmed.slice(2)}
          </p>
        </div>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="my-6 pl-5 py-3 rounded-r-lg"
          style={{ borderLeft: `3px solid ${brandColor}` }}
        >
          <p className={cn("text-[17px] italic leading-[1.85]", quoteColorClass)}>
            {trimmed.slice(2)}
          </p>
        </blockquote>
      );
    } else if (trimmed === "") {
      elements.push(<div key={i} className="h-5" />);
    } else {
      // Bold text support: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={j} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      elements.push(
        <p
          key={i}
          className={cn("text-[17px] sm:text-[18px] leading-[1.85] mb-1", textColorClass)}
        >
          {rendered}
        </p>
      );
    }
  });

  return elements;
}


export function ArticlesPage({ viewRole = "customer" }: { viewRole?: "founder" | "customer" }) {
  const { brand: brandHex } = useBrandColors();
  const [articles, setArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgId, setOrgId] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // In-line detailed view state
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const [selectedArticleDetail, setSelectedArticleDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  // Read mode is always dark
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);

  // ── Manage panel state ──
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("art_viewMode") as "grid" | "list") || "grid";
    return "grid";
  });
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "az" | "za" | "custom">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("art_sortOrder") as any) || "newest";
    return "newest";
  });
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") { try { return JSON.parse(localStorage.getItem("art_customOrder") || "[]"); } catch { return []; } }
    return [];
  });
  const [hiddenArticleIds, setHiddenArticleIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") { try { return new Set(JSON.parse(localStorage.getItem("art_hiddenIds") || "[]")); } catch { return new Set(); } }
    return new Set();
  });
  const [showManagePanel, setShowManagePanel] = useState(false);

  useEffect(() => {
    if (showManagePanel) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [showManagePanel]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  // Persist preferences
  useEffect(() => { localStorage.setItem("art_viewMode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("art_sortOrder", sortOrder); }, [sortOrder]);
  useEffect(() => { localStorage.setItem("art_customOrder", JSON.stringify(customOrder)); }, [customOrder]);
  useEffect(() => { localStorage.setItem("art_hiddenIds", JSON.stringify([...hiddenArticleIds])); }, [hiddenArticleIds]);

  const toggleArticleVisibility = (id: string) => {
    setHiddenArticleIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const moveArticle = (id: string, direction: "up" | "down") => {
    setSortOrder("custom");
    setCustomOrder(prev => {
      const order = prev.length > 0 ? [...prev] : articles.map(a => a._id);
      const idx = order.indexOf(id);
      if (idx < 0) return order;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= order.length) return order;
      [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
      return order;
    });
  };

  // Sync custom order when articles load/change
  useEffect(() => {
    if (articles.length > 0 && customOrder.length === 0) {
      setCustomOrder(articles.map(a => a._id));
    } else if (articles.length > 0) {
      const ids = new Set(articles.map(a => a._id));
      const newIds = articles.filter(a => !customOrder.includes(a._id)).map(a => a._id);
      const cleaned = customOrder.filter(id => ids.has(id));
      if (newIds.length > 0 || cleaned.length !== customOrder.length) {
        setCustomOrder([...cleaned, ...newIds]);
      }
    }
  }, [articles]);

  useEffect(() => {
    const id = localStorage.getItem("garage_org_id") || "";
    const slug = localStorage.getItem("garage_org_slug") || "";
    setOrgId(id);
    setOrgSlug(slug);
    if (!id) { setLoading(false); return; }

    getPosts(id, { postType: "article", limit: 100 })
      .then((data) => setArticles(data.posts || []))
      .catch((err) => console.error("Error fetching articles:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleShare = useCallback(async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!orgId || sharingId) return;

    setSharingId(articleId);
    try {
      const { shareLink } = await getPostShareLink(articleId, orgId);
      await navigator.clipboard.writeText(shareLink);
      setCopiedId(articleId);
      toast.success("Share link copied! Anyone who joins through this link will be added to your network.");
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast.error("Failed to generate share link");
    } finally {
      setSharingId(null);
    }
  }, [orgId, sharingId]);

  useEffect(() => {
    if (!orgSlug) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    fetch(`${apiBase}/guest-auth/hq-by-slug/${orgSlug}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.organization) {
          setOrgDetails(data.organization);
          fetch(`${apiBase}/public/organizations/${data.organization._id}/users`)
            .then(r => r.json())
            .then(uData => {
              if (uData.success && uData.data?.users) {
                setOrgMembers(uData.data.users);
              }
            })
            .catch(err => console.error("Error fetching members:", err));
        }
      })
      .catch(err => console.error("Error fetching org details:", err));
  }, [orgSlug]);

  useEffect(() => {
    if (!selectedArticleId) {
      setSelectedArticleDetail(null);
      return;
    }
    setLoadingDetail(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    fetch(`${apiBase}/public/posts/${selectedArticleId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.post) {
          setSelectedArticleDetail(data.post);
        }
      })
      .catch(err => console.error("Error fetching article detail:", err))
      .finally(() => setLoadingDetail(false));
  }, [selectedArticleId]);

  // Sort + filter articles (respects manage panel settings)
  const sortedArticles = (() => {
    let arts = articles.filter(a => !hiddenArticleIds.has(a._id));
    if (sortOrder === "custom") {
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      arts.sort((a, b) => (orderMap.get(a._id) ?? 999) - (orderMap.get(b._id) ?? 999));
    } else {
      arts.sort((a, b) => {
        switch (sortOrder) {
          case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "az": return (a.title || "").localeCompare(b.title || "");
          case "za": return (b.title || "").localeCompare(a.title || "");
          default: return 0;
        }
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arts = arts.filter(a => a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q));
    }
    return arts;
  })();


  return (
    <div className="w-full min-h-full flex-shrink-0 flex flex-col pt-6 bg-[#0e0e12]">

      {/* ── Manage Modal ── */}
      {showManagePanel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowManagePanel(false)}>
          <div className="w-full max-w-lg mx-4 bg-[#12121a] border border-[#2a2a35] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35]">
              <div>
                <h2 className="text-base font-semibold text-white">Manage Articles</h2>
                <p className="text-xs text-[#9fa0b8] mt-0.5">Choose which articles to show &amp; arrange their order</p>
              </div>
              <button onClick={() => setShowManagePanel(false)} className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode + Sort */}
            <div className="px-5 py-3 border-b border-[#2a2a35]/60 flex flex-wrap gap-4">
              <div>
                <p className="text-[11px] font-semibold text-[#9fa0b8]/70 uppercase tracking-wider mb-2">View</p>
                <div className="flex gap-1.5">
                  {([{ k: "grid" as const, icon: LayoutGrid, label: "Grid" }, { k: "list" as const, icon: List, label: "List" }]).map((m) => (
                    <button key={m.k} onClick={() => setViewMode(m.k)} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all", viewMode === m.k ? "bg-brand text-brand-foreground" : "bg-[#1a1a22] text-[#9fa0b8] hover:text-white")}>
                      <m.icon className="w-3.5 h-3.5" /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#9fa0b8]/70 uppercase tracking-wider mb-2">Sort</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "newest" as const, label: "Newest" },
                    { key: "oldest" as const, label: "Oldest" },
                    { key: "az" as const, label: "A→Z" },
                    { key: "za" as const, label: "Z→A" },
                    { key: "custom" as const, label: "Custom" },
                  ].map((opt) => (
                    <button key={opt.key} onClick={() => setSortOrder(opt.key)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all", sortOrder === opt.key ? "bg-brand text-brand-foreground" : "bg-[#1a1a22] text-[#9fa0b8] hover:text-white")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Article List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {(sortOrder === "custom"
                ? customOrder.map(id => articles.find(a => a._id === id)).filter(Boolean) as Post[]
                : [...articles].sort((a, b) => {
                    switch (sortOrder) {
                      case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      case "az": return (a.title || "").localeCompare(b.title || "");
                      case "za": return (b.title || "").localeCompare(a.title || "");
                      default: return 0;
                    }
                  })
              ).map((article, idx, arr) => {
                const isHidden = hiddenArticleIds.has(article._id);
                return (
                  <div
                    key={article._id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150",
                      isHidden ? "opacity-40" : "",
                      dragOverId === article._id ? "bg-brand/10 border border-brand/30" : "hover:bg-[#1a1a22] border border-transparent"
                    )}
                    draggable={sortOrder === "custom"}
                    onDragStart={() => { dragItemRef.current = article._id; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(article._id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverId(null);
                      if (dragItemRef.current && dragItemRef.current !== article._id) {
                        setSortOrder("custom");
                        setCustomOrder(prev => {
                          const order = prev.length > 0 ? [...prev] : articles.map(a => a._id);
                          const fromIdx = order.indexOf(dragItemRef.current!);
                          const toIdx = order.indexOf(article._id);
                          if (fromIdx < 0 || toIdx < 0) return order;
                          order.splice(fromIdx, 1);
                          order.splice(toIdx, 0, dragItemRef.current!);
                          return order;
                        });
                      }
                      dragItemRef.current = null;
                    }}
                  >
                    {sortOrder === "custom" && (
                      <div className="cursor-grab active:cursor-grabbing text-[#9fa0b8]/50 hover:text-[#9fa0b8]">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}
                    <div className="w-14 h-9 rounded-md overflow-hidden flex-shrink-0 bg-[#1a1a22]">
                      {article.coverImage ? (
                        <img src={article.coverImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><FileText className="w-4 h-4 text-[#9fa0b8]/50" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{article.title || "Untitled"}</p>
                      <p className="text-[11px] text-[#9fa0b8]">{formatDate(article.createdAt)}</p>
                    </div>
                    {sortOrder === "custom" && (
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveArticle(article._id, "up")} disabled={idx === 0} className="p-0.5 rounded text-[#9fa0b8] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                          <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                        </button>
                        <button onClick={() => moveArticle(article._id, "down")} disabled={idx === arr.length - 1} className="p-0.5 rounded text-[#9fa0b8] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => toggleArticleVisibility(article._id)}
                      className={cn("p-1.5 rounded-lg transition-colors", isHidden ? "text-red-400/60 hover:text-red-400" : "text-green-400/70 hover:text-green-400")}
                      title={isHidden ? "Show article" : "Hide article"}
                    >
                      {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
              {articles.length === 0 && (
                <p className="text-sm text-[#9fa0b8] text-center py-8">No articles available to manage.</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#2a2a35] flex items-center justify-between">
              <p className="text-xs text-[#9fa0b8]">
                {articles.length - hiddenArticleIds.size} of {articles.length} visible
              </p>
              <button onClick={() => setShowManagePanel(false)} className="px-4 py-2 rounded-lg text-sm bg-brand text-brand-foreground font-medium hover:bg-brand/90 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 pb-6">
        {selectedArticleId ? (
          loadingDetail || !selectedArticleDetail ? (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto py-2 text-white">
              {/* Back Button */}
              <button
                onClick={() => setSelectedArticleId(null)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[#9fa0b8] hover:text-white hover:bg-white/5 transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Articles</span>
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                {/* Left side: Article detailed content (col-span-7) */}
                <div className="lg:col-span-7 flex flex-col">
                  {/* Media: Video player or Cover Image */}
                  {(() => {
                    const videoAttachment = selectedArticleDetail.attachments?.find((att: any) => att.type === "video");
                    if (videoAttachment) {
                      return (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black mb-6 border border-[#2a2a35]/60 shadow-lg">
                          <video src={videoAttachment.url} controls className="w-full h-full object-contain" />
                        </div>
                      );
                    } else {
                      const cover =
                        selectedArticleDetail.coverImage ||
                        (selectedArticleDetail as any).cover_image ||
                        (selectedArticleDetail as any).cover ||
                        (selectedArticleDetail as any).headerImage ||
                        (selectedArticleDetail as any).banner ||
                        selectedArticleDetail.attachments?.find((att: any) => att.type === "image" || att.type === "photo")?.url;

                      if (cover) {
                        return (
                          <div className="w-full flex justify-start mb-6">
                            <div className="relative max-w-full overflow-hidden rounded-2xl border border-[#2a2a35]/60 shadow-lg">
                              <img src={cover} alt={selectedArticleDetail.title} className="w-auto max-w-full h-auto max-h-[480px] object-contain block" />
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="relative w-full aspect-video rounded-2xl bg-gradient-to-br from-[#1a1a24] to-[#0e0e12] flex items-center justify-center mb-6 border border-[#2a2a35]/60 shadow-lg">
                            <FileText className="w-16 h-16 text-[#2a2a35]" />
                          </div>
                        );
                      }
                    }
                  })()}

                  {/* Title */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h1 className="font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-tight leading-tight flex-1 text-white">
                      {selectedArticleDetail.title}
                    </h1>
                  </div>

                  {/* Byline: profile, author name, yellow dot, date */}
                  <div className="flex items-center gap-2 mb-6 text-xs sm:text-sm">
                    {selectedArticleDetail.author?.profilePicture ? (
                      <img src={selectedArticleDetail.author.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover border border-[#2a2a35]" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#2a2a35] flex items-center justify-center text-brand text-xs font-semibold">
                        {selectedArticleDetail.author?.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="text-[#9fa0b8]">by</span>
                    <span className="font-medium text-white">{selectedArticleDetail.author?.name || "Unknown"}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-brand mx-1 shrink-0" />
                    <span className="text-[#9fa0b8]">{formatDetailDate(selectedArticleDetail.createdAt)}</span>
                  </div>

                  {/* Rich Content Body */}
                  <div className="article-body max-w-none p-5 sm:p-6 rounded-2xl leading-relaxed transition-all border duration-300 bg-[#111115] text-[#c8c8db] border-[#1e1e24] prose-dark">
                    {selectedArticleDetail.content && (
                      isHtmlContent(selectedArticleDetail.content) ? (
                        <div
                          className="article-prose-html text-sm sm:text-base leading-relaxed space-y-4 text-[#c8c8db]"
                          style={{ '--brand-color': 'var(--brand)' } as React.CSSProperties}
                          dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(selectedArticleDetail.content) }}
                        />
                      ) : (
                        renderArticleContent(selectedArticleDetail.content, brandHex)
                      )
                    )}
                  </div>
                </div>

                {/* Right side: Sidebar (col-span-3) */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                  {/* Recommended Articles from the Writer */}
                  <div>
                    <h4 className="text-[11px] font-bold tracking-wider mb-3 uppercase text-[#9fa0b8]">
                      More From The Same Writer
                    </h4>
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const recommended = articles.filter(a => a._id !== selectedArticleDetail._id && a.authorId?._id === selectedArticleDetail.authorId?._id).slice(0, 4);
                        const finalRec = recommended.length > 0 ? recommended : articles.filter(a => a._id !== selectedArticleDetail._id).slice(0, 4);
                        
                        if (finalRec.length === 0) {
                          return <p className="text-xs text-[#4a4a5a]">No other articles available.</p>;
                        }

                        return finalRec.map((recArt) => {
                          const videoAtt = recArt.attachments?.find((a: any) => a.type === "video");
                          return (
                            <div
                              key={recArt._id}
                              onClick={() => {
                                setSelectedArticleId(recArt._id);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="flex items-start justify-between gap-4 py-3 border-b last:border-0 rounded-xl px-2 transition-all cursor-pointer group duration-300 border-[#2a2a35]/30 hover:bg-[#1a1a24]/30"
                            >
                              <span className="text-xs sm:text-sm font-medium transition-colors duration-300 flex-1 leading-snug line-clamp-2 text-[#c8c8db] group-hover:text-brand">
                                {recArt.title || "Untitled Article"}
                              </span>
                              <div className="w-20 h-12 relative overflow-hidden rounded-lg bg-[#0e0e12] shrink-0 border border-[#2a2a35]/40">
                                {recArt.coverImage ? (
                                  <img src={recArt.coverImage} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-[#2a2a35]" />
                                  </div>
                                )}
                                {videoAtt && (
                                  <div className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] text-white flex items-center gap-0.5">
                                    <Play className="w-1.5 h-1.5 fill-current shrink-0" />
                                    <span>01:20</span>
                                  </div>
                                )}
                                {!videoAtt && recArt.readingTimeMinutes && (
                                  <div className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] text-white flex items-center gap-0.5">
                                    <Clock className="w-1.5 h-1.5 shrink-0" />
                                    <span>{recArt.readingTimeMinutes}m</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
            {viewRole === "founder" && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowManagePanel(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35] hover:text-white hover:border-[#3a3a45] hover:bg-[#1e1e28]"
                >
                  <Settings2 className="w-4 h-4" />
                  <span>Manage</span>
                </button>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-brand animate-spin" />
              </div>
            ) : sortedArticles.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-12 h-12 text-[#2a2a35] mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No Articles Yet
                </h3>
                <p className="text-sm text-[#9fa0b8]">
                  Articles published in the feed will appear here.
                </p>
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-3"}>
            {sortedArticles.map((article, index) => {
              const isSharing = sharingId === article._id;
              const isCopied = copiedId === article._id;
              const isHorizontal = index % 6 === 0 || index % 6 === 1;
              return (
                <div
                  key={article._id}
                  onClick={() => setSelectedArticleId(article._id)}
                  className={viewMode === "grid"
                    ? isHorizontal
                      ? "text-left w-full bg-[#111115] border border-[#1e1e24] rounded-2xl overflow-hidden hover:border-brand/30 transition-all group focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer col-span-1 sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row sm:h-[220px] p-4 gap-4 sm:gap-6"
                      : "text-left w-full bg-[#111115] border border-[#1e1e24] rounded-2xl overflow-hidden hover:border-brand/30 transition-all group focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer col-span-1 flex flex-col justify-between p-4 gap-4"
                    : "text-left w-full bg-[#111115] border border-[#1e1e24] rounded-2xl overflow-hidden hover:border-brand/30 transition-all group focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer flex p-4 gap-4"
                  }
                >
                  {viewMode === "grid" ? (
                    isHorizontal ? (
                      /* ── Featured Horizontal Card ── */
                      <>
                        {/* Cover Image */}
                        <div className="w-full sm:w-[280px] md:w-[320px] lg:w-[360px] shrink-0 aspect-[16/9] sm:aspect-auto sm:h-full relative overflow-hidden rounded-xl bg-[#0e0e12]">
                          {article.coverImage ? (
                            <img
                              src={article.coverImage}
                              alt={article.title || "Article"}
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#1a1a24] to-[#0e0e12] flex items-center justify-center">
                              <FileText className="w-8 h-8 text-[#2a2a35]" />
                            </div>
                          )}
                        </div>
                        {/* Body */}
                        <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                          <div>
                            {article.title && (
                              <h3 className="text-white font-bold text-lg sm:text-xl md:text-2xl leading-snug mb-3 group-hover:text-brand transition-colors line-clamp-1">
                                {article.title}
                              </h3>
                            )}
                            {article.content && (() => {
                              const plainText = article.content
                                .replace(/<[^>]*>/g, '')
                                .replace(/&nbsp;/g, ' ')
                                .replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&quot;/g, '"')
                                .replace(/&#039;/g, "'")
                                .replace(/\s+/g, ' ')
                                .trim();
                              return plainText ? (
                                <p className="text-[#9fa0b8] text-xs sm:text-sm leading-relaxed mb-6 line-clamp-2">
                                  {plainText}
                                </p>
                              ) : null;
                            })()}
                          </div>

                          {/* Author + Date + Share */}
                          <div className="flex flex-row items-center justify-between gap-4 mt-auto pt-3 border-t-0 w-full">
                            <div className="flex items-center gap-2 min-w-0 shrink-0">
                              {article.authorId?.profilePicture ? (
                                <img src={article.authorId.profilePicture} alt="" className="w-6 h-6 sm:w-7 h-7 rounded-full object-cover border border-[#2a2a35]" />
                              ) : (
                                <div className="w-6 h-6 sm:w-7 h-7 rounded-full bg-[#2a2a35] flex items-center justify-center text-brand text-[10px] font-semibold">
                                  {article.authorId?.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                              )}
                              <span className="text-[#9fa0b8] text-xs font-normal">by</span>
                              <span className="text-white text-xs font-medium truncate max-w-[80px] sm:max-w-none">{article.authorId?.name || "Unknown"}</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-brand mx-1.5 shrink-0 inline-block" />
                              <span className="text-[#9fa0b8] text-xs font-normal">{formatDate(article.createdAt)}</span>
                            </div>
                            <button
                              onClick={(e) => handleShare(e, article._id)}
                              disabled={isSharing}
                              className={cn(
                                "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 justify-center",
                                isCopied 
                                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                                  : "bg-transparent border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] hover:bg-[#1e1e28]"
                              )}
                              title="Copy share link"
                            >
                              {isSharing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isCopied ? (
                                <><Check className="w-3.5 h-3.5" /> Link Copied</>
                              ) : (
                                <><Link2 className="w-3.5 h-3.5" /> Share Affiliate Link</>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* ── Standard Vertical Card ── */
                      <>
                        {/* Cover Image */}
                        <div className="w-full aspect-[16/10] relative overflow-hidden rounded-xl bg-[#0e0e12]">
                          {article.coverImage ? (
                            <img
                              src={article.coverImage}
                              alt={article.title || "Article"}
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#1a1a24] to-[#0e0e12] flex items-center justify-center">
                              <FileText className="w-6 h-6 text-[#2a2a35]" />
                            </div>
                          )}
                        </div>
                        {/* Body */}
                        <div className="flex-1 flex flex-col justify-between min-w-0 pt-2 pb-1">
                          <div>
                            {article.title && (
                              <h3 className="text-white font-bold text-sm sm:text-base leading-snug mb-2 group-hover:text-brand transition-colors line-clamp-2">
                                {article.title}
                              </h3>
                            )}
                            {article.content && (() => {
                              const plainText = article.content
                                .replace(/<[^>]*>/g, '')
                                .replace(/&nbsp;/g, ' ')
                                .replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&quot;/g, '"')
                                .replace(/&#039;/g, "'")
                                .replace(/\s+/g, ' ')
                                .trim();
                              return plainText ? (
                                <p className="text-[#9fa0b8] text-xs leading-relaxed mb-4 line-clamp-2">
                                  {plainText}
                                </p>
                              ) : null;
                            })()}
                          </div>

                          {/* Author + Date + Share */}
                          <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {article.authorId?.profilePicture ? (
                                <img src={article.authorId.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover border border-[#2a2a35] shrink-0" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-[#2a2a35] flex items-center justify-center text-brand text-[9px] font-semibold shrink-0">
                                  {article.authorId?.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                              )}
                              <span className="text-[#9fa0b8] text-[11px] font-normal shrink-0">by</span>
                              <span className="text-white text-[11px] font-medium truncate max-w-[65px] xs:max-w-none">{article.authorId?.name || "Unknown"}</span>
                              <span className="w-1 h-1 rounded-full bg-brand shrink-0 inline-block" />
                              <span className="text-[#9fa0b8] text-[11px] font-normal shrink-0">{formatDate(article.createdAt)}</span>
                            </div>
                            <button
                              onClick={(e) => handleShare(e, article._id)}
                              disabled={isSharing}
                              className={cn(
                                "flex items-center justify-center rounded-lg border transition-all shrink-0 aspect-square w-8 h-8",
                                isCopied 
                                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                                  : "bg-transparent border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] hover:bg-[#1e1e28]"
                              )}
                              title="Copy share link"
                            >
                              {isSharing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isCopied ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )
                  ) : (
                    /* ── List View ── */
                    <>
                      {article.coverImage && (
                        <div className="w-32 sm:w-40 flex-shrink-0 overflow-hidden rounded-xl">
                          <img src={article.coverImage} alt={article.title || "Article"} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-semibold uppercase tracking-wide">
                            <FileText className="w-3 h-3" />Article
                          </span>
                          {article.readingTimeMinutes && (
                            <span className="inline-flex items-center gap-1 text-[#9fa0b8] text-[10px]">
                              <Clock className="w-3 h-3" />{article.readingTimeMinutes} min
                            </span>
                          )}
                        </div>
                        {article.title && <h3 className="text-white font-semibold text-sm leading-snug mb-1 truncate">{article.title}</h3>}
                        <div className="flex items-center gap-2 text-[#9fa0b8] text-[11px] mt-1">
                          <span className="text-[#9fa0b8] text-xs font-normal">by</span>
                          <span className="text-white text-xs font-medium">{article.authorId?.name || "Unknown"}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-brand mx-1.5 shrink-0 inline-block" />
                          <span>{formatDate(article.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center px-4 flex-shrink-0">
                        <button
                          onClick={(e) => handleShare(e, article._id)}
                          disabled={isSharing}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            isCopied
                              ? "bg-green-500/10 border-green-500/30 text-green-400"
                              : "bg-transparent border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] hover:bg-[#1e1e28]"
                          )}
                          title="Copy share link"
                        >
                          {isSharing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isCopied ? (
                            <><Check className="w-3 h-3" /> Copied</>
                          ) : (
                            <><Link2 className="w-3 h-3" /> Share</>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
      </div>
    </div>
  );
}
