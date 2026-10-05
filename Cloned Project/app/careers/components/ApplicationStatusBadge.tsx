"use client";

import { Application } from "../types";

const statusStyles: Record<Application["status"], string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  reviewed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  shortlisted: "bg-green-500/10 text-green-400 border-green-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  hired: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

export default function ApplicationStatusBadge({
  status,
}: {
  status: Application["status"];
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border capitalize ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
