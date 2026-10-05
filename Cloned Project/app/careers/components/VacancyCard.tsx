"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Briefcase,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { Vacancy } from "../types";

interface VacancyCardProps {
  vacancy: Vacancy;
  isFounder: boolean;
  viewMode?: "grid" | "list";
  onEdit?: (vacancy: Vacancy) => void;
  onDelete?: (id: string) => void;
}

const statusStyles: Record<string, string> = {
  open: "bg-green-500/10 text-green-400 border-green-500/30",
  closed: "bg-red-500/10 text-red-400 border-red-500/30",
  draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

export default function VacancyCard({
  vacancy,
  isFounder,
  viewMode = "grid",
  onEdit,
  onDelete,
}: VacancyCardProps) {
  const router = useRouter();

  const founderMenu = isFounder && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white shrink-0"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-[#1a1a22] border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onClick={() => onEdit?.(vacancy)}
          className="text-gray-300 hover:text-white"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete?.(vacancy._id)}
          className="text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (viewMode === "list") {
    return (
      <Card
        onClick={() => router.push(`/careers/${vacancy._id}`)}
        className="group bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-200 cursor-pointer !py-0 !gap-0"
      >
        <div className="flex items-center gap-4 px-4 py-3">
          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <h3 className="text-base text-white font-medium truncate">
                {vacancy.title}
              </h3>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 border shrink-0">
                {vacancy.department}
              </Badge>
              {isFounder && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs border shrink-0 ${statusStyles[vacancy.status]}`}
                >
                  {vacancy.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-1">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {vacancy.location}
              </span>
              <span className="inline-flex items-center gap-1.5 capitalize">
                <Briefcase className="h-3.5 w-3.5" />
                {vacancy.employmentType}
              </span>
              {vacancy.salary && (
                <span className="text-gray-400">{vacancy.salary}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 line-clamp-1">
              {vacancy.description.replace(/<[^>]+>/g, " ").slice(0, 200)}
            </p>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            {founderMenu}
          </div>
        </div>
      </Card>
    );
  }

  // Grid view (default)
  return (
    <Card
      onClick={() => router.push(`/careers/${vacancy._id}`)}
      className="group relative bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-200 cursor-pointer"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-white font-medium line-clamp-2">
            {vacancy.title}
          </CardTitle>
          {founderMenu}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 border">
            {vacancy.department}
          </Badge>
          {isFounder && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${statusStyles[vacancy.status]}`}
            >
              {vacancy.status}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center text-sm text-gray-500">
          <MapPin className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">{vacancy.location}</span>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Briefcase className="h-4 w-4 mr-2 shrink-0" />
          <span className="capitalize">{vacancy.employmentType}</span>
        </div>

        {vacancy.salary && (
          <p className="text-sm text-gray-400">{vacancy.salary}</p>
        )}

        <div
          className="text-sm text-gray-500 line-clamp-2"
          dangerouslySetInnerHTML={{
            __html: vacancy.description.replace(/<[^>]+>/g, " ").slice(0, 150),
          }}
        />

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
            View details
          </span>
          <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
}
