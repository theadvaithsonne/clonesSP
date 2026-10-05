"use client";

import { useState } from "react";
import type { CmsForm, CmsModule, CmsModuleType, CmsPageContent } from "@/lib/cms/types";
import { submitCmsForm } from "@/lib/cms/api";
import { getLayoutColumns } from "@/lib/cms/columns";
import ColumnModuleEditor from "./ColumnModuleEditor";
import { FooterBlockView, LogoBlockView, SocialIconsBlockView } from "./CmsBlockViews";

function padStyle(padding?: { t?: number; r?: number; b?: number; l?: number }) {
  if (!padding) return undefined;
  return {
    paddingTop: padding.t,
    paddingRight: padding.r,
    paddingBottom: padding.b,
    paddingLeft: padding.l,
  };
}

function heroBg(bg?: string) {
  if (bg === "dark-gradient") {
    return "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f0f 100%)";
  }
  if (bg?.startsWith("#") || bg?.startsWith("rgb") || bg?.startsWith("url")) return bg;
  return bg || "#111111";
}

function LeadFormBlock({
  module,
  form,
  interactive,
}: {
  module: CmsModule;
  form?: CmsForm | null;
  interactive?: boolean;
}) {
  const fields = form?.fields || [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactive || !form?.id) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitCmsForm(form.id, values);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-[#2A2A2A] bg-white p-6 text-center text-[#111]">
        <p className="font-semibold">{form?.successMessage || "Thanks for submitting!"}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border-2 border-dashed border-brand bg-white p-6 text-[#111]"
      data-module-id={module.id}
    >
      <h3 className="mb-4 text-lg font-bold">
        {module.props?.title || form?.title || "Lead Form"}
      </h3>
      <form className="space-y-3" onSubmit={onSubmit}>
        {fields.length === 0 ? (
          <>
            <input
              className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm"
              placeholder="Full Name"
              disabled={!interactive}
            />
            <input
              className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm"
              placeholder="Email Address"
              disabled={!interactive}
            />
          </>
        ) : (
          fields
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((field) => {
              if (field.type === "textarea") {
                return (
                  <textarea
                    key={field.id}
                    className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm"
                    placeholder={field.placeholder || field.label}
                    required={field.required && interactive}
                    disabled={!interactive}
                    value={values[field.key] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                    rows={3}
                  />
                );
              }
              if (field.type === "dropdown") {
                return (
                  <select
                    key={field.id}
                    className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm"
                    required={field.required && interactive}
                    disabled={!interactive}
                    value={values[field.key] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                  >
                    <option value="">{field.placeholder || field.label}</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                );
              }
              return (
                <input
                  key={field.id}
                  type={
                    field.type === "email"
                      ? "email"
                      : field.type === "phone"
                        ? "tel"
                        : field.type === "number"
                          ? "number"
                          : field.type === "date"
                            ? "date"
                            : "text"
                  }
                  className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm"
                  placeholder={field.placeholder || field.label}
                  required={field.required && interactive}
                  disabled={!interactive}
                  value={values[field.key] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                  }
                />
              );
            })
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={!interactive || submitting}
          className="w-full cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-bold !text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "Submitting..."
            : form?.submitButtonText || "Download Free Guide"}
        </button>
      </form>
    </div>
  );
}

function ModuleView({
  module,
  form,
  interactive,
  selectedId,
  onSelect,
  onDelete,
  onAddToColumn,
  onRemoveFromColumn,
}: {
  module: CmsModule;
  form?: CmsForm | null;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddToColumn?: (layoutId: string, columnId: string, type: CmsModuleType) => void;
  onRemoveFromColumn?: (layoutId: string, columnId: string, moduleId: string) => void;
}) {
  const selected = selectedId === module.id;
  const editing = Boolean(onSelect);
  const wrap = (child: React.ReactNode, extraClass = "") => (
    <div
      className={`relative ${selected ? "ring-2 ring-[#3B82F6]" : ""} ${
        editing ? "cursor-pointer hover:ring-1 hover:ring-[#3B82F6]/60" : ""
      } ${extraClass}`}
      data-module-id={module.id}
      onClick={(e) => {
        if (!onSelect) return;
        e.stopPropagation();
        onSelect(module.id);
      }}
    >
      {selected && onDelete ? (
        <button
          type="button"
          title="Delete"
          className="absolute right-1 top-1 z-20 cursor-pointer rounded bg-red-500 p-1 text-white shadow hover:bg-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(module.id);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      ) : null}
      {child}
    </div>
  );

  const layoutChrome = (label: string) =>
    editing ? (
      <button
        type="button"
        className="mb-2 flex w-full cursor-pointer items-center justify-between rounded bg-[#111]/5 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-[#666] hover:bg-[#111]/10"
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(module.id);
        }}
      >
        {label}
        <span className="normal-case text-[#888]">click to select block</span>
      </button>
    ) : null;

  const renderChild = (child: CmsModule) => (
    <ModuleView
      key={child.id}
      module={child}
      form={form}
      interactive={interactive}
      selectedId={selectedId}
      onSelect={onSelect}
      onDelete={onDelete}
      onAddToColumn={onAddToColumn}
      onRemoveFromColumn={onRemoveFromColumn}
    />
  );

  const layoutLabel =
    module.type === "two_column"
      ? "Two Column"
      : module.type === "three_column"
        ? "Three Column"
        : module.type === "columns"
          ? "Columns"
          : module.type === "container"
            ? "Container"
            : "Section";

  switch (module.type) {
    case "hero": {
      const align = module.props.alignment || "center";
      return wrap(
        <div
          style={{
            background: heroBg(module.props.background),
            ...padStyle(module.props.padding),
            textAlign: align as any,
          }}
          className="text-white"
        >
          <h1
            className="font-bold leading-tight"
            style={{ fontSize: module.props.fontSize || 48 }}
          >
            {module.props.heading || "Headline"}
          </h1>
          {module.props.subheading ? (
            <p className="mt-3 text-sm text-white/70">{module.props.subheading}</p>
          ) : null}
          {module.props.buttonLabel ? (
            <button
              type="button"
              className="mt-5 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-bold !text-black"
              style={{
                backgroundColor: module.props.buttonColor || "#F5C518",
                color: "#000000",
              }}
            >
              {module.props.buttonLabel}
            </button>
          ) : null}
        </div>
      );
    }
    case "heading":
      return wrap(
        <h2
          style={{
            fontSize: module.props.fontSize || 24,
            fontWeight: module.props.weight || 700,
            color: module.props.color || "#111",
            textAlign: module.props.alignment || "left",
          }}
        >
          {module.props.text}
        </h2>
      );
    case "text":
      return wrap(
        <p
          style={{
            fontSize: module.props.fontSize || 15,
            color: module.props.color || "#555",
            textAlign: module.props.alignment || "left",
          }}
        >
          {module.props.text}
        </p>
      );
    case "image":
      return wrap(
        <div
          className="flex min-h-[120px] items-center justify-center overflow-hidden bg-[#f3f3f3] text-sm text-[#888]"
          style={{ borderRadius: module.props.borderRadius ?? 8 }}
        >
          {module.props.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={module.props.src}
              alt={module.props.alt || ""}
              className="h-full w-full object-cover"
            />
          ) : (
            "Image placeholder"
          )}
        </div>
      );
    case "button":
      return wrap(
        <div>
          <a
            href={module.props.url || "#"}
            className="inline-block cursor-pointer rounded-lg px-4 py-2 text-sm font-bold"
            style={{
              backgroundColor: module.props.backgroundColor || "#F5C518",
              color: module.props.textColor || "#000000",
              borderRadius: module.props.borderRadius ?? 8,
            }}
            onClick={(e) => {
              if (!interactive) e.preventDefault();
            }}
          >
            {module.props.label || "Button"}
          </a>
        </div>
      );
    case "divider":
      return wrap(
        <hr
          style={{
            borderColor: module.props.color || "#e5e5e5",
            borderWidth: module.props.thickness || 1,
          }}
        />
      );
    case "spacer":
      return wrap(<div style={{ height: module.props.height || 32 }} />);
    case "lead_form":
      return wrap(
        <LeadFormBlock module={module} form={form} interactive={interactive} />
      );
    case "logo":
      return wrap(<LogoBlockView module={module} />);
    case "social_icons":
      return wrap(<SocialIconsBlockView module={module} />);
    case "footer":
      return wrap(<FooterBlockView module={module} />);
    case "two_column":
    case "three_column":
    case "columns":
    case "section":
    case "container":
      return wrap(
        <div
          style={{
            background: module.props.background || "#fff",
            ...padStyle(module.props.padding),
          }}
        >
          {layoutChrome(layoutLabel)}
          {onSelect && onAddToColumn && onRemoveFromColumn ? (
            <ColumnModuleEditor
              layoutModule={module}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onAddToColumn={onAddToColumn}
              onRemoveFromColumn={onRemoveFromColumn}
              renderModule={renderChild}
            />
          ) : (
            <div
              className="flex w-full"
              style={{ gap: module.props.gap ?? 16 }}
            >
              {getLayoutColumns(module).map((col) => (
                <div
                  key={col.id}
                  className="min-w-0"
                  style={{ flexBasis: `${col.width}%` }}
                >
                  <div className="space-y-3">
                    {col.modules.map((child) => renderChild(child))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    default:
      return wrap(
        <div className="p-4 text-sm text-[#888]">Unknown block: {module.type}</div>
      );
  }
}

export default function PageRenderer({
  content,
  form,
  interactive = false,
  selectedId,
  onSelect,
  onDelete,
  onAddToColumn,
  onRemoveFromColumn,
  width = 680,
}: {
  content: CmsPageContent;
  form?: CmsForm | null;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddToColumn?: (layoutId: string, columnId: string, type: CmsModuleType) => void;
  onRemoveFromColumn?: (layoutId: string, columnId: string, moduleId: string) => void;
  width?: number;
}) {
  return (
    <div
      className="mx-auto overflow-hidden bg-white text-[#111] shadow-lg"
      style={{ width, maxWidth: "100%" }}
      onClick={() => onSelect?.("")}
    >
      {(content?.modules || []).map((module) => (
        <ModuleView
          key={module.id}
          module={module}
          form={form}
          interactive={interactive}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onAddToColumn={onAddToColumn}
          onRemoveFromColumn={onRemoveFromColumn}
        />
      ))}
      {(content?.modules || []).length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-[#888]">
          Add modules from the library to build your page
        </div>
      ) : null}
    </div>
  );
}
