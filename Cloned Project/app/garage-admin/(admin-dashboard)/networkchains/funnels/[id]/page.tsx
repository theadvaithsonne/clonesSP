"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FunnelStudio, type FunnelStudioHandle } from "@/components/funnel-studio/funnel-studio";
import { FunnelCtaPicker } from "@/components/funnel-studio/funnel-cta-picker";
import { fetchLibraryAffiliate } from "@/lib/affiliate/library-affiliate";
import { adminFunnelsApi, type FunnelCta } from "@/lib/nc-admin-api/admin-funnels";
import {
  useAdminFunnel,
  useSaveFunnel,
  useUpdateFunnelMeta,
  useSetDefaultFunnel,
  useDeleteFunnel,
} from "@/lib/hooks/use-admin-funnels";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import type { FunnelLink } from "@/lib/api/funnels";

/** Map the funnel's stored CTA (product-link shape) → the studio preview link. */
function ctaToEndLink(cta: FunnelCta | null): FunnelLink | null {
  if (!cta || !cta.itemType || !cta.itemId || !cta.name) return null;
  return {
    itemType: cta.itemType,
    itemId: cta.itemId,
    name: cta.name,
    category: cta.category,
    orgSlug: cta.orgSlug,
    image: cta.image,
    price: cta.price,
    currency: cta.currency,
  };
}

export default function FunnelEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: funnel, isLoading } = useAdminFunnel(id);
  const saveTree = useSaveFunnel(id);
  const saveMeta = useUpdateFunnelMeta(id);
  // Every mutation on this screen — name, CTA, default, tree save, delete —
  // needs "Full" on NC · Funnels. With a view-only grant the editor stays
  // reachable (the sidebar granted the page) but becomes a reader: the name
  // and CTA lock, Save/Delete/Set-default disappear, and a Read-only badge
  // says why. FunnelStudio is a shared component and is left untouched;
  // without a Save button nothing it does can be persisted.
  const { ready: accessReady, canManage } = useAdminAccess();
  const canManageFunnels = accessReady && canManage("nc_funnels");
  const setDefault = useSetDefaultFunnel();
  const del = useDeleteFunnel();

  const [name, setName] = useState("");
  const [cta, setCta] = useState<FunnelCta | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const studioRef = useRef<FunnelStudioHandle>(null);

  // The library's affiliate identity, resolved from the super-admin role.
  // undefined = still loading, null = unresolved (author with NO ref). Never
  // the editing admin: that is exactly the traffic-diverting bug this avoids.
  const [libraryAffiliateId, setLibraryAffiliateId] = useState<
    string | null | undefined
  >(undefined);
  useEffect(() => {
    let cancelled = false;
    fetchLibraryAffiliate()
      .then((r) => {
        if (!cancelled) setLibraryAffiliateId(r.affiliateId);
      })
      .catch(() => {
        if (!cancelled) setLibraryAffiliateId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed local name/cta from the server value once loaded (guarded — no effect).
  if (funnel && loadedId !== funnel.id) {
    setName(funnel.name);
    setCta(funnel.cta);
    setLoadedId(funnel.id);
  }

  if (isLoading || (!funnel && loadedId === null)) {
    return (
      <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col items-center justify-center bg-[#080808] text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading funnel…
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col items-center justify-center gap-4 bg-[#080808] text-sm text-zinc-500">
        <p>Funnel not found.</p>
        <Link href="/garage-admin/networkchains/funnels">
          <Button variant="outline" className="rounded-xl border-white/[0.08]">
            Back to funnels
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col bg-[#080808] text-white">
      {/* Single toolbar: identity (back, name, default, CTA) on the left,
          the save affordance for the tree editor on the right — same row
          as the name it saves. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.06] px-6 py-3">
        <Link href="/garage-admin/networkchains/funnels">
          <Button
            variant="ghost"
            size="icon"
            title="Back to funnels"
            className="h-9 w-9 rounded-xl text-zinc-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (next && next !== funnel.name) saveMeta.mutate({ name: next });
          }}
          readOnly={!canManageFunnels}
          placeholder="Funnel name"
          aria-label="Funnel name"
          className="h-9 max-w-[240px] rounded-xl font-medium text-white"
        />

        {funnel.isDefault ? (
          <Badge className="gap-1 border-0 bg-[#FFC200]/15 text-[10px] text-[#FFC200]">
            <Star className="h-3 w-3 fill-[#FFC200]" /> Default
          </Badge>
        ) : canManageFunnels ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDefault.mutate(id)}
            disabled={setDefault.isPending}
            className="h-9 gap-1.5 rounded-xl text-xs text-zinc-400 hover:text-white"
          >
            <Star className="h-3.5 w-3.5" /> Set as default
          </Button>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">CTA:</span>
          <div className={canManageFunnels ? undefined : "pointer-events-none opacity-60"}>
          <FunnelCtaPicker
            // Authored under the super admin, never under whichever admin is
            // editing. `null` while unresolved is deliberate — an absent ref
            // beats the wrong one.
            affiliateIdOverride={libraryAffiliateId ?? null}
            value={cta}
            onChange={(next) => {
              setCta(next);
              saveMeta.mutate({ cta: next });
            }}
          />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {dirty && (
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FFC200]" />
              Unsaved changes
            </span>
          )}
          {accessReady && !canManageFunnels && (
            <Badge className="border-0 bg-white/[0.06] text-[10px] text-zinc-400">
              Read-only
            </Badge>
          )}
          {canManageFunnels && (
          <Button
            onClick={() => studioRef.current?.save()}
            disabled={saveTree.isPending || !dirty}
            className="h-9 gap-2 rounded-xl bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-black hover:brightness-105"
          >
            {saveTree.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
          )}
          {canManageFunnels && !funnel.isDefault && (
            <Button
              variant="ghost"
              size="icon"
              title="Delete funnel"
              onClick={() => setConfirmDelete(true)}
              className="h-9 w-9 rounded-xl text-zinc-500 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tree editor. Saving the tree is independent of name/CTA above;
          the toolbar's Save button drives it via the imperative handle. */}
      <div className="min-h-0 flex-1">
        <FunnelStudio
          ref={studioRef}
          template={{ rootQuestion: funnel.rootQuestion, options: funnel.options }}
          onSave={(tpl) =>
            saveTree.mutate({ rootQuestion: tpl.rootQuestion, options: tpl.options })
          }
          uploadFn={adminFunnelsApi.uploadFile}
          onDirtyChange={setDirty}
          endLink={ctaToEndLink(cta)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this funnel?"
        description={
          <>
            <span className="font-medium text-zinc-200">{funnel.name}</span> will be
            removed from the Garage Funnels library. This can&apos;t be undone.
          </>
        }
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(id, { onSuccess: () => router.push("/garage-admin/networkchains/funnels") })
        }
      />
    </div>
  );
}
