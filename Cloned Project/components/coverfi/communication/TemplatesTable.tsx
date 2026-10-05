"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
} from "@/lib/coverfi/communication-api";
import type { EmailTemplate } from "@/lib/coverfi/types";
import { toast } from "sonner";

export default function TemplatesTable() {
  const router = useRouter();
  const [rows, setRows] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listTemplates());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onNew() {
    setCreating(true);
    try {
      const draft = await createTemplate({
        trigger_event_name: `new_template_${Date.now()}`,
        email_subject: "Untitled subject",
        email_content: "<p>Start writing here…</p>",
      });
      router.push(`/coverfi/communication/templates/${draft._id}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create template");
      setCreating(false);
    }
  }

  async function onDelete(t: EmailTemplate) {
    if (!confirm(`Delete template "${t.trigger_event_name}"?`)) return;
    try {
      await deleteTemplate(t._id);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Email templates</h2>
          <p className="text-sm text-[#9fa0b8]">
            Rich HTML messages keyed to trigger events.
          </p>
        </div>
        <Button onClick={onNew} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" />
          {creating ? "Creating…" : "New template"}
        </Button>
      </div>

      <div className="rounded-lg border border-[#222230] bg-[#0c0c12] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[#9fa0b8]">
                  No templates yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow key={t._id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/coverfi/communication/templates/${t._id}`}
                      className="font-medium hover:underline"
                    >
                      {t.trigger_event_name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {t.email_subject}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(t.variables || []).slice(0, 4).map((v) => (
                        <Badge
                          key={v}
                          variant="secondary"
                          className="text-[10px] font-mono"
                        >
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                      {(t.variables || []).length > 4 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{t.variables.length - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.is_active ? (
                      <Badge className="bg-brand/12 text-brand border-brand/25">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/coverfi/communication/templates/${t._id}`}
                      >
                        <Button size="icon" variant="ghost">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
