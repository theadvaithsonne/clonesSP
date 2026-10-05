"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircleQuestion,
  X,
  CheckCircle,
  Loader2,
  Paperclip,
  AlertTriangle,
  Zap,
  Flame,
  Info,
  FileText,
  Image as ImageIcon,
  File,
  MessageSquare,
  Building2,
  Folder,
  Bot,
  Calendar,
  ClipboardCheck,
  Users,
  Monitor,
  Settings,
  CreditCard,
  User,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface SupportTicketModalProps {
  children?: React.ReactNode;
  onTicketCreated?: () => void;
}

type AttachmentFile = {
  file: File;
  url?: string;
  uploading: boolean;
};

// Available modules for support tickets
const SUPPORT_MODULES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "General", label: "General", icon: MessageSquare },
  { value: "Workspace", label: "Workspace", icon: Building2 },
  { value: "Cabinet", label: "Cabinet", icon: Folder },
  { value: "Betty", label: "Betty", icon: Bot },
  { value: "Calendar", label: "Calendar / Receptionist", icon: Calendar },
  { value: "Tasks", label: "Tasks", icon: ClipboardCheck },
  { value: "DMs & Groups", label: "DMs & Groups", icon: Users },
  { value: "Floor Roster", label: "Floor Roster", icon: Building2 },
  { value: "Deskstream", label: "Deskstream", icon: Monitor },
  { value: "BackOffice", label: "BackOffice / Apps", icon: Settings },
  { value: "Billing", label: "Billing & Payments", icon: CreditCard },
  { value: "Account", label: "Account & Profile", icon: User },
  { value: "Other", label: "Other", icon: HelpCircle },
];

const PRIORITY_CONFIG = {
  low: {
    label: "Low",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    icon: Info,
    description: "Non-urgent, can wait",
  },
  medium: {
    label: "Medium",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    icon: AlertTriangle,
    description: "Normal priority",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    icon: Zap,
    description: "Needs attention soon",
  },
  urgent: {
    label: "Urgent",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: Flame,
    description: "Critical issue",
  },
};

