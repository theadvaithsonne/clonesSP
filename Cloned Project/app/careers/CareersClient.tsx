"use client";

import { useState, useMemo } from "react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { useVacancies } from "./hooks/useVacancies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase,
  Plus,
  Search,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import VacancyCard from "./components/VacancyCard";
import CreateVacancyDialog from "./components/CreateVacancyDialog";
import ApplicationsTab from "./components/ApplicationsTab";
import type { Vacancy } from "./types";

export default function CareersClient() {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const {
    vacancies,
    loading,
    createVacancy,
    updateVacancy,
    deleteVacancy,
    refetch,
  } = useVacancies();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVacancy, setEditVacancy] = useState<Vacancy | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");

  function handleEdit(vacancy: Vacancy) {
    setEditVacancy(vacancy);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    try {
      await deleteVacancy(id);
      toast.success("Vacancy deleted");
    } catch {
      toast.error("Failed to delete vacancy");
    }
  }

  function handleCreateNew() {
    setEditVacancy(null);
    setDialogOpen(true);
  }

  const displayVacancies = useMemo(() => {
    let filtered = amIFounder
      ? vacancies
      : vacancies.filter((v) => v.status === "open");

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.department.toLowerCase().includes(q) ||
          v.location.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [vacancies, amIFounder, search]);

  if (loading || founderLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-12">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          {/* Toolbar skeleton */}
          <Skeleton className="h-10 w-full mb-6" />
          {/* List items skeleton */}
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const toolbar = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, department, or location..."
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md p-1">
        <button
          onClick={() => setViewMode("list")}
          className={`p-1.5 rounded transition-colors ${
            viewMode === "list"
              ? "bg-white/10 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
          title="List view"
        >
          <LayoutList className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={`p-1.5 rounded transition-colors ${
            viewMode === "grid"
              ? "bg-white/10 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
          title="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const vacancyContent = (
    <>
      {toolbar}
      {displayVacancies.length === 0 ? (
        <Card className="p-12 text-center bg-white/5 border-white/10">
          <Briefcase className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-base">
            {search ? "No matching positions" : "No open positions"}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {search
              ? "Try a different search term"
              : "Check back later for new opportunities"}
          </p>
        </Card>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-3">
          {displayVacancies.map((vacancy) => (
            <VacancyCard
              key={vacancy._id}
              vacancy={vacancy}
              isFounder={amIFounder}
              viewMode="list"
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayVacancies.map((vacancy) => (
            <VacancyCard
              key={vacancy._id}
              vacancy={vacancy}
              isFounder={amIFounder}
              viewMode="grid"
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#0C0C0E] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-4">
            <div className="flex items-center gap-4">
              <img src="/logo.svg" alt="Garage" className="h-10" />
              <div className="border-l border-white/20 pl-4">
                <h1 className="text-3xl font-semibold text-white mb-1">
                  Careers
                </h1>
                <p className="text-gray-500 text-sm">
                  Explore open positions and join our team
                </p>
              </div>
            </div>
            {amIFounder && (
              <Button
                onClick={handleCreateNew}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Vacancy
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {amIFounder ? (
          <Tabs defaultValue="vacancies">
            <TabsList className="bg-white/5 border border-white/10 mb-8">
              <TabsTrigger value="vacancies">Vacancies</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
            </TabsList>
            <TabsContent value="vacancies">{vacancyContent}</TabsContent>
            <TabsContent value="applications">
              <ApplicationsTab />
            </TabsContent>
          </Tabs>
        ) : (
          vacancyContent
        )}
      </div>

      {/* Create/Edit Dialog */}
      <CreateVacancyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refetch}
        editVacancy={editVacancy}
        createVacancy={createVacancy}
        updateVacancy={updateVacancy}
      />
    </div>
  );
}
