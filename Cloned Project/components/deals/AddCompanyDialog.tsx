"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";

export const COMPANY_SIZE_OPTIONS = [
    "1-10",
    "10-50",
    "50-100",
    "100-500",
    "500-1000",
    "1000+",
];

export const COMPANY_INDUSTRY_OPTIONS = [
    "Technology",
    "Healthcare",
    "Finance",
    "Retail",
    "Manufacturing",
    "Education",
    "Real Estate",
    "Consulting",
    "Other",
];

export type AddCompanyForm = {
    name: string;
    industry: string;
    size: string;
    revenue: string;
    website: string;
};

type AddCompanyDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: AddCompanyForm;
    onFormChange: (patch: Partial<AddCompanyForm>) => void;
    onSave: () => void;
    isSubmitting?: boolean;
    /** When false, hides company size (used for contact-linked create). */
    showSize?: boolean;
    /** When true, industry is a free-text input instead of a select. */
    industryAsText?: boolean;
    title?: string;
    saveLabel?: string;
};

const fieldLabelClass = "text-[12px] font-medium whitespace-nowrap";
const inputClass =
    "h-9 w-full rounded-lg border px-2.5 text-[13px] font-normal shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";
const selectTriggerClass =
    "h-9 w-full rounded-lg border px-2.5 text-[13px] font-normal shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-1";

export function AddCompanyDialog({
    open,
    onOpenChange,
    form,
    onFormChange,
    onSave,
    isSubmitting = false,
    showSize = true,
    industryAsText = false,
    title = "Add Company",
    saveLabel = "Save",
}: AddCompanyDialogProps) {
    const fieldStyle = {
        background: "#1e1e1e",
        borderColor: FIGMA.border,
        color: FIGMA.textPrimary,
    } as const;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-[20px] border p-0 sm:max-w-[503px] [&>button]:hidden"
                style={{
                    background: "#0f0f0f",
                    borderColor: FIGMA.infoBorder,
                    boxShadow: "2px 2px 2px black",
                }}
            >
                <div
                    className="flex shrink-0 items-center justify-between border-b p-5"
                    style={{ borderColor: FIGMA.infoBorder, background: "#0f0f0f" }}
                >
                    <DialogTitle className="text-[15px] font-bold text-white">
                        {title}
                    </DialogTitle>
                    <button
                        type="button"
                        aria-label="Close"
                        className="flex size-5 items-center justify-center text-[#9a9a9a] transition-colors hover:text-white"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                    <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                            Company Name <span style={{ color: FIGMA.red }}>*</span>
                        </label>
                        <Input
                            placeholder="Company name"
                            value={form.name}
                            onChange={(e) => onFormChange({ name: e.target.value })}
                            disabled={isSubmitting}
                            className={inputClass}
                            style={fieldStyle}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                            Industry
                        </label>
                        {industryAsText ? (
                            <Input
                                placeholder="Enter industry"
                                value={form.industry}
                                onChange={(e) => onFormChange({ industry: e.target.value })}
                                disabled={isSubmitting}
                                className={inputClass}
                                style={fieldStyle}
                            />
                        ) : (
                            <Select
                                value={form.industry || undefined}
                                onValueChange={(value) => onFormChange({ industry: value })}
                                disabled={isSubmitting}
                            >
                                <SelectTrigger className={selectTriggerClass} style={fieldStyle}>
                                    <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                                <SelectContent
                                    className="border text-white"
                                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                >
                                    {COMPANY_INDUSTRY_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {showSize ? (
                        <div className="flex flex-col gap-1.5">
                            <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Company Size
                            </label>
                            <Select
                                value={form.size || undefined}
                                onValueChange={(value) => onFormChange({ size: value })}
                                disabled={isSubmitting}
                            >
                                <SelectTrigger className={selectTriggerClass} style={fieldStyle}>
                                    <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent
                                    className="border text-white"
                                    style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                                >
                                    {COMPANY_SIZE_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}

                    <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                            Revenue
                        </label>
                        <Input
                            placeholder="Enter revenue"
                            value={form.revenue}
                            onChange={(e) => onFormChange({ revenue: e.target.value })}
                            disabled={isSubmitting}
                            className={inputClass}
                            style={fieldStyle}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                            Website
                        </label>
                        <Input
                            placeholder="www.company.com"
                            value={form.website}
                            onChange={(e) => onFormChange({ website: e.target.value })}
                            disabled={isSubmitting}
                            className={inputClass}
                            style={fieldStyle}
                        />
                    </div>
                </div>

                <div
                    className="flex shrink-0 items-center justify-between border-t px-6 py-[15px]"
                    style={{ background: "#141414", borderColor: FIGMA.infoBorder }}
                >
                    <button
                        type="button"
                        className="cursor-pointer text-[14px] font-semibold transition-colors hover:text-white disabled:opacity-50"
                        style={{ color: FIGMA.textMuted }}
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <Button
                        type="button"
                        onClick={onSave}
                        disabled={isSubmitting || !form.name.trim()}
                        className="h-auto cursor-pointer rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50"
                        style={{ background: FIGMA.accent, color: "#0f0f0f" }}
                    >
                        {isSubmitting ? "Saving..." : saveLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