const getFileIcon = (file: File) => {
  const type = file.type;
  if (type.startsWith("image/")) return ImageIcon;
  if (type.includes("pdf") || type.includes("document")) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function SupportTicketModal({
  children,
  onTicketCreated,
}: SupportTicketModalProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("General");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">(
    "medium"
  );
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    const newAttachment: AttachmentFile = { file, uploading: true };
    setAttachments((prev) => [...prev, newAttachment]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setAttachments((prev) =>
        prev.map((a) =>
          a.file === file ? { ...a, url: data.url, uploading: false } : a
        )
      );
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("Failed to upload file");
      setAttachments((prev) => prev.filter((a) => a.file !== file));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (file: File) => {
    setAttachments((prev) => prev.filter((a) => a.file !== file));
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }

    setLoading(true);
    try {
      const attachmentUrls = attachments
        .filter((a) => a.url)
        .map((a) => a.url as string);

      await api(
        `/support-tickets?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            subject,
            description,
            module,
            priority,
            attachments: attachmentUrls,
          }),
        },
        getToken()!
      );

      toast.success("Support ticket created successfully!");
      setOpen(false);
      resetForm();
      onTicketCreated?.();
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Failed to create support ticket");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setModule("General");
    setPriority("medium");
    setAttachments([]);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setTimeout(resetForm, 150);
    }
  };

  const isUploading = attachments.some((a) => a.uploading);
  const priorityConfig = PRIORITY_CONFIG[priority];
  const PriorityIcon = priorityConfig.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-[#c7c7da] hover:text-white hover:bg-[#15151b] border border-transparent hover:border-[#363649] rounded-full transition-all duration-200"
            title="Raise Support Ticket"
          >
            <MessageCircleQuestion className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={cn(
          "!max-w-[640px] !w-full border border-[#2a2a35] bg-[#0b0b0d]/98 backdrop-blur-2xl",
          "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl p-0 overflow-hidden"
        )}
      >
        {/* Header with gradient accent */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />

          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/20 shadow-lg shadow-yellow-500/5">
                <MessageCircleQuestion className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-white">
                  Create Support Ticket
                </DialogTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  Describe your issue and we'll help resolve it
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              Subject
              <span className="text-red-400 text-xs">*</span>
            </label>
            <Input
              placeholder="Brief summary of your issue..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-[#0e0e12] border-[#2a2a35] text-white placeholder:text-gray-600 h-11 rounded-lg focus:border-yellow-500/50 focus:ring-yellow-500/20 transition-all"
              maxLength={200}
            />
          </div>

          {/* Module and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Module */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Module</label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger className="bg-[#0e0e12] border-[#2a2a35] text-white h-11 rounded-lg focus:border-yellow-500/50">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border-[#2a2a35] rounded-lg">
                  {SUPPORT_MODULES.map((mod) => {
                    const ModIcon = mod.icon;
                    return (
                      <SelectItem
                        key={mod.value}
                        value={mod.value}
                        className="text-white focus:bg-yellow-500/10 focus:text-yellow-200 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ModIcon className="h-4 w-4 text-gray-400" />
                          <span>{mod.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Priority</label>
              <Select
                value={priority}
                onValueChange={(v: "low" | "medium" | "high" | "urgent") => setPriority(v)}
              >
                <SelectTrigger className="bg-[#0e0e12] border-[#2a2a35] text-white h-11 rounded-lg focus:border-yellow-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border-[#2a2a35] rounded-lg">
                  {(Object.keys(PRIORITY_CONFIG) as Array<keyof typeof PRIORITY_CONFIG>).map((key) => {
                    const config = PRIORITY_CONFIG[key];
                    const Icon = config.icon;
                    return (
                      <SelectItem
                        key={key}
                        value={key}
                        className="text-white focus:bg-yellow-500/10 focus:text-yellow-200 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn("p-1 rounded", config.bgColor)}>
                            <Icon className={cn("h-3 w-3", config.color)} />
                          </span>
                          <span className={config.color}>{config.label}</span>
                          <span className="text-gray-500 text-xs">- {config.description}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              Description
              <span className="text-red-400 text-xs">*</span>
            </label>
            <Textarea
              placeholder="Please describe your issue in detail. Include steps to reproduce, expected behavior, and any error messages..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#0e0e12] border-[#2a2a35] text-white placeholder:text-gray-600 min-h-[140px] resize-none rounded-lg focus:border-yellow-500/50 focus:ring-yellow-500/20 transition-all"
              maxLength={5000}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-600">
                Be as specific as possible for faster resolution
              </p>
              <span className={cn(
                "text-xs tabular-nums",
                description.length > 4500 ? "text-orange-400" : "text-gray-600"
              )}>
                {description.length.toLocaleString()}/5,000
              </span>
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">
              Attachments
              <span className="text-gray-600 font-normal ml-1">(optional)</span>
            </label>

            {/* Attachment List */}
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  {attachments.map((attachment, idx) => {
                    const FileIcon = getFileIcon(attachment.file);
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex items-center gap-3 px-3 py-2.5 bg-[#0e0e12] border border-[#2a2a35] rounded-lg group"
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          attachment.uploading ? "bg-yellow-500/10" : "bg-emerald-500/10"
                        )}>
                          {attachment.uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                          ) : (
                            <FileIcon className="h-4 w-4 text-emerald-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {attachment.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(attachment.file.size)}
                            {attachment.uploading && " - Uploading..."}
                          </p>
                        </div>
                        {!attachment.uploading && (
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.file)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed transition-all",
                "text-sm text-gray-400 hover:text-yellow-300",
                "border-[#2a2a35] hover:border-yellow-500/40 hover:bg-yellow-500/5",
                isUploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Paperclip className="h-4 w-4" />
              <span>Click to attach files</span>
              <span className="text-xs text-gray-600">(max 10MB each)</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="flex-1 h-11 border border-[#2a2a35] text-gray-400 hover:text-white hover:bg-[#15151b] rounded-lg transition-all"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || isUploading || !subject.trim() || !description.trim()}
              className={cn(
                "flex-1 h-11 rounded-lg font-medium transition-all",
                "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400",
                "text-black shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30",
                (loading || isUploading || !subject.trim() || !description.trim()) && "opacity-50 cursor-not-allowed shadow-none"
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </span>
              ) : (
                "Submit Ticket"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
