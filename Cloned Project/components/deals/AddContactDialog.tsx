"use client";

import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";

export type AddContactProfile = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
};

type AddContactDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contacts: AddContactProfile[];
    selectedIds: string[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onToggleContact: (contactId: string) => void;
    onSave: () => void;
    isLoading?: boolean;
    isSubmitting?: boolean;
};

export function AddContactDialog({
    open,
    onOpenChange,
    contacts,
    selectedIds,
    searchQuery,
    onSearchChange,
    onToggleContact,
    onSave,
    isLoading = false,
    isSubmitting = false,
}: AddContactDialogProps) {
    const filteredContacts = contacts.filter((contact) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const haystack = `${contact.name} ${contact.email || ""} ${contact.phone || ""}`.toLowerCase();
        return haystack.includes(query);
    });

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
                        Add Contact
                    </DialogTitle>
                    <button
                        type="button"
                        aria-label="Close"
                        className="flex size-5 cursor-pointer items-center justify-center text-[#9a9a9a] transition-colors hover:text-white"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                    <div
                        className="flex h-9 shrink-0 items-center gap-2.5 overflow-hidden rounded-lg border px-3"
                        style={{ background: "#1e1e1e", borderColor: FIGMA.border }}
                    >
                        <Search className="size-4 shrink-0" style={{ color: FIGMA.textSecondary }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#9a9a9a]"
                            style={{ color: FIGMA.textPrimary }}
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <p
                            className="text-[12px] font-medium"
                            style={{ color: FIGMA.textSecondary }}
                        >
                            Profiles
                        </p>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-10">
                                <Loader2
                                    className="h-8 w-8 animate-spin"
                                    style={{ color: FIGMA.accent }}
                                />
                                <p className="text-sm" style={{ color: FIGMA.textSecondary }}>
                                    Loading contacts...
                                </p>
                            </div>
                        ) : filteredContacts.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {filteredContacts.map((contact) => {
                                    const isSelected = selectedIds.includes(contact.id);
                                    return (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            onClick={() => onToggleContact(contact.id)}
                                            className="flex w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors"
                                            style={{
                                                background: "#1e1e1e",
                                                borderColor: isSelected
                                                    ? FIGMA.accent
                                                    : FIGMA.border,
                                            }}
                                        >
                                            <p className="w-full text-[14px] font-semibold text-white">
                                                {contact.name}
                                            </p>
                                            {contact.email ? (
                                                <p
                                                    className="w-full text-[12px] font-normal"
                                                    style={{ color: FIGMA.textSecondary }}
                                                >
                                                    {contact.email}
                                                </p>
                                            ) : null}
                                            {contact.phone ? (
                                                <p
                                                    className="w-full text-[12px] font-normal"
                                                    style={{ color: FIGMA.textSecondary }}
                                                >
                                                    {contact.phone}
                                                </p>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-10 text-center">
                                <p className="text-sm" style={{ color: FIGMA.textSecondary }}>
                                    {searchQuery.trim()
                                        ? "No contacts match your search"
                                        : "No contacts available"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className="flex shrink-0 items-center justify-between border-t px-6 py-[15px]"
                    style={{ background: "#141414", borderColor: FIGMA.infoBorder }}
                >
                    <button
                        type="button"
                        className="text-[14px] font-semibold transition-colors hover:text-white disabled:opacity-50"
                        style={{ color: FIGMA.textMuted }}
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <Button
                        type="button"
                        onClick={onSave}
                        disabled={isSubmitting || isLoading || selectedIds.length === 0}
                        className="h-auto rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50"
                        style={{ background: FIGMA.accent, color: "#0f0f0f" }}
                    >
                        {isSubmitting ? "Saving..." : "Save"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
