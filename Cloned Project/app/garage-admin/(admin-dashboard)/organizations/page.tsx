"use client";

import { useState, useEffect } from "react";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Users,
  Calendar,
  ExternalLink,
  Eye,
  Globe,
  Video,
  Image,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getOrgDeletePreview,
  deleteAdminOrganization,
  type OrgDeletePreview,
} from "@/lib/admin-api/danger-zone";
import DangerConfirmDialog from "@/components/garage-admin/DangerConfirmDialog";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { ORG_KYC_STATUS_LABEL, type OrgKycStatus } from "@/lib/org-kyc";

const KYC_BADGE_CLASS: Record<OrgKycStatus, string> = {
  not_requested: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  submitted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  verified: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

interface Organization {
  id: string;
  name: string;
  size?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  parent: boolean;
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  icon?: string;
  coverPhoto?: string;
  promoVideoLink?: string;
  earngpt_data?: any;
  // Founders shown in the Founder column. Enriched server-side by
  // aggregating User.organizations[].role === "founder" per orgId.
  founders?: Array<{
    id: string;
    name: string;
    email: string;
    profilePicture: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
  /** Mirror of the OrgKyc record; absent on offices predating KYC. */
  kycStatus?: OrgKycStatus;
  kycVerifiedAt?: string | null;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Deleting an organization is danger-zone, super-admin only. A role with
  // "organizations: view" can open this page, so hide the button rather
  // than let them click into a 403.
  const { isSuperAdmin } = useAdminAccess();

  // Shared header search — filters this tab server-side (debounced).
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const loadOrganizations = async () => {
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const response = await garageAdminApi<{ data: Organization[] }>(
        `/garage-admin/organizations${qs.toString() ? `?${qs.toString()}` : ""}`,
        {
          method: "GET",
        }
      );
      setOrganizations(response?.data || []);
    } catch (error) {
      console.error("Error loading organizations:", error);
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (orgId: string) => {
    router.push(`/garage-admin/organizations/${orgId}`);
  };

  // ── Delete a company ────────────────────────────────────────────────────
  // Permanent, and nothing is cascaded. The preview loads first so the
  // confirmation can show how much data will be left pointing at a company
  // that no longer exists.
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deletePreview, setDeletePreview] = useState<OrgDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openDelete = async (org: Organization) => {
    setDeleteTarget(org);
    setDeletePreview(null);
    setDeleteError(null);
    setPreviewLoading(true);
    try {
      setDeletePreview(await getOrgDeletePreview(org.id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await deleteAdminOrganization(deleteTarget.id, deleteTarget.name);
      toast.success(
        res.membersDetached > 0
          ? `Deleted ${deleteTarget.name} — ${res.membersDetached} member${
              res.membersDetached === 1 ? "" : "s"
            } detached`
          : `Deleted ${deleteTarget.name}`
      );
      setDeleteTarget(null);
      loadOrganizations();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Organizations...</p>
        </div>
      </div>
    );
  }

  const totalOrgs = organizations?.length || 0;
  const parentOrgs = organizations?.filter((org) => org.parent).length || 0;
  const regularOrgs = organizations?.filter((org) => !org.parent).length || 0;
  const orgsWithEarnGPT =
    organizations?.filter((org) => org.earngpt_data).length || 0;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Total Organizations
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalOrgs}</div>
            <p className="text-xs text-gray-400">All organizations</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Parent Organizations
            </CardTitle>
            <Building2 className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{parentOrgs}</div>
            <p className="text-xs text-gray-400">Garage HQ</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Regular Organizations
            </CardTitle>
            <Users className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{regularOrgs}</div>
            <p className="text-xs text-gray-400">Member organizations</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              EarnGPT Integrated
            </CardTitle>
            <Globe className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {orgsWithEarnGPT}
            </div>
            <p className="text-xs text-gray-400">With store integration</p>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            All Organizations
          </CardTitle>
          <CardDescription className="text-gray-400">
            View and manage all organizations in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Organization</TableHead>
                <TableHead className="text-gray-300">Founder</TableHead>
                <TableHead className="text-gray-300">Location</TableHead>
                <TableHead className="text-gray-300">Type</TableHead>
                <TableHead className="text-gray-300">KYC</TableHead>
                <TableHead className="text-gray-300">Size</TableHead>
                <TableHead className="text-gray-300">Created</TableHead>
                <TableHead className="text-gray-300">Features</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations?.map((org) => (
                <TableRow key={org.id} className="border-gray-800">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {org.icon ? (
                        <img
                          src={org.icon}
                          alt={org.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-white">{org.name}</div>
                        {org.description && (
                          <div className="text-sm text-gray-400 truncate max-w-[200px]">
                            {org.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Founder column — up to 3 shown, "+N more" beyond that.
                        Data comes from BE aggregation of
                        User.organizations[].role === "founder" per orgId. */}
                    {org.founders && org.founders.length > 0 ? (
                      <div className="space-y-1.5">
                        {org.founders.slice(0, 3).map((f) => (
                          <div key={f.id} className="flex items-center gap-2 min-w-0">
                            {f.profilePicture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={f.profilePicture}
                                alt={f.name || f.email}
                                className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-[#2a2a35]"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 flex items-center justify-center shrink-0 text-[10px] font-semibold text-white ring-1 ring-[#2a2a35]">
                                {(f.name || f.email).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm text-white truncate max-w-[180px]">
                                {f.name || "(no name)"}
                              </div>
                              <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                                {f.email}
                              </div>
                            </div>
                          </div>
                        ))}
                        {org.founders.length > 3 && (
                          <div className="text-[11px] text-gray-500 pl-8">
                            +{org.founders.length - 3} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {org.city && org.state && org.country ? (
                        <>
                          <div className="text-white">
                            {org.city}, {org.state}
                          </div>
                          <div className="text-gray-400">{org.country}</div>
                        </>
                      ) : org.location ? (
                        <div className="text-white">{org.location}</div>
                      ) : (
                        <span className="text-gray-400">No location</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={org.parent ? "default" : "secondary"}
                      className={
                        org.parent
                          ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      }
                    >
                      {org.parent ? "Parent" : "Regular"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {/* Mirrored from the OrgKyc record. "Under review" is the
                        one that wants an admin — open the org to act on it. */}
                    {!org.kycStatus || org.kycStatus === "not_requested" ? (
                      <span className="text-gray-500 text-sm">—</span>
                    ) : (
                      <Badge className={KYC_BADGE_CLASS[org.kycStatus]}>
                        {ORG_KYC_STATUS_LABEL[org.kycStatus]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {org.size || "Not specified"}
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="text-sm">
                      <div className="text-white">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-gray-400">
                        {new Date(org.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {org.icon && (
                        <div className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center">
                          <Image className="w-3 h-3 text-green-400" />
                        </div>
                      )}
                      {org.coverPhoto && (
                        <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
                          <Image className="w-3 h-3 text-blue-400" />
                        </div>
                      )}
                      {org.promoVideoLink && (
                        <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
                          <Video className="w-3 h-3 text-purple-400" />
                        </div>
                      )}
                      {org.earngpt_data && (
                        <div className="w-6 h-6 bg-orange-500/20 rounded flex items-center justify-center">
                          <Globe className="w-3 h-3 text-orange-400" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(org.id)}
                        className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDelete(org)}
                          className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                          title="Delete this company permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {organizations?.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No Organizations Found
              </h3>
              <p className="text-gray-400">
                There are no organizations in the system yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <DangerConfirmDialog
        open={!!deleteTarget}
        title="Delete company"
        subject={deleteTarget?.name || ""}
        confirmValue={deleteTarget?.name || ""}
        confirmLabel="Type the company name to confirm"
        dependents={deletePreview?.dependents || []}
        totalDependents={deletePreview?.totalDependents || 0}
        countsCapped={deletePreview?.countsCapped || false}
        extraNote={
          deletePreview && deletePreview.members > 0
            ? `${deletePreview.members} member${
                deletePreview.members === 1 ? "" : "s"
              } will be removed from this workspace.`
            : null
        }
        loading={previewLoading}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}
