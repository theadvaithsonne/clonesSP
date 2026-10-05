"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DocumentType = "word" | "cell" | "slide";

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  cabinetId?: string | null;
  onDocumentCreated?: (documentId: string) => void;
}

const documentTypes = [
  {
    type: "word" as DocumentType,
    name: "Document",
    description: "Create a rich text document like Google Docs",
    icon: FileText,
    color: "blue",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    type: "cell" as DocumentType,
    name: "Spreadsheet",
    description: "Create a spreadsheet like Google Sheets",
    icon: FileSpreadsheet,
    color: "green",
    gradient: "from-green-500 to-green-600",
  },
  {
    type: "slide" as DocumentType,
    name: "Presentation",
    description: "Create a presentation like Google Slides",
    icon: Presentation,
    color: "orange",
    gradient: "from-orange-500 to-orange-600",
  },
];

export default function CreateDocumentDialog({
  open,
  onOpenChange,
  organizationId,
  cabinetId,
  onDocumentCreated,
}: CreateDocumentDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "name">("select");
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleTypeSelect = (type: DocumentType) => {
    setSelectedType(type);
    setStep("name");
    // Set default name
    const typeInfo = documentTypes.find((t) => t.type === type);
    setDocumentName(`Untitled ${typeInfo?.name || "Document"}`);
  };

  const handleCreate = async () => {
    if (!selectedType || !documentName.trim()) {
      toast.error("Please enter a document name");
      return;
    }

    setCreating(true);
    try {
      const response = await api<{ success: boolean; data: { _id: string } }>(
        `/cabinet/documents?organizationId=${organizationId}`,
        {
          method: "POST",
          body: JSON.stringify({
            title: documentName.trim(),
            type: selectedType,
            cabinetId: cabinetId || null,
          }),
        },
        getToken()!
      );

      toast.success("Document created successfully!");
      onOpenChange(false);

      // Reset state
      setStep("select");
      setSelectedType(null);
      setDocumentName("");

      // Navigate to editor or call callback
      if (onDocumentCreated) {
        onDocumentCreated(response.data._id);
      } else {
        router.push(`/cabinet/editor/${response.data._id}`);
      }
    } catch (err: any) {
      console.error("Error creating document:", err);
      toast.error(err.message || "Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setStep("select");
      setSelectedType(null);
      setDocumentName("");
    }, 200);
  };

  const selectedTypeInfo = documentTypes.find((t) => t.type === selectedType);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-lg !w-full bg-gradient-to-br from-[#111116] to-[#0b0b0d] backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            {step === "select" ? (
              <>Create New Document</>
            ) : (
              <>
                {selectedTypeInfo && (
                  <selectedTypeInfo.icon
                    className={cn(
                      "h-5 w-5",
                      selectedTypeInfo.color === "blue" && "text-blue-400",
                      selectedTypeInfo.color === "green" && "text-green-400",
                      selectedTypeInfo.color === "orange" && "text-orange-400"
                    )}
                  />
                )}
                Name Your {selectedTypeInfo?.name}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "select" ? (
          <div className="grid grid-cols-1 gap-4 py-4">
            {documentTypes.map((docType) => (
              <button
                key={docType.type}
                onClick={() => handleTypeSelect(docType.type)}
                className="group flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                    docType.gradient
                  )}
                >
                  <docType.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-medium group-hover:text-yellow-400 transition-colors">
                    {docType.name}
                  </h3>
                  <p className="text-white/60 text-sm">{docType.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                Document Name
              </label>
              <Input
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder={`Enter ${selectedTypeInfo?.name.toLowerCase()} name`}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-yellow-400/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreate();
                  }
                }}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("select")}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !documentName.trim()}
                className={cn(
                  "font-semibold text-white",
                  selectedTypeInfo?.color === "blue" &&
                    "bg-blue-500 hover:bg-blue-600",
                  selectedTypeInfo?.color === "green" &&
                    "bg-green-500 hover:bg-green-600",
                  selectedTypeInfo?.color === "orange" &&
                    "bg-orange-500 hover:bg-orange-600"
                )}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>Create {selectedTypeInfo?.name}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
