"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useApplications } from "../hooks/useApplications";
import { useVacancies } from "../hooks/useVacancies";
import ApplicationStatusBadge from "./ApplicationStatusBadge";
import type { Application } from "../types";

export default function ApplicationsTab() {
  const { applications, loading, fetchApplications, updateApplicationStatus } =
    useApplications();
  const { vacancies } = useVacancies();
  const [vacancyFilter, setVacancyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (vacancyFilter !== "all") filters.vacancyId = vacancyFilter;
    if (statusFilter !== "all") filters.status = statusFilter;
    fetchApplications(Object.keys(filters).length > 0 ? filters : undefined);
  }, [vacancyFilter, statusFilter, fetchApplications]);

  async function handleStatusChange(id: string, status: Application["status"]) {
    try {
      await updateApplicationStatus(id, status);
      toast.success("Application status updated");
    } catch {
      toast.error("Failed to update status");
    }
  }

  const filteredApplications = searchQuery.trim()
    ? applications.filter((app) => {
        const q = searchQuery.toLowerCase();
        return (
          app.applicantName.toLowerCase().includes(q) ||
          app.applicantEmail.toLowerCase().includes(q) ||
          app.vacancyTitle.toLowerCase().includes(q)
        );
      })
    : applications;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: Search + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or vacancy..."
            className="pl-10 bg-white/5 border-white/10"
          />
        </div>
        <div className="shrink-0">
          <Select value={vacancyFilter} onValueChange={setVacancyFilter}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue placeholder="All Vacancies" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a22] border-white/10">
              <SelectItem value="all">All Vacancies</SelectItem>
              {vacancies.map((v) => (
                <SelectItem key={v._id} value={v._id}>
                  {v.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a22] border-white/10">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="shortlisted">Shortlisted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="hired">Hired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No applications found</p>
          <p className="text-gray-600 text-sm mt-1">
            {searchQuery
              ? "Try a different search term"
              : "Applications will appear here when candidates apply"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left p-3 text-gray-400 font-medium">
                  Applicant
                </th>
                <th className="text-left p-3 text-gray-400 font-medium">
                  Email
                </th>
                <th className="text-left p-3 text-gray-400 font-medium">
                  Phone
                </th>
                <th className="text-left p-3 text-gray-400 font-medium">
                  Vacancy
                </th>
                <th className="text-left p-3 text-gray-400 font-medium">
                  Status
                </th>
                <th className="text-left p-3 text-gray-400 font-medium">
                  Date
                </th>
                <th className="text-left p-3 text-gray-400 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((app) => (
                <tr
                  key={app._id}
                  className="border-b border-white/5 hover:bg-white/[0.03]"
                >
                  <td className="p-3 text-white">{app.applicantName}</td>
                  <td className="p-3 text-gray-400">{app.applicantEmail}</td>
                  <td className="p-3 text-gray-400">
                    {app.applicantPhone || "—"}
                  </td>
                  <td className="p-3 text-gray-400">{app.vacancyTitle}</td>
                  <td className="p-3">
                    <ApplicationStatusBadge status={app.status} />
                  </td>
                  <td className="p-3 text-gray-500">
                    {format(new Date(app.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={app.status}
                        onValueChange={(v) =>
                          handleStatusChange(
                            app._id,
                            v as Application["status"]
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-[130px] bg-white/5 border-white/10 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a22] border-white/10">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="shortlisted">
                            Shortlisted
                          </SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="hired">Hired</SelectItem>
                        </SelectContent>
                      </Select>
                      {app.resumeUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() =>
                            window.open(app.resumeUrl, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
