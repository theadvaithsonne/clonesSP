"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, Globe, Loader2, Plus, X, Folder } from "lucide-react";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { createFolder, type FolderScope } from "@/lib/docusign/shared-api";
import { MAX_FOLDER_NAME } from "@/components/dashboard/docusign/shared/FolderNameDialog";

// Radix Select can't hold an empty value, so "Global" and "New folder…" are sentinels.
const GLOBAL = "__global__";
const NEW_FOLDER = "__new__";

interface FolderSelectProps {
  // Which flow's folder set to show. Agreements and External keep separate folders, so a dialog
  // in one flow must never offer the other's.
  scope: FolderScope;
  // A folder id, or null for Global (no folder).
  value: string | null;
  onChange: (folderId: string | null) => void;
  disabled?: boolean;
  id?: string;
}

// Pick a folder, keep it Global, or create a folder on the spot. Reads the folder list from the store, so
// the caller only has to make sure it has been fetched (fetchFolders).
export function FolderSelect({ scope, value, onChange, disabled, id }: FolderSelectProps) {
  const { folders: internalFolders, externalFolders, maxFolders, fetchFolders } = useDocusignStore();
  const folders = scope === "external" ? externalFolders : internalFolders;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const atLimit = folders.length >= maxFolders;

  const handleCreate = async () => {
    const name = newName.replace(/\s+/g, " ").trim();
    if (!name || isSaving) return;
    setIsSaving(true);
    try {
      const res = await createFolder(name, scope);
      await fetchFolders(scope, { silent: true });
      onChange(res.data._id);
      setCreating(false);
      setNewName("");
    } catch (err: any) {
      toast.error(err.message || "Could not create the folder");
    } finally {
      setIsSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          aria-label="New folder name"
          maxLength={MAX_FOLDER_NAME}
          placeholder="New folder name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") setCreating(false);
          }}
          disabled={isSaving}
          className="h-9"
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleCreate} disabled={!newName.trim() || isSaving} aria-label="Create folder">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setCreating(false)} disabled={isSaving} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value ?? GLOBAL}
      onValueChange={(v) => {
        if (v === NEW_FOLDER) setCreating(true);
        else onChange(v === GLOBAL ? null : v);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="h-9" aria-label="Folder">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GLOBAL}>
          <span className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 shrink-0 text-[#7a7a90]" />
            Global (no folder)
          </span>
        </SelectItem>
        {folders.map((f) => (
          <SelectItem key={f._id} value={f._id}>
            <span className="flex items-center gap-2">
              <Folder className="h-3.5 w-3.5 shrink-0 text-[#7a7a90]" />
              {f.name}
            </span>
          </SelectItem>
        ))}
        {!atLimit && (
          <SelectItem value={NEW_FOLDER}>
            <span className="flex items-center gap-2 text-brand">
              <Plus className="h-3.5 w-3.5 shrink-0" />
              New folder…
            </span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
