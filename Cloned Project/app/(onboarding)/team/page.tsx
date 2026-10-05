"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Shell from "@/components/Layout/Shell";
import { Button } from "@/components/ui/button";

type Row = { email: string; role: "admin" | "user" };

export default function TeamInvitePage() {
  const [rows, setRows] = useState<Row[]>([{ email: "", role: "user" }]);
  const router = useRouter();

  function addRow() {
    setRows((r) => [...r, { email: "", role: "user" }]);
  }
  function update(i: number, patch: Partial<Row>) {
    setRows((r) => {
      const c = [...r];
      c[i] = { ...c[i], ...patch };
      return c;
    });
  }

  async function sendInvites() {
    const members = rows.filter((r) => r.email);
    if (members.length) {
      await api(
        `/invites/create`,
        { method: "POST", body: JSON.stringify({ members }) },
        getToken()! // <-- force admin token here
      );
    }
    router.push("/dashboard");
  }

  return (
    <Shell>
      <div className="glass-max max-w-2xl mx-auto p-4 sm:p-6 rounded-xl border border-[var(--border)]">
        <h1 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Invite your team</h1>
        <div className="space-y-2.5 sm:space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <input
                className="sm:col-span-2 rounded-md px-3 py-2 bg-[var(--input)]/20 border border-[var(--border)] text-sm sm:text-base"
                placeholder="teammate@company.com"
                value={r.email}
                onChange={(e) => update(i, { email: e.target.value })}
              />
              <select
                className="rounded-md px-3 py-2 bg-[var(--input)]/20 border border-[var(--border)] text-sm sm:text-base"
                value={r.role}
                onChange={(e) => update(i, { role: e.target.value as any })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-4">
          <Button variant="outline" onClick={addRow} className="text-sm sm:text-base">
            Add another
          </Button>
          <Button onClick={sendInvites} className="text-sm sm:text-base">Send invites</Button>
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-2 sm:mt-3">
          Each person will receive an OTP to join.
        </p>
      </div>
    </Shell>
  );
}
