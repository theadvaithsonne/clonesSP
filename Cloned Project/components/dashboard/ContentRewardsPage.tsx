"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Gift, Plus, Eye, DollarSign, Users, CheckCircle2, XCircle, Clock,
  Loader2, AlertCircle, TrendingUp, ChevronDown, ExternalLink, Send,
  Megaphone, Sparkles, BarChart3, ArrowLeft, Link2, Trash2, RefreshCw,
  FileText, ImageIcon, Upload, X, Wallet, Lock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  fetchCampaigns, createCampaign, updateCampaign, deleteCampaign,
  fetchCampaignStats, fetchCampaignSubmissions, reviewSubmission,
  refreshCampaignViews, refreshSubmissionViews, fetchLivePreviewViews,
  fetchStoreWalletBalance, fetchCampaignWallet,
  type Campaign, type Submission, type CampaignStats, type CampaignWalletInfo,
  type CampaignWalletTransactionItem,
} from "@/lib/content-rewards-api";
import { uploadFile } from "@/lib/feed-api";
import { getOrgId } from "@/lib/auth";
import { useBrandColors } from "@/lib/brand-color-context";

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#e1306c", youtube: "#ff0000",
};
const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram", youtube: "YouTube",
};

// USD-only for V1. The optional currency arg is preserved for API compatibility
// with existing call sites but always renders "$".
function fmtMoney(cents: number, _currency?: unknown) {
  void _currency;
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtNum(n: number) { return n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n); }

// ── Stat Card ──
function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[#2a2a35] bg-[#12121a] px-3 py-2.5 hover:border-[#3a3a45] transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color: accent || "var(--brand)" }} />
        <span className="text-[10px] text-[#9fa0b8] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-white leading-tight">{value}</p>
    </div>
  );
}

