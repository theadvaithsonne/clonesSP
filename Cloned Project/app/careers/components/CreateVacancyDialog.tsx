"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Vacancy } from "../types";

interface CreateVacancyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editVacancy?: Vacancy | null;
  createVacancy: (
    data: Omit<Vacancy, "_id" | "orgId" | "createdAt" | "updatedAt">
  ) => Promise<Vacancy | undefined>;
  updateVacancy: (
    id: string,
    data: Partial<Vacancy>
  ) => Promise<Vacancy | undefined>;
}

export default function CreateVacancyDialog({
  open,
  onOpenChange,
  onCreated,
  editVacancy,
  createVacancy,
  updateVacancy,
}: CreateVacancyDialogProps) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState<Vacancy["employmentType"]>("full-time");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState<Vacancy["status"]>("open");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editVacancy) {
      setTitle(editVacancy.title);
      setDepartment(editVacancy.department);
      setLocation(editVacancy.location);
      setEmploymentType(editVacancy.employmentType);
      setDescription(editVacancy.description);
      setRequirements(editVacancy.requirements || "");
      setSalary(editVacancy.salary || "");
      setStatus(editVacancy.status);
    } else {
      setTitle("");
      setDepartment("");
      setLocation("");
      setEmploymentType("full-time");
      setDescription("");
      setRequirements("");
      setSalary("");
      setStatus("open");
    }
  }, [editVacancy, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !department.trim() || !location.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!description.trim()) {
      toast.error("Please add a job description");
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        department: department.trim(),
        location: location.trim(),
        employmentType,
        description,
        requirements: requirements.trim() || undefined,
        salary: salary.trim() || undefined,
        status,
      };

      if (editVacancy) {
        await updateVacancy(editVacancy._id, data);
        toast.success("Vacancy updated");
      } else {
        await createVacancy(data as Omit<Vacancy, "_id" | "orgId" | "createdAt" | "updatedAt">);
        toast.success("Vacancy created");
      }

      onOpenChange(false);
      onCreated();
    } catch {
      toast.error(editVacancy ? "Failed to update vacancy" : "Failed to create vacancy");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0C0C0E] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editVacancy ? "Edit Vacancy" : "Create Vacancy"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Remote, New York, NY"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select
                value={employmentType}
                onValueChange={(v) =>
                  setEmploymentType(v as Vacancy["employmentType"])
                }
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a22] border-white/10">
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary">Salary Range (optional)</Label>
              <Input
                id="salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. ₹8L - ₹12L"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Vacancy["status"])}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a22] border-white/10">
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Job Description *</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              minHeight="200px"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements (optional)</Label>
            <Textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="List key requirements, one per line..."
              className="bg-white/5 border-white/10 min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editVacancy ? "Update" : "Create"} Vacancy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
