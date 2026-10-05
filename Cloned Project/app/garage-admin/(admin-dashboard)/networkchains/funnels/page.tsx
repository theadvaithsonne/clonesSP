"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Workflow,
  Plus,
  Eye,
  Star,
  Tag,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useAdminFunnels,
  useCreateFunnel,
  useSetDefaultFunnel,
  useDeleteFunnel,
} from "@/lib/hooks/use-admin-funnels";
import { formatRelativeTime } from "@/lib/utils/format";
import type { FunnelListItem } from "@/lib/nc-admin-api/admin-funnels";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

export default function FunnelsListPage() {
  const router = useRouter();
  const { data: funnels, isLoading } = useAdminFunnels();
  const create = useCreateFunnel();
  const setDefault = useSetDefaultFunnel();
  const del = useDeleteFunnel();
  // Creating, deleting and re-pointing the default are writes; contacts-backend
  // requires "Full" on NC · Funnels for each. A view-only grant gets the
  // library as a read-only list, with Edit reading "View" so it isn't a
  // dead end.
  const { ready: accessReady, canManage } = useAdminAccess();
  const canManageFunnels = accessReady && canManage("nc_funnels");
  const [toDelete, setToDelete] = useState<FunnelListItem | null>(null);

  const onCreate = () =>
    create.mutate(undefined, {
      onSuccess: (res) =>
        router.push(`/garage-admin/networkchains/funnels/${res.funnel.id}`),
    });

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-[#080808] px-8 pb-8 pt-7 text-white">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-black">
              <Workflow className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-white">Funnels</h1>
              <p className="text-xs text-zinc-500">
                The library every affiliate picks from in Garage Funnels
              </p>
            </div>
          </div>
          {canManageFunnels && (
          <Button
            onClick={onCreate}
            disabled={create.isPending}
            className="gap-2 rounded-xl bg-[#FFC200] text-black hover:bg-[#FFB000]"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New funnel
          </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : !funnels || funnels.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] p-10 text-center text-sm text-zinc-500">
            No funnels yet. Create your first one.
          </div>
        ) : (
          <div className="space-y-3">
            {funnels.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">{f.name}</span>
                    {f.isDefault && (
                      <Badge className="gap-1 border-0 bg-[#FFC200]/15 text-[10px] text-[#FFC200]">
                        <Star className="h-3 w-3 fill-[#FFC200]" /> Default
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {f.cta?.name ? (
                        <span className="text-zinc-400">{f.cta.name}</span>
                      ) : (
                        <span>No CTA</span>
                      )}
                    </span>
                    {f.updatedAt && <span>· updated {formatRelativeTime(f.updatedAt)}</span>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {canManageFunnels && !f.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefault.mutate(f.id)}
                      disabled={setDefault.isPending}
                      className="h-8 gap-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                    >
                      <Star className="h-3.5 w-3.5" /> Set default
                    </Button>
                  )}
                  <Link href={`/garage-admin/networkchains/funnels/${f.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg border-white/[0.08] text-xs text-zinc-200"
                    >
                      {canManageFunnels ? (
                        <>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> View
                        </>
                      )}
                    </Button>
                  </Link>
                  {canManageFunnels && !f.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete funnel"
                      onClick={() => setToDelete(f)}
                      className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          open={!!toDelete}
          onOpenChange={(v) => !v && setToDelete(null)}
          title="Delete this funnel?"
          description={
            toDelete ? (
              <>
                <span className="font-medium text-zinc-200">{toDelete.name}</span> will be
                removed from the Garage Funnels library. This can&apos;t be undone.
              </>
            ) : null
          }
          loading={del.isPending}
          onConfirm={() =>
            toDelete &&
            del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
          }
        />
      </div>
    </div>
  );
}
