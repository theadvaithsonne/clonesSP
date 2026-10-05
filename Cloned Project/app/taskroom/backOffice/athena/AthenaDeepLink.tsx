"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useUserStore } from '@/store/athena/userStore';
import {
  clearOrgId,
  clearToken,
  getToken,
  getUserDataFromToken,
  isAuthenticated,
  saveOrgId,
  saveToken,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import InlineLoginModal from "./InlineLoginModal";

type GateState =
  | { kind: "checking" }
  | { kind: "needs-login" }
  | { kind: "wrong-org"; signedInEmail?: string | null }
  | { kind: "not-a-member" }
  | { kind: "bad-url"; missing: string[] }
  | { kind: "redirecting" };

export default function AthenaDeepLink() {
  const router = useRouter();
  const sp = useSearchParams();

  const orgId = sp.get("orgId");
  const workspaceId = sp.get("workspaceId");
  const spaceId = sp.get("spaceId");
  const roomId = sp.get("roomId");
  const shareTask = sp.get("shareTask");

  // Client-side OG parsing and meta tag injection so the page title/OG tags
  // are set when the link is opened in a browser (helps previews when possible).
  const parseOgPayloadClient = (value: string | null) => {
    if (!value) return null;
    try {
      let decoded = value;
      for (let i = 0; i < 3; i++) {
        try {
          const parsed = JSON.parse(decoded);
          return parsed as { title?: string; description?: string; assignedBy?: string; assignedTo?: string[] };
        } catch (err) {
          try {
            decoded = decodeURIComponent(decoded);
          } catch (e) {
            break;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const raw = sp.get("og");
    const og = parseOgPayloadClient(raw);
    if (!og) return;

    const taskName = og.title || "";
    const assignedBy = og.assignedBy || "Someone";
    const assignees = (og.assignedTo || []).join(", ") || "someone";
    const title = `${assignedBy} assigned \"${taskName}\" to ${assignees}`;

    // Set document title
    try {
      document.title = title;
    } catch {}

    // Helper to upsert meta tags
    const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
      try {
        let el = document.querySelector(`meta[${attr}='${key}']`) as HTMLMetaElement | null;
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attr, key);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      } catch (e) {
        // ignore
      }
    };

    upsertMeta("property", "og:title", title);
    if (og.description) upsertMeta("property", "og:description", og.description);
    upsertMeta("name", "twitter:title", title);
    if (og.description) upsertMeta("name", "twitter:description", og.description);
  }, [sp]);

  const [state, setState] = useState<GateState>({ kind: "checking" });
  const [recheckTick, setRecheckTick] = useState(0);
  const fetchUserProfile = useUserStore((state) => state.fetchUserProfile);

  const runGate = useCallback(async () => {
    const missing: string[] = [];
    if (!workspaceId) missing.push("workspaceId");
    if (!shareTask) missing.push("shareTask");
    if (missing.length > 0) {
      setState({ kind: "bad-url", missing });
      return;
    }

    if (!isAuthenticated()) {
      setState({ kind: "needs-login" });
      return;
    }

    const jwt = getUserDataFromToken();

    if (orgId && jwt.orgId && jwt.orgId !== orgId) {
      try {
        const selectResponse = await api<{
          token: string;
          currentOrg: { id: string };
        }>("/auth/select-org", {
          method: "POST",
          body: JSON.stringify({ userId: jwt.userId, orgId }),
        });
        saveToken(selectResponse.token);
        saveOrgId(selectResponse.currentOrg.id);
      } catch {
        setState({ kind: "wrong-org", signedInEmail: jwt.email });
        return;
      }
    }

    try {
      const token = getToken();
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspaces/${workspaceId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const ws = res?.data?.data;
      if (!ws || (ws._id && ws._id !== workspaceId)) {
        setState({ kind: "not-a-member" });
        return;
      }
    } catch {
      setState({ kind: "not-a-member" });
      return;
    }

    try {
      await fetchUserProfile();
      const profileLoaded = useUserStore.getState().isUserProfileFetched;
      if (!profileLoaded) {
        throw new Error("Failed to fetch user profile before redirect");
      }
    } catch (err) {
      console.error("Failed to fetch user profile before redirect:", err);
      setState({ kind: "needs-login" });
      return;
    }

    setState({ kind: "redirecting" });
    const params = new URLSearchParams();
    params.set("workspaceId", workspaceId!);
    if (spaceId) params.set("spaceId", spaceId);
    if (roomId) params.set("roomId", roomId);
    if (shareTask) params.set("shareTask", shareTask);
    router.replace(`/workspace?${params.toString()}`);
  }, [orgId, workspaceId, spaceId, roomId, shareTask, router]);

  useEffect(() => {
    runGate();
  }, [runGate, recheckTick]);

  function handleSignOut() {
    clearToken();
    clearOrgId();
    if (typeof document !== "undefined") {
      document.cookie =
        "auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      document.cookie =
        "user-data=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }
    toast.success("Signed out");
    setState({ kind: "checking" });
    setRecheckTick((n) => n + 1);
  }

  if (state.kind === "checking" || state.kind === "redirecting") {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3 text-[#9fa0b8]">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm">
            {state.kind === "checking"
              ? "Verifying access…"
              : "Opening Athena…"}
          </p>
        </div>
      </FullScreen>
    );
  }

  if (state.kind === "bad-url") {
    return (
      <FullScreen>
        <ErrorCard
          title="This link is incomplete"
          body={
            <>
              Required parameter{state.missing.length > 1 ? "s" : ""}{" "}
              <code className="text-primary">{state.missing.join(", ")}</code>{" "}
              missing. Ask whoever shared the link to copy it again.
            </>
          }
        />
      </FullScreen>
    );
  }

  if (state.kind === "wrong-org") {
    return (
      <FullScreen>
        <ErrorCard
          title="This link is for a different organization"
          body={
            <>
              You&apos;re signed in
              {state.signedInEmail ? (
                <>
                  {" "}
                  as{" "}
                  <span className="text-primary">{state.signedInEmail}</span>
                </>
              ) : null}
              , which doesn&apos;t have access to this workspace. Sign out and
              continue with the account this link was shared with.
            </>
          }
          action={
            <Button onClick={handleSignOut} className="w-full">
              Sign out and try again
            </Button>
          }
        />
      </FullScreen>
    );
  }

  if (state.kind === "not-a-member") {
    return (
      <FullScreen>
        <ErrorCard
          title="You don’t have access to this workspace"
          body="Your account is signed in to the correct organization, but you haven’t been added to this workspace yet. Ask the link’s owner to invite you."
          action={
            <Button onClick={handleSignOut} variant="secondary" className="w-full">
              Sign out
            </Button>
          }
        />
      </FullScreen>
    );
  }

  // needs-login
  return (
    <FullScreen>
      <div className="text-center text-[#9fa0b8]">
        <h1 className="text-xl text-white font-semibold mb-2">
          Sign in to open this task
        </h1>
        <p className="text-sm">
          This link opens a shared Athena task. Sign in with the account it was
          shared with.
        </p>
      </div>
      <InlineLoginModal
        open
        targetOrgId={orgId}
        onAuthenticated={(outcome) => {
          if (outcome.kind === "wrong-org") {
            setState({ kind: "wrong-org", signedInEmail: outcome.userEmail });
            return;
          }
          setState({ kind: "checking" });
          setRecheckTick((n) => n + 1);
        }}
      />
    </FullScreen>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center px-4">
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(900px_500px_at_30%_-10%,rgba(138,43,226,0.15),transparent_60%),radial-gradient(700px_400px_at_90%_120%,rgba(75,0,130,0.15),transparent_60%)]"
      />
      <div className="relative z-10 flex flex-col items-center gap-6">
        {children}
      </div>
    </div>
  );
}

function ErrorCard({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-xl border border-border/20 bg-[#0C0C0E]/90 backdrop-blur-xl p-6 space-y-4">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <p className="text-sm text-[#9fa0b8] leading-relaxed">{body}</p>
      {action}
    </div>
  );
}