// ── Create Campaign Modal ──
function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [campaignType, setCampaignType] = useState<"clipping"|"ugc">("ugc");
  const [budget, setBudget] = useState("");
  const [rate, setRate] = useState("");
  // Founder picks any view-bucket size; we still store the CPM-equivalent
  // ratePerThousand (cents) on the backend so the sweeper math is unchanged.
  const [viewBucket, setViewBucket] = useState("1000");
  const [platforms, setPlatforms] = useState<string[]>(["youtube"]);
  const [guidelines, setGuidelines] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [resourceLinks, setResourceLinks] = useState<{ url: string; label: string; type: string }[]>([]);
  const [showResources, setShowResources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the founder's StoreWallet balance so we can pre-validate the budget.
  useEffect(() => {
    let cancelled = false;
    const orgId = getOrgId();
    if (!orgId) {
      setWalletBalance(0);
      return;
    }
    fetchStoreWalletBalance(orgId)
      .then(res => { if (!cancelled) setWalletBalance(res.balance ?? 0); })
      .catch(() => { if (!cancelled) setWalletBalance(0); });
    return () => { cancelled = true; };
  }, []);

  const budgetNum = parseFloat(budget) || 0;
  const insufficient =
    walletBalance !== null && budgetNum > 0 && budgetNum > walletBalance;

  // Only YouTube is currently available — Instagram coming soon
  const LOCKED_PLATFORMS = ["instagram"];
  const togglePlatform = (p: string) => {
    if (LOCKED_PLATFORMS.includes(p)) return; // locked
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  // Derived: convert the founder-friendly "$X per N views" pair into the
  // canonical ratePerThousand (cents per 1,000 views) the backend stores.
  // Memoized so the summary panel + validation share the same math.
  const rateNum = parseFloat(rate) || 0;
  const bucketNum = parseInt(viewBucket, 10) || 0;
  const ratePerThousandCents = bucketNum > 0
    ? Math.round((rateNum / bucketNum) * 1000 * 100)
    : 0;
  const budgetCents = Math.round((parseFloat(budget) || 0) * 100);
  // How many views the budget can pay out for at this rate.
  const estimatedReachViews = ratePerThousandCents > 0
    ? Math.floor((budgetCents / ratePerThousandCents) * 1000)
    : 0;
  const summaryReady = budgetCents > 0 && ratePerThousandCents > 0 && bucketNum > 0;

  const handleCreate = async () => {
    if (!title.trim()) return setError("Title is required");
    if (!budget || parseFloat(budget) < 1) return setError("Budget must be at least $1");
    if (!rate || parseFloat(rate) < 0.01) return setError("Rate must be at least $0.01");
    if (!bucketNum || bucketNum < 1) return setError("Views must be at least 1");
    // Backend schema requires ratePerThousand ≥ 1 cent. If the founder picks
    // a giant bucket (e.g. $0.01 per 100K views) the cents-per-1K rounds to 0.
    if (ratePerThousandCents < 1) return setError("Rate is too small for this view count — increase the rate or lower the views.");
    if (platforms.length === 0) return setError("Select at least one platform");
    if (insufficient) {
      return setError(
        `Insufficient Store Wallet balance. You have $${(walletBalance ?? 0).toFixed(2)}, need $${budgetNum.toFixed(2)}.`
      );
    }

    setSaving(true); setError("");
    try {
      // Currency is omitted — backend defaults to USD. V1 is USD-only.
      await createCampaign({
        title: title.trim(),
        description: description.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        campaignType,
        budget: budgetCents,
        ratePerThousand: ratePerThousandCents,
        platforms: platforms as any,
        requirements: { minDuration: 0, maxDuration: 0, hashtags: [], mentions: [], guidelines: showGuidelines ? guidelines : "" },
        resourceLinks: showResources ? resourceLinks.filter(r => r.url.trim()) : [],
        status: "active",
      } as any);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to create campaign");
    }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#12121a] border border-[#2a2a35] rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand" /> Create Campaign</h2>
          <div className="flex items-center gap-2 shrink-0">
            {walletBalance !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0a10] border border-[#2a2a35]">
                <Wallet className="h-3 w-3 text-brand" />
                <span className="text-[10px] text-[#9fa0b8]">Store Wallet</span>
                <span className={`text-[11px] font-semibold tabular-nums ${insufficient ? "text-red-400" : "text-white"}`}>
                  ${walletBalance.toFixed(2)}
                </span>
              </div>
            )}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35]/50 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Thumbnail Upload */}
        <div>
          <label className="text-xs text-[#9fa0b8] mb-2 flex items-center gap-1.5 font-medium"><ImageIcon className="h-3.5 w-3.5 text-brand" /> Campaign Thumbnail</label>
          {thumbnailUrl ? (
            <div className="relative mb-2 rounded-xl overflow-hidden border border-[#2a2a35] bg-[#0a0a10] group">
              <img src={thumbnailUrl} alt="Preview" className="w-full h-40 object-cover" />
              <button type="button" onClick={() => setThumbnailUrl("")} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-red-500/80 transition opacity-0 group-hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full h-36 rounded-xl border-2 border-dashed border-[#2a2a35] bg-[#0a0a10] hover:border-brand/30 hover:bg-brand/5 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {uploading ? (
                <><Loader2 className="h-6 w-6 text-brand animate-spin" /><span className="text-[11px] text-[#9fa0b8]">Uploading... {Math.round(uploadProgress)}%</span></>
              ) : (
                <><Upload className="h-6 w-6 text-[#555]" /><span className="text-[11px] text-[#555]">Click to upload thumbnail</span><span className="text-[9px] text-[#3a3a45]">JPG, PNG or WebP · Max 10MB</span></>
              )}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            setUploading(true); setUploadProgress(0); setError("");
            try {
              const res = await uploadFile(file, (p) => setUploadProgress(p));
              setThumbnailUrl(res.url);
            } catch (err: any) { setError(err.message || "Upload failed"); }
            finally { setUploading(false); e.target.value = ""; }
          }} />
        </div>

        <div><label className="text-xs text-[#9fa0b8] mb-2 block font-medium">Campaign Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Summer Promo Clips" className="w-full bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] focus:border-brand outline-none" /></div>

        <div><label className="text-xs text-[#9fa0b8] mb-2 block font-medium">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Brief for creators — what do you want them to create?" className="w-full bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] focus:border-brand outline-none resize-none" /></div>

        <div><label className="text-xs text-[#9fa0b8] mb-2 block font-medium">Campaign Type</label>
          <div className="relative">
            <select value={campaignType} onChange={e => setCampaignType(e.target.value as any)} className="w-full bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-2.5 text-sm text-white focus:border-brand outline-none appearance-none cursor-pointer">
              <option value="ugc">UGC — Original Content</option>
              <option value="clipping">Clipping — Repurpose</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555] pointer-events-none" />
          </div></div>

        <div>
          <label className="text-xs text-[#9fa0b8] mb-2 block font-medium">Budget ($)</label>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
            placeholder="500"
            className={`w-full bg-[#0a0a10] border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] focus:border-brand outline-none ${insufficient ? "border-red-500/60" : "border-[#2a2a35]"}`} />
        </div>

        {insufficient && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-red-400">Insufficient Store Wallet balance</p>
              <p className="text-[11px] text-red-400/70 mt-0.5">
                You have ${walletBalance?.toFixed(2)} but this campaign needs ${budgetNum.toFixed(2)}. The full budget is locked in escrow at creation and refunded on archive.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-[#9fa0b8] mb-2 block font-medium">Payout rate</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-2.5 focus-within:border-brand transition-colors">
              <span className="text-sm text-[#9fa0b8]">$</span>
              <input
                type="number"
                value={rate}
                onChange={e => setRate(e.target.value)}
                placeholder="2.00"
                step="0.01"
                min="0"
                className="w-full bg-transparent text-sm text-white placeholder:text-[#555] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <span className="text-xs text-[#9fa0b8] whitespace-nowrap">per</span>
            <div className="flex items-center gap-2 flex-1 bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-2.5 focus-within:border-brand transition-colors">
              <input
                type="number"
                value={viewBucket}
                onChange={e => setViewBucket(e.target.value)}
                placeholder="1000"
                step="1"
                min="1"
                className="w-full bg-transparent text-sm text-white placeholder:text-[#555] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-[#9fa0b8] whitespace-nowrap">views</span>
            </div>
          </div>
          <p className="text-[10px] text-[#555] mt-1.5">
            e.g. $2 per 500 views means an affiliate earns $4 per 1,000 views.
          </p>
        </div>

        <div><label className="text-xs text-[#9fa0b8] mb-1 block">Platforms</label>
          <div className="flex gap-2 flex-wrap">
            {(["youtube","instagram"] as const).map(p => {
              const locked = LOCKED_PLATFORMS.includes(p);
              return (
                <button key={p} onClick={() => togglePlatform(p)} disabled={locked}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    locked ? "border-[#2a2a35] text-[#555] cursor-not-allowed opacity-50" :
                    platforms.includes(p) ? "border-brand bg-brand/10 text-brand" : "border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a45]"
                  }`}>
                  {PLATFORM_LABELS[p]}{locked && " · Soon"}
                </button>
              );
            })}
          </div></div>

        {/* Collapsible Guidelines */}
        <div className="border border-[#2a2a35] rounded-xl overflow-hidden">
          <button type="button" onClick={() => setShowGuidelines(!showGuidelines)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-[#9fa0b8] hover:bg-[#0a0a10]/50 transition">
            <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Add Guidelines</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full transition ${showGuidelines ? "bg-brand/15 text-brand" : "text-[#555]"}`}>
              {showGuidelines ? "Enabled" : "Optional"}
            </span>
          </button>
          {showGuidelines && (
            <div className="px-4 pb-3">
              <textarea value={guidelines} onChange={e => setGuidelines(e.target.value)} rows={3} placeholder="Content guidelines for creators..."
                className="w-full bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:border-brand outline-none resize-none" />
            </div>
          )}
        </div>

        {/* Collapsible Resource Links */}
        <div className="border border-[#2a2a35] rounded-xl overflow-hidden">
          <button type="button" onClick={() => { setShowResources(!showResources); if (!showResources && resourceLinks.length === 0) setResourceLinks([{ url: "", label: "", type: "drive" }]); }}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-[#9fa0b8] hover:bg-[#0a0a10]/50 transition">
            <span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Add Resource Links</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full transition ${showResources ? "bg-brand/15 text-brand" : "text-[#555]"}`}>
              {showResources ? `${resourceLinks.length} link${resourceLinks.length !== 1 ? "s" : ""}` : "Optional"}
            </span>
          </button>
          {showResources && (
            <div className="px-4 pb-3 space-y-2">
              {resourceLinks.map((link, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input value={link.url} onChange={e => { const u = [...resourceLinks]; u[i].url = e.target.value; setResourceLinks(u); }}
                      placeholder="https://drive.google.com/..." className="w-full bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[#555] focus:border-brand outline-none" />
                    <div className="flex gap-2">
                      <input value={link.label} onChange={e => { const u = [...resourceLinks]; u[i].label = e.target.value; setResourceLinks(u); }}
                        placeholder="Label (e.g. Raw Footage)" className="flex-1 bg-[#0a0a10] border border-[#2a2a35] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[#555] focus:border-brand outline-none" />
                      <div className="relative">
                        <select value={link.type} onChange={e => { const u = [...resourceLinks]; u[i].type = e.target.value; setResourceLinks(u); }}
                          className="bg-[#0a0a10] border border-[#2a2a35] rounded-lg pl-2 pr-6 py-1.5 text-xs text-white focus:border-brand outline-none appearance-none cursor-pointer">
                          <option value="drive">Google Drive</option><option value="dropbox">Dropbox</option>
                          <option value="notion">Notion</option><option value="video">Video</option><option value="other">Other</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#555] pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setResourceLinks(prev => prev.filter((_, j) => j !== i))}
                    className="mt-1 p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {resourceLinks.length < 5 && (
                <button type="button" onClick={() => setResourceLinks(prev => [...prev, { url: "", label: "", type: "drive" }])}
                  className="text-[10px] text-brand hover:text-brand/80 flex items-center gap-0.5 mt-1"><Plus className="h-3 w-3" /> Add Another Link</button>
              )}
            </div>
          )}
        </div>

        {/* Campaign Summary — derived from the inputs above. Helps the founder
            see exactly what they're committing to before clicking create. */}
        <div className="rounded-xl border border-brand/20 bg-brand/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-3.5 w-3.5 text-brand" />
            <p className="text-[10px] text-brand uppercase tracking-wider font-semibold">Campaign Summary</p>
          </div>
          {!summaryReady ? (
            <p className="text-[11px] text-[#9fa0b8]">Fill in the budget and rate above to preview the campaign economics.</p>
          ) : (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9fa0b8]">Total budget</span>
                <span className="font-semibold text-white tabular-nums">{fmtMoney(budgetCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9fa0b8]">Payout rate</span>
                <span className="font-semibold text-white tabular-nums">{fmtMoney(Math.round(rateNum * 100))} per {bucketNum.toLocaleString()} views</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9fa0b8]">Equivalent CPM</span>
                <span className="font-semibold text-white tabular-nums">{fmtMoney(ratePerThousandCents)} / 1,000 views</span>
              </div>
              <div className="h-px bg-brand/15 my-2" />
              <div className="flex items-center justify-between">
                <span className="text-[#9fa0b8]">Estimated reach</span>
                <span className="font-bold text-brand tabular-nums">{estimatedReachViews.toLocaleString()} views</span>
              </div>
              <p className="text-[10px] text-[#555] pt-1">
                Budget covers payouts up to this many views across all affiliates. Once exhausted, the campaign auto-completes.
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#9fa0b8] hover:text-white transition">Cancel</button>
          <button onClick={handleCreate} disabled={saving || insufficient}
            className="px-5 py-2 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create & Lock Budget
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Campaign Card ──
function CampaignCard({ c, onClick }: { c: Campaign; onClick: () => void }) {
  const pct = c.budget > 0 ? Math.round((c.budgetSpent / c.budget) * 100) : 0;
  const statusColors: Record<string, string> = { active: "#34d399", paused: "#fbbf24", draft: "#9fa0b8", completed: "#f87171" };
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl border border-[#2a2a35] bg-[#12121a] p-4 hover:border-[#3a3a45] transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold text-white">{c.title}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: statusColors[c.status], background: `${statusColors[c.status]}15` }}>{c.status}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div><p className="text-[9px] text-[#9fa0b8]">Budget</p><p className="text-sm font-bold text-white">{fmtMoney(c.budget)}</p></div>
        <div><p className="text-[9px] text-[#9fa0b8]">Rate/1K</p><p className="text-sm font-bold text-white">{fmtMoney(c.ratePerThousand)}</p></div>
        <div><p className="text-[9px] text-[#9fa0b8]">Submissions</p><p className="text-sm font-bold text-white">{c.totalSubmissions}</p></div>
        <div><p className="text-[9px] text-[#9fa0b8]">Views</p><p className="text-sm font-bold text-white">{fmtNum(c.totalViews)}</p></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[#0a0a10] overflow-hidden">
          <div className="h-full rounded-full bg-brand/60 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-[#9fa0b8]">{pct}% spent</span>
      </div>
      <div className="flex gap-1 mt-2">
        {c.platforms.map(p => (
          <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-[#0a0a10] text-[#9fa0b8]">{PLATFORM_LABELS[p] || p}</span>
        ))}
      </div>
    </button>
  );
}

// ── Submission Row with Link Preview ──
function SubmissionRow({ s, onAction, ratePerThousand }: {
  s: Submission;
  onAction: () => void;
  // Campaign CPM (cents per 1K views). Used to preview the "Total" basis
  // payout exposure so the founder sees the cost before clicking approve.
  ratePerThousand?: number;
}) {
  const rate = ratePerThousand || 0;
  const isPending = s.status === "pending";

  const [reviewing, setReviewing] = useState<null|"approve"|"reject">(null);
  // Founder's choice for how the affiliate earns on this submission.
  // "net" (default) → only views after approval count. "total" → every view counts.
  const [payoutBasis, setPayoutBasis] = useState<"net" | "total">("net");

  // Live view fetch for pending submissions — `currentViews` is 0 until
  // approval, so we hit the founder-only /live-views endpoint to show the
  // real lifetime count + a "Total" basis payout preview.
  const [liveViews, setLiveViews] = useState<number | null>(null);
  const [loadingLiveViews, setLoadingLiveViews] = useState(false);
  const [liveViewsError, setLiveViewsError] = useState<string>("");

  useEffect(() => {
    if (!isPending) return;
    let cancelled = false;
    setLoadingLiveViews(true);
    setLiveViewsError("");
    fetchLivePreviewViews(s._id)
      .then(r => {
        if (cancelled) return;
        if (r.success) setLiveViews(r.views || 0);
        else setLiveViewsError(r.error || "Could not fetch views");
      })
      .catch((err: any) => { if (!cancelled) setLiveViewsError(err?.message || "Fetch failed"); })
      .finally(() => { if (!cancelled) setLoadingLiveViews(false); });
    return () => { cancelled = true; };
  }, [isPending, s._id]);

  const handleReview = async (action: "approve"|"reject") => {
    setReviewing(action);
    try {
      await reviewSubmission(
        s._id,
        action,
        action === "approve" ? { payoutBasis } : undefined
      );
      onAction();
    } catch {} finally { setReviewing(null); }
  };

  const statusColors: Record<string, string> = { pending: "#fbbf24", approved: "#34d399", rejected: "#f87171", flagged: "#f97316" };
  const user = s.userId as any;
  const paidCents = s.paidOutAmount || 0;
  const pendingCents = Math.max(0, (s.earnedAmount || 0) - paidCents);

  // Total-basis payout preview: floor(lifetimeViews / 1000 * ratePerThousand)
  const totalBasisEarnCents = rate > 0 && liveViews !== null
    ? Math.floor((liveViews / 1000) * rate)
    : 0;

  const meta = s.metadata;
  const hasVideoMeta = !!(meta && (meta.title || meta.thumbnail));

  return (
    <div className="border-b border-[#2a2a35]/40 last:border-0 p-4 hover:bg-[#0a0a10]/50 transition">
      {/* User + Status header */}
      <div className="flex items-center gap-3 mb-3">
        {user?.profilePicture
          ? <img src={user.profilePicture} className="h-7 w-7 rounded-full object-cover" alt="" />
          : <div className="h-7 w-7 rounded-full bg-[#2a2a35] flex items-center justify-center text-[9px] font-bold text-[#9fa0b8]">{(user?.name || "?")[0]}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">{user?.name || user?.email || "User"}</p>
          <p className="text-[10px] text-[#9fa0b8]">{new Date(s.createdAt).toLocaleDateString()}</p>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ color: statusColors[s.status], background: `${statusColors[s.status]}15` }}>{s.status}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0a0a10]" style={{ color: PLATFORM_COLORS[s.platform] }}>{PLATFORM_LABELS[s.platform] || s.platform}</span>
      </div>

      {/* Video card with thumbnail + title (when oEmbed metadata available),
          else fall back to a plain URL row. */}
      {hasVideoMeta ? (
        <a href={s.postUrl} target="_blank" rel="noopener"
          className="flex gap-3 rounded-lg border border-[#2a2a35] bg-[#0a0a10] p-3 mb-3 hover:border-brand/30 transition group">
          <div className="relative w-32 h-20 rounded-md overflow-hidden flex-shrink-0 bg-[#1a1a22]">
            {meta?.thumbnail ? (
              <img src={meta.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Eye className="h-5 w-5 text-[#555]" /></div>
            )}
            <div className="absolute top-1 left-1">
              <span className="text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wider"
                style={{ background: `${PLATFORM_COLORS[s.platform]}cc`, color: "white" }}>
                {PLATFORM_LABELS[s.platform] || s.platform}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-white line-clamp-2 group-hover:text-brand transition leading-snug">
                {meta?.title || "Untitled"}
              </p>
              {meta?.author && <p className="text-[10px] text-[#9fa0b8] mt-0.5">{meta.author}</p>}
            </div>
            <p className="text-[10px] text-[#555] truncate flex items-center gap-1">
              <ExternalLink className="h-2.5 w-2.5" /> {s.postUrl}
            </p>
          </div>
        </a>
      ) : (
        <a href={s.postUrl} target="_blank" rel="noopener"
          className="flex items-center gap-2 rounded-lg border border-[#2a2a35] bg-[#0a0a10] p-3 mb-3 hover:border-brand/30 transition text-xs text-[#9fa0b8] hover:text-brand">
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{s.postUrl}</span>
        </a>
      )}

      {/* Stats + View Source */}
      <div className="flex items-center gap-4 text-xs mb-2 flex-wrap">
        {isPending ? (
          <div>
            <span className="text-[#9fa0b8]">Lifetime views: </span>
            {loadingLiveViews ? (
              <Loader2 className="inline-block h-3 w-3 animate-spin text-[#9fa0b8] align-middle" />
            ) : liveViewsError ? (
              <span className="text-red-400/70 text-[10px]" title={liveViewsError}>—</span>
            ) : (
              <span className="font-bold text-white">{fmtNum(liveViews ?? 0)}</span>
            )}
          </div>
        ) : (
          <>
            <div><span className="text-[#9fa0b8]">Views: </span><span className="font-bold text-white">{fmtNum(s.netViews)}</span></div>
            <div><span className="text-[#9fa0b8]">Earned: </span><span className="font-bold text-[#34d399]">{fmtMoney(s.earnedAmount)}</span></div>
          </>
        )}
        {paidCents > 0 && (
          <div><span className="text-[#9fa0b8]">Paid: </span><span className="font-bold text-[#34d399]">{fmtMoney(paidCents)}</span></div>
        )}
        {pendingCents > 0 && s.status === "approved" && (
          <span title="Will be paid by the next hourly sweep" className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#fbbf24]/10 text-[#fbbf24]">
            {fmtMoney(pendingCents)} pending
          </span>
        )}
        {s.viewSource === "oauth_api" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#34d399]/10 text-[#34d399]">
            ✓ API Verified
          </span>
        )}
        {s.isPaidOut && <span className="text-[10px] text-[#34d399] flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Settled</span>}
      </div>

      {/* Payout basis selector — only shown for pending submissions */}
      {isPending && (
        <div className="mb-3 rounded-lg border border-[#2a2a35] bg-[#0a0a10] p-3">
          <p className="text-[10px] text-[#9fa0b8] uppercase tracking-wider font-medium mb-2">
            Payout basis
          </p>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-white">
              <input
                type="radio"
                name={`payout-basis-${s._id}`}
                value="net"
                checked={payoutBasis === "net"}
                onChange={() => setPayoutBasis("net")}
                disabled={!!reviewing}
                className="mt-0.5 accent-brand"
              />
              <div className="leading-snug flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Net views <span className="text-[9px] text-[#9fa0b8] font-normal">(default)</span></p>
                  <span className="text-[10px] text-[#9fa0b8]">Starts at <span className="text-white font-bold">{fmtMoney(0)}</span></span>
                </div>
                <p className="text-[10px] text-[#9fa0b8]">
                  Affiliate earns only on views accrued <em>after</em> approval.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer text-xs text-white">
              <input
                type="radio"
                name={`payout-basis-${s._id}`}
                value="total"
                checked={payoutBasis === "total"}
                onChange={() => setPayoutBasis("total")}
                disabled={!!reviewing}
                className="mt-0.5 accent-brand"
              />
              <div className="leading-snug flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Total lifetime views</p>
                  {rate > 0 && (
                    loadingLiveViews ? (
                      <span className="text-[10px] text-[#9fa0b8] flex items-center gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> calculating…
                      </span>
                    ) : liveViews !== null ? (
                      <span
                        className="text-[10px] font-bold text-brand"
                        title={`Immediate payout at next sweep: ${fmtNum(liveViews)} views × ${fmtMoney(rate)}/1K`}
                      >
                        ≈ {fmtMoney(totalBasisEarnCents)} immediate
                      </span>
                    ) : null
                  )}
                </div>
                <p className="text-[10px] text-[#9fa0b8]">
                  Affiliate earns on every view, including the pre-approval backlog.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {s.status === "pending" && (
          <>
            <button onClick={() => handleReview("approve")} disabled={!!reviewing}
              className="px-3 py-1.5 rounded-lg bg-[#34d399]/10 text-[#34d399] text-[10px] font-medium hover:bg-[#34d399]/20 transition flex items-center gap-1">
              {reviewing === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Approve
            </button>
            <button onClick={() => handleReview("reject")} disabled={!!reviewing}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition flex items-center gap-1">
              {reviewing === "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Campaign Detail View ──
function CampaignDetail({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [wallet, setWallet] = useState<CampaignWalletInfo | null>(null);
  const [walletTxns, setWalletTxns] = useState<CampaignWalletTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const isClosed = campaign.status === "completed";

  const load = async () => {
    setLoading(true);
    try {
      const [subsRes, statsRes, walletRes] = await Promise.all([
        fetchCampaignSubmissions(campaign._id, filter || undefined),
        fetchCampaignStats(campaign._id),
        // Pull a generous slice of the escrow's audit log so the transactions
        // panel below shows recent activity without needing pagination yet.
        fetchCampaignWallet(campaign._id, { limit: 50 }).catch(() => null),
      ]);
      setSubs(subsRes.submissions);
      setStats(statsRes);
      setWallet(walletRes?.wallet ?? null);
      setWalletTxns(walletRes?.transactions ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [campaign._id, filter]);

  const handleArchive = async () => {
    const remaining = wallet?.balance ?? 0;
    const confirmed = window.confirm(
      remaining > 0
        ? `Archive this campaign? $${remaining.toFixed(2)} of unspent budget will be refunded to your Store Wallet.`
        : "Archive this campaign? It will be marked completed and no further payouts will run."
    );
    if (!confirmed) return;
    setArchiving(true); setArchiveError("");
    try {
      await deleteCampaign(campaign._id);
      onBack();
    } catch (e: any) {
      setArchiveError(e?.message || "Failed to archive");
    } finally {
      setArchiving(false);
    }
  };

  const st = stats?.stats || { total: 0, pending: 0, approved: 0, rejected: 0, totalViews: 0, totalEarned: 0 };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#9fa0b8] hover:text-white transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{campaign.title}</h2>
          <p className="text-xs text-[#9fa0b8]">{campaign.description || "No description"}</p>
        </div>
        {!isClosed && (
          <button onClick={handleArchive} disabled={archiving}
            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-[10px] font-medium hover:bg-red-500/10 transition flex items-center gap-1 disabled:opacity-50">
            {archiving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Archive & Refund
          </button>
        )}
      </div>
      {archiveError && <p className="text-[10px] text-red-400">{archiveError}</p>}

      {/* Campaign Escrow Wallet — mirrors WalletPage balance card */}
      {wallet && wallet.status !== "missing" && (() => {
        const totalLocked = wallet.totalLocked || 0;
        const paidPct = totalLocked > 0 ? Math.min(100, Math.round((wallet.totalPaidOut / totalLocked) * 100)) : 0;
        const refundedPct = totalLocked > 0 ? Math.min(100 - paidPct, Math.round((wallet.totalRefunded / totalLocked) * 100)) : 0;
        return (
          <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 sm:p-2 bg-brand/15 rounded-lg shrink-0 border border-brand/20">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Campaign Escrow</h3>
                  <p className="text-[10px] sm:text-[11px] text-[#9fa0b8]">
                    {wallet.status === "closed"
                      ? "Closed — unspent funds returned to Store Wallet"
                      : "Funds locked from your Store Wallet"}
                  </p>
                </div>
              </div>
              <div
                className={`px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs flex items-center gap-1 shrink-0 ${
                  wallet.status === "active"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-[#9fa0b8]/10 text-[#9fa0b8] border border-[#2a2a35]"
                }`}
              >
                {wallet.status === "active" ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {wallet.status === "active" ? "Active" : "Closed"}
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl sm:text-4xl font-bold text-white tabular-nums">
                ${wallet.balance.toFixed(2)}
              </span>
              <span className="text-xs text-[#9fa0b8]">remaining</span>
            </div>
            <p className="text-[10px] sm:text-xs text-[#9fa0b8] mb-4">
              of ${wallet.totalLocked.toFixed(2)} locked at creation
            </p>

            {/* Progress bar — paid (green) | refunded (muted) | remaining (yellow) */}
            {totalLocked > 0 && (
              <div className="h-1.5 rounded-full bg-[#1a1a22] overflow-hidden mb-4 flex">
                <div className="h-full bg-emerald-400/80" style={{ width: `${paidPct}%` }} />
                <div className="h-full bg-[#9fa0b8]/40" style={{ width: `${refundedPct}%` }} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#2a2a35]">
              <div>
                <p className="text-[9px] sm:text-[10px] text-[#6b6b80] uppercase tracking-wider mb-0.5">Locked</p>
                <p className="text-sm sm:text-base font-semibold text-white tabular-nums">${wallet.totalLocked.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-[#6b6b80] uppercase tracking-wider mb-0.5">Paid out</p>
                <p className="text-sm sm:text-base font-semibold text-emerald-400 tabular-nums">${wallet.totalPaidOut.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-[#6b6b80] uppercase tracking-wider mb-0.5">Refunded</p>
                <p className="text-sm sm:text-base font-semibold text-[#9fa0b8] tabular-nums">${wallet.totalRefunded.toFixed(2)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Campaign Escrow Transactions — audit trail of every debit (payouts to
          affiliates), credit (budget locks), and refund. Sourced from the
          same /wallet endpoint that powers the card above. */}
      {wallet && wallet.status !== "missing" && (
        <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-[#2a2a35] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand/10 rounded-lg border border-brand/20">
                <FileText className="w-3.5 h-3.5 text-brand" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Transactions</h3>
                <p className="text-[10px] text-[#9fa0b8]">Every payout and adjustment for this campaign</p>
              </div>
            </div>
            <span className="text-[10px] text-[#6b6b80]">{walletTxns.length} recent</span>
          </div>
          {walletTxns.length === 0 ? (
            <div className="px-4 sm:px-5 py-8 text-center">
              <p className="text-xs text-[#9fa0b8]">No transactions yet.</p>
              <p className="text-[10px] text-[#6b6b80] mt-1">Payouts to affiliates will appear here once the sweeper processes approved submissions.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a35]/50 max-h-[420px] overflow-y-auto">
              {walletTxns.map(tx => {
                const user = tx.relatedUserId as any;
                const isOut = tx.direction === "out";
                const sign = isOut ? "−" : "+";
                const color = tx.type === "refund" ? "#9fa0b8" : isOut ? "#f87171" : "#34d399";
                return (
                  <div key={tx._id} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[#0a0a10]/40 transition">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                      {tx.type === "refund" ? (
                        <RefreshCw className="h-3.5 w-3.5" style={{ color }} />
                      ) : isOut ? (
                        <Send className="h-3.5 w-3.5" style={{ color }} />
                      ) : (
                        <Plus className="h-3.5 w-3.5" style={{ color }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {tx.type === "refund"
                          ? "Refund to founder"
                          : isOut
                            ? `Payout · ${user?.name || user?.email || "Affiliate"}`
                            : "Budget locked from Store Wallet"}
                      </p>
                      <p className="text-[10px] text-[#6b6b80] truncate mt-0.5">{tx.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold tabular-nums" style={{ color }}>
                        {sign}${tx.amount.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[#6b6b80]">
                        {new Date(tx.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={Eye} label="Total Views" value={fmtNum(st.totalViews)} />
        <Stat icon={Users} label="Submissions" value={String(st.total)} />
        <Stat icon={Clock} label="Pending" value={String(st.pending)} accent="#fbbf24" />
        <Stat icon={DollarSign} label="Total Earned" value={fmtMoney(st.totalEarned)} accent="#34d399" />
      </div>

      {/* Resource Links */}
      {campaign.resourceLinks && campaign.resourceLinks.length > 0 && (
        <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] p-4">
          <h3 className="text-xs font-semibold text-[#9fa0b8] mb-2 flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-brand" /> Resource Links</h3>
          <div className="flex flex-wrap gap-2">
            {campaign.resourceLinks.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2a35] bg-[#0a0a10] hover:border-brand/30 transition text-xs text-white">
                <Link2 className="h-3 w-3 text-brand" />
                {r.label || r.url.substring(0, 30)}
                <ExternalLink className="h-2.5 w-2.5 text-[#555]" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Views Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {["", "pending", "approved", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition ${filter === f ? "bg-brand/15 text-brand ring-1 ring-brand/30" : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"}`}>
              {f || "All"}
            </button>
          ))}
        </div>
        <button onClick={async () => { await refreshCampaignViews(campaign._id); load(); }}
          className="px-3 py-1.5 rounded-lg border border-[#2a2a35] text-[10px] text-[#9fa0b8] hover:text-brand hover:border-brand/30 transition flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Refresh All Views
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>
      ) : subs.length === 0 ? (
        <div className="text-center py-10"><p className="text-sm text-[#9fa0b8]">No submissions yet</p></div>
      ) : (
        <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden">
          {subs.map(s => <SubmissionRow key={s._id} s={s} onAction={load} ratePerThousand={campaign.ratePerThousand} />)}
        </div>
      )}
    </div>
  );
}

