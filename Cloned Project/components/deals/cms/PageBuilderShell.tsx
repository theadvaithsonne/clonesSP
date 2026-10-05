"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCmsPage,
  publishCmsPage,
  updateCmsForm,
  updateCmsPage,
} from "@/lib/cms/api";
import { createModule, MODULE_LIBRARY } from "@/lib/cms/moduleDefaults";
import { uploadFiles } from "@/lib/uploadthing";
import {
  addModuleToColumn,
  findModule,
  mapModules,
  removeModuleFromColumn,
  updateLayoutColumns,
} from "@/lib/cms/moduleTree";
import { getLayoutColumns, makeColumns } from "@/lib/cms/columns";
import type {
  CmsForm,
  CmsModule,
  CmsPage,
  CmsPageContent,
  DevicePreview,
} from "@/lib/cms/types";
import PageRenderer from "./PageRenderer";
import LeadFormBuilderModal from "./LeadFormBuilderModal";
import DomainSettingsModal from "./DomainSettingsModal";
import CrmFunnelMapping from "./CrmFunnelMapping";

function slugifyClient(value: string) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "page"
  );
}

function isDefaultSlug(slug?: string) {
  return !slug || /^untitled(-page)?(-\d+)?$/i.test(slug);
}

function deviceWidth(device: DevicePreview) {
  if (device === "tablet") return 768;
  if (device === "mobile") return 390;
  return 680;
}

const BUTTON_COLOR_SWATCHES = ["#F5C518", "#3B82F6", "#22C55E", "#A855F7", "#EF4444"];

const PADDING_SIDES = [
  { key: "t" as const, label: "Top" },
  { key: "r" as const, label: "Right" },
  { key: "b" as const, label: "Bottom" },
  { key: "l" as const, label: "Left" },
];

function AlignmentPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: "left" | "center" | "right") => void;
}) {
  const current = value || "center";
  const opts = [
    { id: "left" as const, Icon: AlignLeft },
    { id: "center" as const, Icon: AlignCenter },
    { id: "right" as const, Icon: AlignRight },
  ];
  return (
    <div className="space-y-1">
      <span className="text-[#888]">Alignment</span>
      <div className="flex gap-1">
        {opts.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            title={id}
            onClick={() => onChange(id)}
            className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-lg border ${
              current === id
                ? "border-brand bg-brand/15 text-brand"
                : "border-[#2A2A2A] bg-[#1E1E1E] text-[#888] hover:border-[#555]"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

function PaddingEditor({
  padding,
  onChange,
}: {
  padding?: { t?: number; r?: number; b?: number; l?: number };
  onChange: (next: { t?: number; r?: number; b?: number; l?: number }) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[#888]">Padding (T / R / B / L)</span>
      <div className="grid grid-cols-4 gap-1.5">
        {PADDING_SIDES.map(({ key, label }) => (
          <label key={key} className="block space-y-1">
            <span className="block text-center text-[10px] text-[#888]" title={label}>
              {key.toUpperCase()}
              <span className="sr-only"> ({label})</span>
            </span>
            <input
              type="number"
              min={0}
              title={label}
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-1 py-1.5 text-center text-xs"
              value={padding?.[key] ?? 24}
              onChange={(e) =>
                onChange({
                  ...(padding || {}),
                  [key]: Number(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <p className="text-[10px] text-[#555]">Top · Right · Bottom · Left</p>
    </div>
  );
}

export default function PageBuilderShell({
  pageId,
  onBack,
}: {
  pageId: string;
  onBack: () => void;
}) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [form, setForm] = useState<CmsForm | null>(null);
  const [content, setContent] = useState<CmsPageContent>({ modules: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<DevicePreview>("desktop");
  const [propsTab, setPropsTab] = useState<"element" | "page" | "seo">("element");
  const [moduleSearch, setModuleSearch] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({
    Content: false,
    Media: true,
    "Social Proof": true,
    Advanced: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCmsPage(pageId);
      setPage(data.page);
      setForm(data.form);
      setContent(data.page.content || { modules: [] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load page");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (nextContent?: CmsPageContent, pagePatch?: Partial<CmsPage>) => {
      if (!page) return;
      setSaving(true);
      try {
        const { page: updated } = await updateCmsPage(page.id, {
          content: nextContent || content,
          ...pagePatch,
        });
        setPage(updated);
        dirtyRef.current = false;
      } catch (err: any) {
        toast.error(err?.message || "Auto-save failed");
      } finally {
        setSaving(false);
      }
    },
    [page, content]
  );

  const scheduleSave = useCallback(
    (nextContent: CmsPageContent) => {
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(nextContent);
      }, 2000);
    },
    [persist]
  );

  const setModules = (modules: CmsModule[]) => {
    const next = { modules };
    setContent(next);
    scheduleSave(next);
  };

  const selected = selectedId ? findModule(content.modules, selectedId) : null;
  const selectedIsTopLevel = Boolean(
    selectedId && content.modules.some((m) => m.id === selectedId)
  );

  const library = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    return MODULE_LIBRARY.filter((item) => !q || item.label.toLowerCase().includes(q));
  }, [moduleSearch]);

  const categories = useMemo(() => {
    const cats = ["Layout", "Content", "Lead Form", "Media", "Social Proof", "Advanced"];
    return cats
      .map((cat) => ({
        cat,
        items: library.filter((i) => i.category === cat),
      }))
      .filter((c) => c.items.length > 0 || ["Media", "Social Proof", "Advanced"].includes(c.cat));
  }, [library]);

  const addModule = (type: Parameters<typeof createModule>[0]) => {
    const mod = createModule(type);
    setModules([...content.modules, mod]);
    setSelectedId(mod.id);
    if (type === "lead_form") setFormOpen(true);
  };

  const updateSelectedProps = (patch: Record<string, any>) => {
    if (!selectedId) return;
    setModules(
      mapModules(content.modules, selectedId, (m) => ({
        ...m,
        props: { ...m.props, ...patch },
      }))
    );
  };

  const handleAddToColumn = (
    layoutId: string,
    columnId: string,
    type: Parameters<typeof createModule>[0]
  ) => {
    setModules(addModuleToColumn(content.modules, layoutId, columnId, type));
  };

  const handleImageFile = async (file: File | null | undefined) => {
    if (!selected || selected.type !== "image") return;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_SIZE_MB}MB`);
      return;
    }

    setImageUploading(true);
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
    try {
      const results = await uploadFiles("cms-image", { files: [file] });
      const url = results?.[0]?.url;
      if (!url) throw new Error("Upload returned no URL");
      updateSelectedProps({
        src: url,
        alt: selected.props.alt || file.name || "Image",
      });
    } catch (err: any) {
      toast.error(err?.message || "Image upload failed");
    } finally {
      URL.revokeObjectURL(objectUrl);
      setImageUploading(false);
      setImagePreviewUrl(null);
    }
  };

  const handleRemoveFromColumn = (
    layoutId: string,
    columnId: string,
    moduleId: string
  ) => {
    setModules(removeModuleFromColumn(content.modules, layoutId, columnId, moduleId));
    setSelectedId((cur) => (cur === moduleId ? null : cur));
  };

  const setColumnCount = (count: number) => {
    if (!selectedId) return;
    setModules(
      updateLayoutColumns(content.modules, selectedId, (cols) => {
        const next = makeColumns(count);
        for (let i = 0; i < Math.min(cols.length, next.length); i++) {
          next[i] = { ...next[i], modules: cols[i].modules };
        }
        return next;
      })
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setModules(mapModules(content.modules, selectedId, () => null));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const clone: CmsModule = JSON.parse(JSON.stringify(selected));
    const reId = (m: CmsModule): CmsModule => ({
      ...m,
      id: `m_${Math.random().toString(36).slice(2, 10)}`,
      children: m.children?.map(reId),
    });
    const fresh = reId(clone);
    const idx = content.modules.findIndex((m) => m.id === selected.id);
    if (idx >= 0) {
      const next = [...content.modules];
      next.splice(idx + 1, 0, fresh);
      setModules(next);
    } else {
      setModules([...content.modules, fresh]);
    }
    setSelectedId(fresh.id);
  };

  const moveSelected = (dir: -1 | 1) => {
    if (!selectedId) return;
    const idx = content.modules.findIndex((m) => m.id === selectedId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= content.modules.length) return;
    const next = [...content.modules];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setModules(next);
  };

  const onSelect = (id: string) => {
    if (!id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    const mod = findModule(content.modules, id);
    if (mod?.type === "lead_form") {
      // double-click path handled via Configure; single select just selects
    }
  };

  const handlePublish = async () => {
    if (!page) return;
    try {
      const patch: Partial<CmsPage> = { name: page.name };
      if (isDefaultSlug(page.slug)) {
        patch.slug = slugifyClient(page.name);
      }
      await persist(content, patch);
      const { page: updated, publicUrl } = await publishCmsPage(page.id);
      setPage(updated);
      toast.success(`Published at ${publicUrl}`);
    } catch (err: any) {
      toast.error(err?.message || "Publish failed");
    }
  };

  if (loading || !page) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0F0F0F] text-sm text-[#888]">
        Loading builder...
      </div>
    );
  }

  return (
    <div className="cms-ui flex h-full min-h-[640px] flex-col bg-[#0F0F0F] text-white">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#2A2A2A] bg-[#141414] px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[#888] hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Pages
        </button>
        <span className="text-[#555]">/</span>
        <input
          className="min-w-[160px] rounded border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-[#2A2A2A] focus:border-brand"
          value={page.name}
          onChange={(e) => {
            const name = e.target.value;
            const next: CmsPage = { ...page, name };
            if (isDefaultSlug(page.slug)) {
              next.slug = slugifyClient(name);
            }
            setPage(next);
            dirtyRef.current = true;
          }}
          onBlur={(e) => {
            const name = e.currentTarget.value.trim() || page.name;
            const patch: Partial<CmsPage> = { name };
            if (isDefaultSlug(page.slug) || page.slug === slugifyClient(page.name)) {
              patch.slug = slugifyClient(name);
            }
            void persist(content, patch);
          }}
        />
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] p-0.5">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              className={`cursor-pointer rounded-md p-1.5 ${
                device === key ? "bg-brand !text-brand-foreground" : "text-[#888]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <span className="text-xs text-[#555]">{saving ? "Saving..." : dirtyRef.current ? "Unsaved" : "Saved"}</span>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="cursor-pointer rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-sm text-white"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => setCrmOpen(true)}
          className="cursor-pointer rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-sm text-white"
        >
          Configure Funnel
        </button>
        <button
          type="button"
          onClick={() => persist(content)}
          className="cursor-pointer rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-sm text-white"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={handlePublish}
          className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-sm font-bold !text-brand-foreground"
        >
          Publish
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Module library */}
        <aside className="w-[240px] shrink-0 overflow-auto border-r border-[#2A2A2A] bg-[#141414] p-3">
          <input
            className="mb-3 w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2 text-sm outline-none focus:border-brand"
            placeholder="Search modules..."
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
          />
          {categories.map(({ cat, items }) => (
            <div key={cat} className="mb-3">
              <button
                type="button"
                className="mb-1 flex w-full cursor-pointer items-center justify-between text-xs font-bold uppercase tracking-wide text-[#888]"
                onClick={() =>
                  setCollapsedCats((c) => ({ ...c, [cat]: !c[cat] }))
                }
              >
                {cat}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${collapsedCats[cat] ? "-rotate-90" : ""}`}
                />
              </button>
              {!collapsedCats[cat] ? (
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-[#555]">Coming soon</p>
                  ) : (
                    items.map((item) => (
                      <button
                        key={item.type + item.label}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => addModule(item.type)}
                        className="w-full cursor-pointer rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2 text-left text-sm text-white hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {item.label}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </aside>

        {/* Canvas */}
        <div className="relative min-w-0 flex-1 overflow-auto bg-[#0a0a0a] p-6">
          {selected && selectedId ? (
            <div className="absolute right-8 top-4 z-10 flex gap-1 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] p-1 shadow-lg">
              {selectedIsTopLevel ? (
                <>
                  <button type="button" className="cursor-pointer rounded p-1.5 hover:bg-white/10" onClick={() => moveSelected(-1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="cursor-pointer rounded p-1.5 hover:bg-white/10" onClick={() => moveSelected(1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : null}
              <button type="button" className="cursor-pointer rounded p-1.5 hover:bg-white/10" onClick={duplicateSelected}>
                <Copy className="h-3.5 w-3.5" />
              </button>
              {selected.type === "lead_form" ? (
                <button
                  type="button"
                  className="cursor-pointer rounded px-2 text-xs font-semibold text-brand"
                  onClick={() => setFormOpen(true)}
                >
                  Edit Form
                </button>
              ) : null}
              <button
                type="button"
                title="Delete module"
                className="cursor-pointer rounded p-1.5 text-red-400 hover:bg-white/10"
                onClick={deleteSelected}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <PageRenderer
            content={content}
            form={form}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={(id) => {
              setModules(mapModules(content.modules, id, () => null));
              setSelectedId((cur) => (cur === id ? null : cur));
            }}
            onAddToColumn={handleAddToColumn}
            onRemoveFromColumn={handleRemoveFromColumn}
            width={deviceWidth(device)}
          />
        </div>

        {/* Properties */}
        <aside className="w-[280px] shrink-0 overflow-auto border-l border-[#2A2A2A] bg-[#141414] p-3">
          <div className="mb-3 flex gap-3 border-b border-[#2A2A2A] text-sm">
            {(["element", "page", "seo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPropsTab(t)}
                className={`cursor-pointer pb-2 capitalize ${
                  propsTab === t
                    ? "border-b-2 border-brand font-semibold text-white"
                    : "text-[#888]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {propsTab === "element" ? (
            selected ? (
              <div className="space-y-3 text-sm">
                <p className="text-xs font-bold uppercase text-[#888]">
                  {selected.type.replace("_", " ")}
                </p>
                {selected.type === "hero" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Background</span>
                      <select
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.background || "dark-gradient"}
                        onChange={(e) => updateSelectedProps({ background: e.target.value })}
                      >
                        <option value="dark-gradient">Dark Gradient</option>
                        <option value="#111111">Solid Dark</option>
                        <option value="#F5C518">Accent Yellow</option>
                        <option value="#ffffff">White</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Heading Text</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.heading || ""}
                        onChange={(e) => updateSelectedProps({ heading: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Subheading</span>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.subheading || ""}
                        onChange={(e) => updateSelectedProps({ subheading: e.target.value })}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[#888]">Font Size</span>
                        <div className="flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2">
                          <input
                            type="number"
                            min={12}
                            className="w-full bg-transparent py-2 outline-none"
                            value={selected.props.fontSize || 48}
                            onChange={(e) =>
                              updateSelectedProps({ fontSize: Number(e.target.value) })
                            }
                          />
                          <span className="text-xs text-[#555]">px</span>
                        </div>
                      </label>
                      <AlignmentPicker
                        value={selected.props.alignment}
                        onChange={(alignment) => updateSelectedProps({ alignment })}
                      />
                    </div>
                    <PaddingEditor
                      padding={selected.props.padding}
                      onChange={(padding) => updateSelectedProps({ padding })}
                    />
                    <label className="block space-y-1">
                      <span className="text-[#888]">Button Label</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.buttonLabel || ""}
                        onChange={(e) => updateSelectedProps({ buttonLabel: e.target.value })}
                      />
                    </label>
                    <div className="space-y-1.5">
                      <span className="text-[#888]">Button Color</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {BUTTON_COLOR_SWATCHES.map((color) => (
                          <button
                            key={color}
                            type="button"
                            title={color}
                            onClick={() => updateSelectedProps({ buttonColor: color })}
                            className={`h-7 w-7 cursor-pointer rounded-full border-2 ${
                              (selected.props.buttonColor || "#F5C518").toLowerCase() ===
                              color.toLowerCase()
                                ? "border-white"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <input
                          type="color"
                          className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                          value={selected.props.buttonColor || "#F5C518"}
                          onChange={(e) =>
                            updateSelectedProps({ buttonColor: e.target.value })
                          }
                          title="Custom color"
                        />
                        <span className="font-mono text-xs text-[#888]">
                          {(selected.props.buttonColor || "#F5C518").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
                {["heading", "text"].includes(selected.type) ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Content</span>
                      <textarea
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        rows={3}
                        value={selected.props.text || ""}
                        onChange={(e) => updateSelectedProps({ text: e.target.value })}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[#888]">Font Size</span>
                        <div className="flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2">
                          <input
                            type="number"
                            className="w-full bg-transparent py-2 outline-none"
                            value={selected.props.fontSize || 16}
                            onChange={(e) =>
                              updateSelectedProps({ fontSize: Number(e.target.value) })
                            }
                          />
                          <span className="text-xs text-[#555]">px</span>
                        </div>
                      </label>
                      <AlignmentPicker
                        value={selected.props.alignment}
                        onChange={(alignment) => updateSelectedProps({ alignment })}
                      />
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Color</span>
                      <input
                        type="color"
                        className="h-9 w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E]"
                        value={selected.props.color || "#111111"}
                        onChange={(e) => updateSelectedProps({ color: e.target.value })}
                      />
                    </label>
                  </>
                ) : null}
                {selected.type === "button" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Label</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.label || ""}
                        onChange={(e) => updateSelectedProps({ label: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">URL</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.url || ""}
                        onChange={(e) => updateSelectedProps({ url: e.target.value })}
                      />
                    </label>
                    <div className="space-y-1.5">
                      <span className="text-[#888]">Button Color</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {BUTTON_COLOR_SWATCHES.map((color) => (
                          <button
                            key={color}
                            type="button"
                            title={color}
                            onClick={() =>
                              updateSelectedProps({ backgroundColor: color })
                            }
                            className={`h-7 w-7 cursor-pointer rounded-full border-2 ${
                              (selected.props.backgroundColor || "#F5C518").toLowerCase() ===
                              color.toLowerCase()
                                ? "border-white"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <span className="font-mono text-xs text-[#888]">
                          {(selected.props.backgroundColor || "#F5C518").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
                {selected.type === "image" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Image URL</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.src || ""}
                        onChange={(e) => updateSelectedProps({ src: e.target.value })}
                      />
                    </label>

                    <div className="flex items-center justify-between gap-2">
                      <label
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2 text-sm text-white hover:border-brand/60"
                        title="Upload an image and set it as the Image src"
                      >
                        Browse
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void handleImageFile(e.target.files?.[0])}
                        />
                      </label>

                      {imageUploading ? (
                        <span className="text-xs text-[#888]">Uploading...</span>
                      ) : null}
                    </div>

                    {(() => {
                      const src = imagePreviewUrl || selected.props.src || "";
                      if (!src) {
                        return (
                          <div className="flex h-28 items-center justify-center rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] text-xs text-[#888]">
                            Preview will appear here
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={selected.props.alt || "Image preview"}
                            className="h-28 w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] object-cover"
                          />
                        </div>
                      );
                    })()}
                  </>
                ) : null}
                {selected.type === "logo" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Logo URL</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.src || ""}
                        onChange={(e) => updateSelectedProps({ src: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Alt text</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.alt || ""}
                        onChange={(e) => updateSelectedProps({ alt: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Link URL</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.link || ""}
                        onChange={(e) => updateSelectedProps({ link: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Width (px)</span>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.width || 150}
                        onChange={(e) =>
                          updateSelectedProps({ width: Number(e.target.value) })
                        }
                      />
                    </label>
                    <AlignmentPicker
                      value={selected.props.align}
                      onChange={(align) => updateSelectedProps({ align })}
                    />
                  </>
                ) : null}
                {selected.type === "social_icons" ? (
                  <>
                    <AlignmentPicker
                      value={selected.props.align}
                      onChange={(align) => updateSelectedProps({ align })}
                    />
                    <label className="block space-y-1">
                      <span className="text-[#888]">Icon size (px)</span>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.size || 32}
                        onChange={(e) =>
                          updateSelectedProps({ size: Number(e.target.value) })
                        }
                      />
                    </label>
                    <p className="text-xs text-[#555]">
                      Edit platform URLs in the properties JSON or add icons via column Add Element.
                    </p>
                  </>
                ) : null}
                {selected.type === "footer" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Company name</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.companyName || ""}
                        onChange={(e) => updateSelectedProps({ companyName: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Contact email</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.contactEmail || ""}
                        onChange={(e) => updateSelectedProps({ contactEmail: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Copyright</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.copyrightText || ""}
                        onChange={(e) => updateSelectedProps({ copyrightText: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Background</span>
                      <input
                        type="color"
                        className="h-9 w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E]"
                        value={selected.props.backgroundColor || "#111111"}
                        onChange={(e) =>
                          updateSelectedProps({ backgroundColor: e.target.value })
                        }
                      />
                    </label>
                  </>
                ) : null}
                {selected.type === "lead_form" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Form Title</span>
                      <input
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.title || ""}
                        onChange={(e) => updateSelectedProps({ title: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormOpen(true)}
                      className="w-full cursor-pointer rounded-lg bg-brand py-2 font-bold !text-brand-foreground"
                    >
                      Open Lead Form Builder
                    </button>
                  </>
                ) : null}
                {["section", "container", "two_column", "three_column", "columns"].includes(
                  selected.type
                ) ? (
                  <>
                    {selected.type === "columns" ? (
                      <label className="block space-y-1">
                        <span className="text-[#888]">Column count</span>
                        <select
                          className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                          value={getLayoutColumns(selected).length}
                          onChange={(e) => setColumnCount(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n} column{n > 1 ? "s" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="block space-y-1">
                      <span className="text-[#888]">Column gap (px)</span>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                        value={selected.props.gap ?? 16}
                        onChange={(e) =>
                          updateSelectedProps({ gap: Number(e.target.value) })
                        }
                      />
                    </label>
                    <p className="text-xs text-[#555]">
                      Use Add Element inside each column to add logo, image, button, social icons, footer, and more.
                    </p>
                    <label className="block space-y-1">
                      <span className="text-[#888]">Background</span>
                      <input
                        type="color"
                        className="h-9 w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E]"
                        value={
                          selected.props.background?.startsWith("#")
                            ? selected.props.background
                            : "#ffffff"
                        }
                        onChange={(e) =>
                          updateSelectedProps({ background: e.target.value })
                        }
                      />
                    </label>
                    <PaddingEditor
                      padding={selected.props.padding}
                      onChange={(padding) => updateSelectedProps({ padding })}
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-500/40 py-2 text-sm text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete module
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#888]">Select a module on the canvas</p>
            )
          ) : null}

          {propsTab === "page" ? (
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-[#888]">Page name</span>
                <input
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                  value={page.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const next: CmsPage = { ...page, name };
                    if (isDefaultSlug(page.slug)) {
                      next.slug = slugifyClient(name);
                    }
                    setPage(next);
                  }}
                  onBlur={(e) => {
                    const name = e.currentTarget.value.trim() || page.name;
                    const patch: Partial<CmsPage> = { name };
                    if (isDefaultSlug(page.slug) || page.slug === slugifyClient(page.name)) {
                      patch.slug = slugifyClient(name);
                    }
                    void persist(content, patch);
                  }}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[#888]">URL slug</span>
                <div className="flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2">
                  <span className="text-xs text-[#555]">/p/</span>
                  <input
                    className="w-full bg-transparent py-2 outline-none"
                    value={page.slug}
                    onChange={(e) => setPage({ ...page, slug: e.target.value })}
                    onBlur={() => persist(content, { slug: page.slug })}
                  />
                </div>
              </label>
              <label className="block space-y-1">
                <span className="text-[#888]">Meta description</span>
                <textarea
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                  rows={3}
                  value={page.metaDescription || ""}
                  onChange={(e) => setPage({ ...page, metaDescription: e.target.value })}
                  onBlur={() =>
                    persist(content, { metaDescription: page.metaDescription })
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => setDomainOpen(true)}
                className="w-full cursor-pointer rounded-lg border border-[#2A2A2A] py-2 text-white"
              >
                Connect Domain
              </button>
            </div>
          ) : null}

          {propsTab === "seo" ? (
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-[#888]">SEO title</span>
                <input
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                  value={page.metaTitle || ""}
                  onChange={(e) => setPage({ ...page, metaTitle: e.target.value })}
                  onBlur={() => persist(content, { metaTitle: page.metaTitle })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[#888]">Meta description</span>
                <textarea
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                  rows={3}
                  value={page.metaDescription || ""}
                  onChange={(e) => setPage({ ...page, metaDescription: e.target.value })}
                  onBlur={() =>
                    persist(content, { metaDescription: page.metaDescription })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[#888]">OG image URL</span>
                <input
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-2 py-2"
                  value={page.ogImageUrl || ""}
                  onChange={(e) => setPage({ ...page, ogImageUrl: e.target.value })}
                  onBlur={() => persist(content, { ogImageUrl: page.ogImageUrl })}
                />
              </label>
            </div>
          ) : null}
        </aside>
      </div>

      <LeadFormBuilderModal
        open={formOpen}
        form={form}
        onClose={() => setFormOpen(false)}
        onSave={async (next) => {
          if (!form) return;
          const { form: updated } = await updateCmsForm(form.id, next);
          setForm(updated);
          toast.success("Form saved");
        }}
      />
      <DomainSettingsModal
        open={domainOpen}
        pageSlug={page.slug}
        onClose={() => setDomainOpen(false)}
      />
      <CrmFunnelMapping
        open={crmOpen}
        page={page}
        formFields={form?.fields || []}
        onClose={() => setCrmOpen(false)}
        onPageUpdate={setPage}
      />

      {previewOpen ? (
        <div className="fixed inset-0 z-[110] flex flex-col bg-[#f5f5f5]">
          <div className="flex items-center justify-between bg-[#141414] px-4 py-3 text-white">
            <span className="text-sm">
              Preview — <span className="text-brand">/p/{page.slug}</span>
            </span>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="cursor-pointer rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-sm text-white"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-auto py-8">
            <PageRenderer content={content} form={form} interactive width={deviceWidth(device)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
