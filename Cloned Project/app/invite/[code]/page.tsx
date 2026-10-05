"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Users, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type InvitePreview = {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  memberCount: number;
  expired: boolean;
  expiresAt: string | null;
};

const TOAST_STYLE = {
  background: "#1a1a22",
  border: "1px solid var(--brand-2)",
  color: "#fff",
} as const;

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const code = params?.code;
  const router = useRouter();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await api<InvitePreview>(`/groups/invite/${code}`);
        setPreview(res);
      } catch (e: any) {
        const msg = e?.message || "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          setErrorMsg("This invite link is not valid.");
        } else {
          setErrorMsg("Unable to load invite. Try again later.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const handleJoin = async () => {
    if (!code) return;
    if (!authed) {
      router.push(`/login?redirect=${encodeURIComponent(`/invite/${code}`)}`);
      return;
    }
    setJoining(true);
    try {
      const res = await api<{ ok: boolean; groupId: string; alreadyMember: boolean }>(
        `/groups/invite/${code}/join`,
        { method: "POST", body: JSON.stringify({}) },
        getToken()!
      );
      setJoined(true);
      toast.success(
        res.alreadyMember
          ? `You're already a member of ${preview?.name}.`
          : `Joined ${preview?.name}.`,
        { style: TOAST_STYLE }
      );
      // Dashboard layout listens for this event and opens the group in chat.
      try {
        window.dispatchEvent(
          new CustomEvent("notification:open-group", {
            detail: { groupId: res.groupId },
          })
        );
      } catch {}
      setTimeout(() => router.push("/workspace"), 600);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("410") || msg.toLowerCase().includes("expired")) {
        setErrorMsg("This invite link has expired.");
      } else {
        toast.error("Could not join the group. Please try again.", {
          style: TOAST_STYLE,
        });
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-[#141418] border border-[#2a2a35] rounded-xl p-6 shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#6E6E6E]">
            <Loader2 className="h-6 w-6 animate-spin mb-3" />
            <div className="text-sm">Loading invite…</div>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center text-center py-6">
            <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
            <div className="text-base font-medium text-white mb-1">
              Invite unavailable
            </div>
            <div className="text-sm text-[#9fa0b8] mb-6">{errorMsg}</div>
            <Button
              onClick={() => router.push("/workspace")}
              variant="ghost"
              className="text-brand-2 hover:text-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] hover:bg-[#1a1a22]"
            >
              Back to Garage
            </Button>
          </div>
        ) : preview?.expired ? (
          <div className="flex flex-col items-center text-center py-6">
            <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
            <div className="text-base font-medium text-white mb-1">
              Link expired
            </div>
            <div className="text-sm text-[#9fa0b8] mb-6">
              This invite link is no longer valid. Ask an admin for a new one.
            </div>
            <Button
              onClick={() => router.push("/workspace")}
              variant="ghost"
              className="text-brand-2 hover:text-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] hover:bg-[#1a1a22]"
            >
              Back to Garage
            </Button>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center text-center">
            <Avatar className="w-20 h-20 mb-4 border-2 border-[#2a2a35]">
              <AvatarImage src={preview.picture || undefined} />
              <AvatarFallback className="text-2xl text-brand-foreground font-semibold bg-gradient-to-br from-brand to-brand-2">
                {preview.name?.charAt(0)?.toUpperCase() || "G"}
              </AvatarFallback>
            </Avatar>
            <div className="text-xs uppercase tracking-wider text-[#9fa0b8] mb-1">
              You're invited to join
            </div>
            <div className="text-xl font-semibold text-white mb-1">
              {preview.name}
            </div>
            {preview.description && (
              <div className="text-sm text-[#9fa0b8] mb-3 line-clamp-3">
                {preview.description}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-[#6E6E6E] mb-6">
              <Users className="h-3.5 w-3.5" />
              {preview.memberCount}{" "}
              {preview.memberCount === 1 ? "member" : "members"}
            </div>

            <Button
              onClick={handleJoin}
              disabled={joining || joined}
              className="w-full bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] text-brand-foreground font-semibold disabled:opacity-60"
            >
              {joined ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Joined
                </>
              ) : joining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining…
                </>
              ) : authed ? (
                "Join Group"
              ) : (
                "Sign in to Join"
              )}
            </Button>

            {!authed && (
              <div className="text-[11px] text-[#6E6E6E] mt-3">
                You'll be brought back here after signing in.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