// ── Performance Dashboard ──
function PerformanceDashboard({ campaigns }: { campaigns: Campaign[] }) {
  const { brand } = useBrandColors();
  const [allSubs, setAllSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        campaigns.map(c =>
          fetchCampaignSubmissions(c._id, "approved")
            .then(res => res.submissions.map((s: any) => ({ ...s, _campaignTitle: c.title, _campaignRate: c.ratePerThousand })))
            .catch(() => [] as Submission[])
        )
      );
      setAllSubs(results.flat());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (campaigns.length > 0) loadAll(); else setLoading(false); }, [campaigns]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all(campaigns.map(c => refreshCampaignViews(c._id).catch(() => {})));
      await loadAll();
    } catch {}
    finally { setRefreshing(false); }
  };

  // Build chart data from viewSnapshots
  const chartData = useMemo(() => {
    const pointsMap: Record<string, { date: string; views: number }> = {};
    allSubs.forEach(s => {
      const snapshots = (s as any).viewSnapshots || [];
      snapshots.forEach((snap: any) => {
        const d = new Date(snap.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!pointsMap[d]) pointsMap[d] = { date: d, views: 0 };
        pointsMap[d].views += (snap.views || 0);
      });
      // Also add current state as a data point
      if (s.currentViews > 0) {
        const d = new Date(s.lastTrackedAt || s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!pointsMap[d]) pointsMap[d] = { date: d, views: 0 };
        // Don't double-count; only add if snapshots didn't cover this date
      }
    });
    return Object.values(pointsMap).sort((a, b) => {
      const da = new Date(a.date); const db = new Date(b.date);
      return da.getTime() - db.getTime();
    });
  }, [allSubs]);

  const totalViews = allSubs.reduce((a, s) => a + Math.max(0, s.currentViews - (s as any).viewsAtApproval), 0);
  const totalEarned = allSubs.reduce((a, s) => a + (s.earnedAmount || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={Eye} label="Total Net Views" value={fmtNum(totalViews)} />
        <Stat icon={DollarSign} label="Total Earned" value={fmtMoney(totalEarned)} accent="#34d399" />
        <Stat icon={CheckCircle2} label="Approved Videos" value={String(allSubs.length)} accent="#34d399" />
        <Stat icon={Send} label="Submissions" value={String(allSubs.length)} />
      </div>

      {/* View Growth Chart */}
      <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand" /> View Growth Over Time
          </h3>
          <button onClick={handleRefreshAll} disabled={refreshing}
            className="px-3 py-1.5 rounded-lg border border-[#2a2a35] text-[10px] text-[#9fa0b8] hover:text-brand hover:border-brand/30 transition flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing..." : "Refresh All Views"}
          </button>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={brand} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9fa0b8" }} tickLine={false} axisLine={{ stroke: "#2a2a35" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9fa0b8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#12121a", border: "1px solid #2a2a35", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#9fa0b8" }}
                formatter={(value: number) => [fmtNum(value), "Views"]}
              />
              <Area type="monotone" dataKey="views" stroke={brand} strokeWidth={2} fill="url(#viewsGradient)" dot={{ r: 3, fill: brand, stroke: "#0a0a10", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center py-10 text-[#9fa0b8]">
            <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">No view data yet. Click "Refresh All Views" to fetch the latest data from platform APIs.</p>
          </div>
        )}
      </div>

      {/* Approved Content Table */}
      <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2a35]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Eye className="h-4 w-4 text-brand" /> Approved Content Performance
          </h3>
        </div>
        {allSubs.length === 0 ? (
          <div className="text-center py-10"><p className="text-sm text-[#9fa0b8]">No approved submissions yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a35] text-[#9fa0b8]">
                  <th className="text-left px-4 py-2.5 font-medium">Creator</th>
                  <th className="text-left px-4 py-2.5 font-medium">Post</th>
                  <th className="text-left px-4 py-2.5 font-medium">Platform</th>
                  <th className="text-right px-4 py-2.5 font-medium">Total Views</th>
                  <th className="text-right px-4 py-2.5 font-medium">Net Views</th>
                  <th className="text-right px-4 py-2.5 font-medium">Earned</th>
                  <th className="text-left px-4 py-2.5 font-medium">Campaign</th>
                </tr>
              </thead>
              <tbody>
                {allSubs.map(s => {
                  const user = s.userId as any;
                  const net = Math.max(0, s.currentViews - (s as any).viewsAtApproval);
                  return (
                    <tr key={s._id} className="border-b border-[#2a2a35]/30 hover:bg-[#0a0a10]/50 transition">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {user?.profilePicture
                            ? <img src={user.profilePicture} className="h-5 w-5 rounded-full object-cover" alt="" />
                            : <div className="h-5 w-5 rounded-full bg-[#2a2a35] flex items-center justify-center text-[8px] font-bold text-[#9fa0b8]">{(user?.name || "?")[0]}</div>}
                          <span className="text-white font-medium truncate max-w-[100px]">{user?.name || "User"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <a href={s.postUrl} target="_blank" rel="noopener" className="text-[#9fa0b8] hover:text-brand truncate block max-w-[150px] flex items-center gap-1">
                          <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />{s.postUrl.substring(0, 35)}...
                        </a>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: PLATFORM_COLORS[s.platform], background: `${PLATFORM_COLORS[s.platform]}15` }}>
                          {PLATFORM_LABELS[s.platform]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-bold">{fmtNum(s.currentViews)}</td>
                      <td className="px-4 py-2.5 text-right text-white font-bold">{fmtNum(net)}</td>
                      <td className="px-4 py-2.5 text-right text-[#34d399] font-bold">{fmtMoney(s.earnedAmount)}</td>
                      <td className="px-4 py-2.5 text-[#9fa0b8] truncate max-w-[120px]">{(s as any)._campaignTitle || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
const FOUNDER_TABS = [
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "performance", label: "Performance", icon: BarChart3 },
] as const;
type FounderTab = (typeof FOUNDER_TABS)[number]["id"];

export function ContentRewardsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pendingSubs, setPendingSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [founderTab, setFounderTab] = useState<FounderTab>("campaigns");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetchCampaigns();
      setCampaigns(res.campaigns);
      // Load pending submissions across all campaigns in parallel
      const pendingResults = await Promise.all(
        res.campaigns.map(c =>
          fetchCampaignSubmissions(c._id, "pending")
            .then(r => r.submissions)
            .catch(() => [] as Submission[])
        )
      );
      setPendingSubs(pendingResults.flat());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (selected) return <div className="flex flex-col bg-[#0a0a10] min-h-screen p-5"><CampaignDetail campaign={selected} onBack={() => { setSelected(null); load(); }} /></div>;

  // USD-only for V1: sum across all campaigns in a single bucket.
  const totalBudgetCents = campaigns.reduce((a, c) => a + (c.budget || 0), 0);
  const totalSpentCents = campaigns.reduce((a, c) => a + (c.budgetSpent || 0), 0);
  const totalViews = campaigns.reduce((a, c) => a + c.totalViews, 0);
  const totalSubs = campaigns.reduce((a, c) => a + c.totalSubmissions, 0);

  return (
    <div className="flex flex-col bg-[#0a0a10] min-h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#12121a] border border-[#2a2a35]"><Gift className="h-4 w-4 text-brand" /></div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Content Rewards</h1>
              <p className="text-[11px] text-[#9fa0b8]">Create campaigns & pay affiliates for posting your content</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Stat icon={DollarSign} label="Total Budget" value={fmtMoney(totalBudgetCents)} />
          <Stat icon={TrendingUp} label="Spent" value={fmtMoney(totalSpentCents)} accent="#f87171" />
          <Stat icon={Eye} label="Total Views" value={fmtNum(totalViews)} />
          <Stat icon={Users} label="Submissions" value={String(totalSubs)} />
        </div>

        {/* Tabs */}
        <div className="flex gap-5 border-b border-[#2a2a35]">
          {FOUNDER_TABS.map(t => (
            <button key={t.id} onClick={() => setFounderTab(t.id)}
              className={`flex items-center gap-1.5 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                founderTab === t.id ? "text-brand border-brand" : "text-[#9fa0b8] border-transparent hover:text-white"
              }`}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 gap-2">
            <AlertCircle className="h-6 w-6 text-red-400" /><p className="text-sm text-red-400">{error}</p>
          </div>
        ) : founderTab === "performance" ? (
          <PerformanceDashboard campaigns={campaigns} />
        ) : (
          <>
            {/* Pending Review Section */}
            {pendingSubs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-[#fbbf24]" />
                  <h2 className="text-sm font-bold text-white">Pending Review</h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#fbbf24]/15 text-[#fbbf24] text-[10px] font-bold">{pendingSubs.length}</span>
                </div>
                <div className="rounded-xl border border-[#fbbf24]/20 bg-[#12121a] overflow-hidden">
                  {pendingSubs.map(s => {
                    // Look up the parent campaign so we can pass its ratePerThousand
                    // through to the row's "Total" basis payout preview.
                    const sid = typeof s.campaignId === "string" ? s.campaignId : s.campaignId?._id;
                    const parent = campaigns.find(c => c._id === sid);
                    return (
                      <SubmissionRow
                        key={s._id}
                        s={s}
                        onAction={load}
                        ratePerThousand={parent?.ratePerThousand}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Campaign list */}
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3 text-center">
                <div className="p-4 rounded-xl bg-[#12121a] border border-[#2a2a35]"><Megaphone className="h-8 w-8 text-[#9fa0b8]" /></div>
                <h3 className="text-lg font-semibold text-white">No Campaigns Yet</h3>
                <p className="text-sm text-[#9fa0b8] max-w-xs">Create your first campaign to start paying affiliates for posting your content on social media.</p>
                <button onClick={() => setShowCreate(true)} className="mt-2 px-5 py-2 rounded-lg bg-brand text-brand-foreground text-xs font-bold">Create Campaign</button>
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-brand" /> Campaigns
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {campaigns.map(c => <CampaignCard key={c._id} c={c} onClick={() => setSelected(c)} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
