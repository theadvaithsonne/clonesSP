"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users, FileText, FileSpreadsheet, Presentation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import OnlyOfficeEditor, { DocumentType } from "./OnlyOfficeEditor";
import { api } from "@/lib/api";

interface DocumentData {
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
  updatedAt: string;
}

interface DocumentEditorOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  organizationId: string;
  userId: string;
  userName: string;
  userEmail?: string;
}

export function DocumentEditorOverlay({
  isOpen,
  onClose,
  documentId,
  organizationId,
  userId,
  userName,
  userEmail,
}: DocumentEditorOverlayProps) {
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch document data
  useEffect(() => {
    if (isOpen && documentId) {
      fetchDocument();
    }
  }, [isOpen, documentId, organizationId]);

  const fetchDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api(
        `/cabinet/documents/${documentId}?organizationId=${organizationId}`,
        {
          method: "GET",
        }
      ) as { success: boolean; data?: DocumentData; error?: string };

      if (response.success && response.data) {
        setDocument(response.data);
      } else {
        setError(response.error || "Failed to load document");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasUnsavedChanges]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      window.document.body.style.overflow = "hidden";
      window.document.documentElement.style.overflow = "hidden";
      window.document.body.style.height = "100vh";
      window.document.documentElement.style.height = "100vh";
    } else {
      window.document.body.style.overflow = "";
      window.document.documentElement.style.overflow = "";
      window.document.body.style.height = "";
      window.document.documentElement.style.height = "";
    }
    return () => {
      window.document.body.style.overflow = "";
      window.document.documentElement.style.overflow = "";
      window.document.body.style.height = "";
      window.document.documentElement.style.height = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirm) return;
    }
    onClose();
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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const overlayContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-9999 flex flex-col bg-[#0b0b0d] overflow-hidden"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0e0e12] border-b border-[#2a2a35]">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-[#1a1a22] text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {document && (
                <>
                  {getDocumentIcon(document.type)}
                  <span className="text-white font-medium">{document.title}</span>
                  {hasUnsavedChanges && (
                    <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                      Unsaved changes
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {document && document.collaborators.length > 0 && (
                <div className="flex items-center gap-2 text-[#9fa0b8]">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {document.collaborators.length + 1} collaborators
                  </span>
                </div>
              )}

              {document && (
                <span className="text-xs text-[#9fa0b8]">
                  Last saved:{" "}
                  {new Date(document.updatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 60px)' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                  <p className="text-white/80">Loading document...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md text-center">
                  <h3 className="text-lg font-semibold text-red-400 mb-2">
                    Error Loading Document
                  </h3>
                  <p className="text-white/80 text-sm">{error}</p>
                  <Button
                    onClick={fetchDocument}
                    className="mt-4 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : document ? (
              <OnlyOfficeEditor
                documentId={document._id}
                documentType={document.type}
                documentTitle={document.title}
                documentUrl={document.fileUrl}
                documentKey={document.documentKey}
                callbackUrl={document.callbackUrl}
                userId={userId}
                userName={userName}
                userEmail={userEmail}
                token={document.token}
                serverConfig={document.editorConfig}
                mode="edit"
                onDocumentStateChange={(isSaved) => setHasUnsavedChanges(!isSaved)}
                onError={(err) => {
                  console.error("Editor error:", err);
                }}
              />
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlayContent, window.document.body);
}
