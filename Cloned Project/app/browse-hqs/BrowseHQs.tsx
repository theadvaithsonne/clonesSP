"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { slugify } from "@/lib/utils";

interface Organization {
  _id: string;
  name: string;
  slug?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  icon?: string;
  requestStatus: "pending" | "approved" | "rejected" | null;
}

export default function BrowseHQs() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const guestUserId = typeof window !== "undefined" ? localStorage.getItem("guest_user_id") : null;
  const guestEmail = typeof window !== "undefined" ? localStorage.getItem("guest_email") : null;

  useEffect(() => {
    // Check if user is a guest
    if (!guestUserId) {
      toast.error("Please login as guest first");
      router.push("/guest-login");
      return;
    }

    fetchOrganizations();
  }, [guestUserId, router]);

  async function fetchOrganizations() {
    try {
      const response = await api<{
        ok: boolean;
        organizations: Organization[];
      }>(`/guest-auth/available-hqs?userId=${guestUserId}`, {
        method: "GET",
      });

      if (response.ok) {
        setOrgs(response.organizations);
      }
    } catch (err) {
      console.error("Error fetching organizations:", err);
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }

  function navigateToOrg(org: Organization) {
    const orgSlug = org.slug || slugify(org.name);
    router.push(`/guest/${orgSlug}`);
  }

  function getStatusBadge(status: Organization["requestStatus"]) {
    if (!status) return null;

    const styles = {
      pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      approved: "bg-green-500/10 text-green-400 border-green-500/30",
      rejected: "bg-red-500/10 text-red-400 border-red-500/30",
    };

    const icons = {
      pending: <Clock className="h-3 w-3" />,
      approved: <CheckCircle2 className="h-3 w-3" />,
      rejected: <XCircle className="h-3 w-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border ${styles[status]}`}
      >
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0C0C0E]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-gray-500 text-sm">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0C0E] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-white mb-2">
                Discover HQs
              </h1>
              <p className="text-gray-500 text-sm">
                Find your perfect workspace and connect with amazing teams
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/my-requests">
                <Button
                  variant="ghost"
                  className="text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  My Requests
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  localStorage.removeItem("guest_user_id");
                  localStorage.removeItem("guest_email");
                  router.push("/guest-login");
                }}
                className="text-gray-400 hover:text-white hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* User info badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-2" />
            <span className="text-xs text-gray-500">
              Guest: <span className="text-gray-400">{guestEmail}</span>
            </span>
          </div>
        </div>

        {/* Organizations Grid */}
        {orgs.length === 0 ? (
          <Card className="p-12 text-center bg-white/5 border-white/10">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-base">No organizations available</p>
            <p className="text-gray-600 text-sm mt-1">Check back later for new opportunities</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orgs.map((org) => (
              <Card
                key={org._id}
                onClick={() => navigateToOrg(org)}
                className="group relative bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-200 cursor-pointer"
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    {org.icon ? (
                      <img
                        src={org.icon}
                        alt={org.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-white font-medium truncate">
                        {org.name}
                      </CardTitle>
                      {org.requestStatus && (
                        <div className="mt-2">
                          {getStatusBadge(org.requestStatus)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {(org.city || org.state || org.country) && (
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">
                        {[org.city, org.state, org.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}

                  {org.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {org.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                      View details
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
