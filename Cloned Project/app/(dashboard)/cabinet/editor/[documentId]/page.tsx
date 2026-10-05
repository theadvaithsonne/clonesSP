"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, getUserDataFromToken } from "@/lib/auth";
import OnlyOfficeEditor, { DocumentType } from "@/components/dashboard/OnlyOfficeEditor";
import { ArrowLeft, FileText, FileSpreadsheet, Presentation, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DocumentInfo {
  _id: string;
  title: string;
  type: DocumentType;
  fileUrl: string;
  documentKey: string;
  callbackUrl: string;
  token: string;
  editorConfig: any;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  collaborators: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(true);

  const userData = getUserDataFromToken();
  const organizationId = typeof window !== "undefined"
    ? localStorage.getItem("garage_org_id")
    : null;

  useEffect(() => {
    if (documentId && organizationId) {
      loadDocument();
    }
  }, [documentId, organizationId]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await api<{ success: boolean; data: DocumentInfo }>(
        `/cabinet/documents/${documentId}?organizationId=${organizationId}`,
        {},
        getToken()!
      );
      setDocument(response.data);
    } catch (err: any) {
      console.error("Error loading document:", err);
      setError(err.message || "Failed to load document");
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type: DocumentType) => {
    switch (type) {
      case "word":
        return <FileText className="h-5 w-5 text-blue-400" />;
      case "cell":
        return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
      case "slide":
        return <Presentation className="h-5 w-5 text-orange-400" />;
      default:
        return <FileText className="h-5 w-5 text-blue-400" />;
    }
  };

  const handleBack = () => {
    if (!isSaved) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmed) return;
    }
    router.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0b0b0d]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
          <p className="text-white/80">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0b0b0d] text-white">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-8 max-w-md text-center">
          <h3 className="text-xl font-semibold text-red-400 mb-2">
            Document Not Found
          </h3>
          <p className="text-white/80 mb-4">
            {error || "The document you're looking for doesn't exist or you don't have access."}
          </p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0b0b0d] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111116] border-b border-white/10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {getDocumentIcon(document.type)}
            <span className="text-white font-medium">{document.title}</span>
            {!isSaved && (
              <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-0.5 rounded">
                Unsaved
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Collaborators */}
          {document.collaborators && document.collaborators.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-white/60" />
              <div className="flex -space-x-2">
                {document.collaborators.slice(0, 5).map((collab) => (
                  <div
                    key={collab._id}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-medium border-2 border-[#111116]"
                    title={collab.name || collab.email}
                  >
                    {(collab.name || collab.email).charAt(0).toUpperCase()}
                  </div>
                ))}
                {document.collaborators.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-medium border-2 border-[#111116]">
                    +{document.collaborators.length - 5}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-xs text-white/50">
            Last saved: {new Date(document.updatedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <OnlyOfficeEditor
          documentId={document._id}
          documentType={document.type}
          documentTitle={document.title}
          documentUrl={document.fileUrl}
          documentKey={document.documentKey}
          callbackUrl={document.callbackUrl}
          userId={userData?.userId || ""}
          userName={userData?.name || userData?.email || "Anonymous"}
          userEmail={userData?.email}
          token={document.token}
          serverConfig={document.editorConfig}
          mode="edit"
          onReady={() => {
            console.log("Editor ready");
          }}
          onError={(err) => {
            console.error("Editor error:", err);
            toast.error("Editor error occurred");
          }}
          onDocumentStateChange={(saved) => {
            setIsSaved(saved);
          }}
        />
      </div>
    </div>
  );
}
