"use client";

import dynamic from "next/dynamic";

// This Client Component is now responsible for the dynamic import with ssr: false.
const WorkspaceClient = dynamic(() => import("./WorkspaceClient"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-68px)] bg-[#0a0a0d] flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
        <p className="text-lg">Entering OfficeStream...</p>
      </div>
    </div>
  ),
});

export default function WorkspaceLoader() {
  return <WorkspaceClient />;
}
