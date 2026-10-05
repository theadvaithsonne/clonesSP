"use client";

import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FIGMA } from "@/components/deals/LeadDetailFigmaView";

export type AddProductOption = {
    id: string;
    name: string;
    pricingLabel?: string;
};

export type ProductSelection = {
    productId: string;
    quantity: string;
};

type AddProductDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    products: AddProductOption[];
    selections: ProductSelection[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onToggleProduct: (productId: string) => void;
    onQuantityChange: (productId: string, quantity: string) => void;
    onSave: () => void;
    isEdit?: boolean;
    isLoading?: boolean;
    isSubmitting?: boolean;
};

const fieldLabelClass = "text-[12px] font-medium whitespace-nowrap";
const inputClass =
    "h-8 w-20 rounded-lg border px-2.5 text-[13px] font-normal shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

export function AddProductDialog({
    open,
    onOpenChange,
    products,
    selections,
    searchQuery,
    onSearchChange,
    onToggleProduct,
    onQuantityChange,
    onSave,
    isEdit = false,
    isLoading = false,
    isSubmitting = false,
}: AddProductDialogProps) {
    const selectedIds = new Set(selections.map((s) => s.productId));
    const quantityById = Object.fromEntries(
        selections.map((s) => [s.productId, s.quantity])
    );

    const filteredProducts = products.filter((product) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const haystack = `${product.name} ${product.pricingLabel || ""}`.toLowerCase();
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
                        {isEdit ? "Edit Product" : "Add Product"}
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

                <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f]/80 backdrop-blur-[2px]">
                            <Loader2 className="h-8 w-8 animate-spin" style={{ color: FIGMA.accent }} />
                            <p className="text-sm" style={{ color: FIGMA.textSecondary }}>
                                Loading products...
                            </p>
                        </div>
                    )}

                    <div
                        className={`flex flex-col gap-5 ${isLoading ? "pointer-events-none opacity-60" : ""}`}
                    >
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
                            <p className={fieldLabelClass} style={{ color: FIGMA.textSecondary }}>
                                Products
                            </p>

                            {filteredProducts.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {filteredProducts.map((product) => {
                                        const isSelected = selectedIds.has(product.id);
                                        return (
                                            <div
                                                key={product.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => onToggleProduct(product.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        onToggleProduct(product.id);
                                                    }
                                                }}
                                                className="flex w-full cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition-colors"
                                                style={{
                                                    background: "#1e1e1e",
                                                    borderColor: isSelected
                                                        ? FIGMA.accent
                                                        : FIGMA.border,
                                                }}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[14px] font-semibold text-white">
                                                            {product.name}
                                                        </p>
                                                        {product.pricingLabel ? (
                                                            <p
                                                                className="mt-1 text-[12px] font-normal"
                                                                style={{ color: FIGMA.textSecondary }}
                                                            >
                                                                {product.pricingLabel}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    {isSelected ? (
                                                        <div
                                                            className="flex shrink-0 flex-col gap-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <label
                                                                className="text-[11px] font-medium"
                                                                style={{ color: FIGMA.textSecondary }}
                                                            >
                                                                Qty
                                                            </label>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                value={quantityById[product.id] || "1"}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (
                                                                        value === "" ||
                                                                        parseInt(value, 10) >= 1
                                                                    ) {
                                                                        onQuantityChange(
                                                                            product.id,
                                                                            value
                                                                        );
                                                                    }
                                                                }}
                                                                disabled={isSubmitting}
                                                                className={inputClass}
                                                                style={{
                                                                    background: "#0f0f0f",
                                                                    borderColor: FIGMA.border,
                                                                    color: FIGMA.textPrimary,
                                                                }}
                                                            />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-10 text-center">
                                    <p className="text-sm" style={{ color: FIGMA.textSecondary }}>
                                        {searchQuery.trim()
                                            ? "No products match your search"
                                            : "No products available"}
                                    </p>
                                </div>
                            )}
                        </div>
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
                        disabled={isSubmitting || isLoading || selections.length === 0}
                        className="h-auto rounded-lg px-5 py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50"
                        style={{ background: FIGMA.accent, color: "#0f0f0f" }}
                    >
                        {isSubmitting
                            ? isEdit
                                ? "Updating..."
                                : "Saving..."
                            : "Save"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
