// Garage 2.0-frontend/lib/chat-context.tsx

"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { connectSocket } from "@/lib/socket";
import { dmConvId, groupConvId, globalDmConvId } from "@/lib/conv";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { requestBellRefresh } from "@/lib/bell-refresh";

type MapT = Record<string, number>;
type TimestampMapT = Record<string, number>; // userId/groupId -> timestamp

type Ctx = {
  activeConvId?: string;
  setActiveConvId: (id?: string) => void;
  dmUnread: MapT;
  groupUnread: MapT;
  /** Groups whose unread messages @-mention me — the WhatsApp-style "@" badge. */
  groupMentioned: Record<string, boolean>;
  globalDmUnread: MapT;
  dmLastMessageTime: TimestampMapT;
  groupLastMessageTime: TimestampMapT;
  globalDmLastMessageTime: TimestampMapT;
  dmLastMessageText: Record<string, string>;
  groupLastMessageText: Record<string, string>;
  globalDmLastMessageText: Record<string, string>;
  clearDmUnread: (otherId: string) => void;
  clearGroupUnread: (groupId: string) => void;
  clearGlobalDmUnread: (otherId: string) => void;
  draftTexts: Record<string, string>;
  setDraftTexts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  draftFiles: Record<string, File[]>;
  setDraftFiles: React.Dispatch<React.SetStateAction<Record<string, File[]>>>;
};

const ChatCtx = createContext<Ctx | null>(null);
export const useChat = () => {
  const v = useContext(ChatCtx);
  if (!v) throw new Error("useChat must be used within ChatProvider");
  return v;
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const meId = getUserIdFromToken()!;
  const [activeConvId, setActiveConvId] = useState<string | undefined>();
  const [dmUnread, setDmUnread] = useState<MapT>({});
  const [groupUnread, setGroupUnread] = useState<MapT>({});
  const [groupMentioned, setGroupMentioned] = useState<Record<string, boolean>>({});
  const [globalDmUnread, setGlobalDmUnread] = useState<MapT>({});
  const [dmLastMessageTime, setDmLastMessageTime] = useState<TimestampMapT>({});
  const [groupLastMessageTime, setGroupLastMessageTime] =
    useState<TimestampMapT>({});
  const [globalDmLastMessageTime, setGlobalDmLastMessageTime] =
    useState<TimestampMapT>({});
  const [dmLastMessageText, setDmLastMessageText] = useState<Record<string, string>>({});
  const [groupLastMessageText, setGroupLastMessageText] = useState<Record<string, string>>({});
  const [globalDmLastMessageText, setGlobalDmLastMessageText] = useState<Record<string, string>>({});
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [draftFiles, setDraftFiles] = useState<Record<string, File[]>>({});

  const seenRef = useRef<Set<string>>(new Set());
  const seen = (id: string) => seenRef.current.has(id);
  const remember = (id: string) => {
    const s = seenRef.current;
    s.add(id);
    if (s.size > 500) {
      const arr = Array.from(s);
      for (let i = 0; i < 100; i++) s.delete(arr[i]);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const orgId = localStorage.getItem("garage_org_id");

        // Fetch unread counts
        const dmUnreadUrl = orgId ? `/dm/unread?orgId=${orgId}` : "/dm/unread";
        const dm = await api<{ unread: { otherId: string; count: number }[] }>(
          dmUnreadUrl,
          {},
          getToken()!
        );
        const url = orgId
          ? `/groups/unread/all?orgId=${orgId}`
          : "/groups/unread/all";
        const g = await api<{
          groups: { groupId: string; count: number; mentioned?: boolean }[];
        }>(
          url,
          {},
          getToken()!
        );

        // Fetch last messages (including text & attachments metadata)
        const dmLastUrl = orgId
          ? `/dm/last-messages?orgId=${orgId}`
          : "/dm/last-messages";
        const dmTimestamps = await api<{
          conversations: { otherId: string; timestamp: number; text?: string; hasAttachments?: boolean }[];
        }>(dmLastUrl, {}, getToken()!);

        const groupUrl = orgId
          ? `/groups/last-messages?orgId=${orgId}`
          : "/groups/last-messages";
        const groupTimestamps = await api<{
          groups: { groupId: string; timestamp: number; text?: string; hasAttachments?: boolean }[];
        }>(groupUrl, {}, getToken()!);

        const dmMap: MapT = {};
        dm.unread?.forEach((r) => (dmMap[r.otherId] = r.count));
        const gMap: MapT = {};
        g.groups?.forEach((r) => (gMap[r.groupId] = r.count));
        // `mentioned`: some unread message in the group @-mentions me.
        const gMentioned: Record<string, boolean> = {};
        g.groups?.forEach((r) => {
          if (r.mentioned) gMentioned[r.groupId] = true;
        });

        const dmTimeMap: TimestampMapT = {};
        const dmTextMap: Record<string, string> = {};
        dmTimestamps.conversations?.forEach((r) => {
          dmTimeMap[r.otherId] = r.timestamp;
          dmTextMap[r.otherId] = r.hasAttachments ? "Sent an attachment" : (r.text || "");
        });
        const groupTimeMap: TimestampMapT = {};
        const groupTextMap: Record<string, string> = {};
        groupTimestamps.groups?.forEach((r: any) => {
          groupTimeMap[r.groupId] = r.timestamp;
          const bodyText = r.hasAttachments ? "Sent an attachment" : (r.text || "");
          let prefix = "";
          if (r.from) {
            prefix = r.from === meId ? "You: " : (r.fromName ? `${r.fromName}: ` : "");
          }
          groupTextMap[r.groupId] = prefix + bodyText;
        });

        setDmUnread(dmMap);
        setGroupUnread(gMap);
        setGroupMentioned(gMentioned);
        setDmLastMessageTime(dmTimeMap);
        setDmLastMessageText(dmTextMap);
        setGroupLastMessageTime(groupTimeMap);
        setGroupLastMessageText(groupTextMap);

        // Fetch global DM data (not org-scoped)
        try {
          const globalDm = await api<{ unread: { otherId: string; count: number }[] }>(
            "/global-dm/unread",
            {},
            getToken()!
          );
          const globalDmTimestamps = await api<{
            conversations: { otherId: string; timestamp: number; text?: string; hasAttachments?: boolean }[];
          }>("/global-dm/last-messages", {}, getToken()!);

          const globalDmMap: MapT = {};
          globalDm.unread?.forEach((r) => (globalDmMap[r.otherId] = r.count));
          const globalDmTimeMap: TimestampMapT = {};
          const globalDmTextMap: Record<string, string> = {};
          globalDmTimestamps.conversations?.forEach((r) => {
            globalDmTimeMap[r.otherId] = r.timestamp;
            globalDmTextMap[r.otherId] = r.hasAttachments ? "Sent an attachment" : (r.text || "");
          });

          setGlobalDmUnread(globalDmMap);
          setGlobalDmLastMessageTime(globalDmTimeMap);
          setGlobalDmLastMessageText(globalDmTextMap);
        } catch (globalDmError) {
          console.error("[ChatContext] Error loading global DM data:", globalDmError);
        }
      } catch (error) {
        console.error("[ChatContext] Error loading chat data:", error);
      }
    })();

    const onOrgSwitched = () => {
      setActiveConvId(undefined);
      setDmUnread({});
      setGroupUnread({});
      setGroupMentioned({});
      setDmLastMessageTime({});
      setDmLastMessageText({});
      setGroupLastMessageTime({});
      setGroupLastMessageText({});
      seenRef.current.clear();
    };

    window.addEventListener("org:switched", onOrgSwitched as any);
    return () => {
      window.removeEventListener("org:switched", onOrgSwitched as any);
    };
  }, []);

  useEffect(() => {
    const s = connectSocket();

    const onDm = (m: {
      _id: string;
      convId: string;
      from: string;
      to: string;
      text?: string;
      attachments?: any[];
      createdAt?: string;
    }) => {
      if (seen(m._id)) return;
      remember(m._id);

      const otherId = m.from === meId ? m.to : m.from;
      const timestamp = m.createdAt ? new Date(m.createdAt).getTime() : Date.now();
      setDmLastMessageTime((prev) => ({ ...prev, [otherId]: timestamp }));
      
      const txt = m.attachments && m.attachments.length > 0 ? "Sent an attachment" : (m.text || "");
      setDmLastMessageText((prev) => ({ ...prev, [otherId]: txt }));

      if (m.to !== meId) return;
      const conv = dmConvId(meId, m.from);
      if (conv === activeConvId) return;
      setDmUnread((prev) => ({ ...prev, [m.from]: (prev[m.from] || 0) + 1 }));
      // Same as groups: the bell entry exists already, so show it now.
      requestBellRefresh();
    };

    const onGroup = (m: {
      _id: string;
      groupId: string;
      from: string;
      fromName?: string;
      type?: "system";
      text?: string;
      attachments?: any[];
      mentions?: string[];
      createdAt: string;
    }) => {
      if (seen(m._id)) return;
      remember(m._id);

      // Group events ("X added Y") aren't conversation. The server leaves them
      // out of previews and unread counts, so the live path must as well —
      // otherwise the badge and preview change until the next reload.
      if (m.type === "system") return;

      const timestamp = m.createdAt ? new Date(m.createdAt).getTime() : Date.now();
      setGroupLastMessageTime((prev) => ({ ...prev, [m.groupId]: timestamp }));
      
      const bodyText = m.attachments && m.attachments.length > 0 ? "Sent an attachment" : (m.text || "");
      let prefix = "";
      if (m.from) {
        prefix = m.from === meId ? "You: " : (m.fromName ? `${m.fromName}: ` : "");
      }
      setGroupLastMessageText((prev) => ({ ...prev, [m.groupId]: prefix + bodyText }));

      if (m.from === meId) return;
      const conv = groupConvId(m.groupId);
      if (conv === activeConvId) return;
      setGroupUnread((prev) => ({
        ...prev,
        [m.groupId]: (prev[m.groupId] || 0) + 1,
      }));
      // The server writes the message's bell notification before sending it,
      // so the bell can show it now instead of on its 30s poll. (Not for the
      // open group — that one is read, and its entry cleared, on arrival.)
      requestBellRefresh();
      if (m.mentions?.includes(meId)) {
        setGroupMentioned((prev) =>
          prev[m.groupId] ? prev : { ...prev, [m.groupId]: true }
        );
      }
    };

    const onDmRead = (data: { otherId: string; convId: string }) => {
      setDmUnread((prev) => {
        if (!prev[data.otherId]) return prev;
        const n = { ...prev };
        delete n[data.otherId];
        return n;
      });
    };

    const onGroupRead = (data: { groupId: string; lastReadAt: string }) => {
      setGroupUnread((prev) => {
        if (!prev[data.groupId]) return prev;
        const n = { ...prev };
        delete n[data.groupId];
        return n;
      });
      setGroupMentioned((prev) => {
        if (!prev[data.groupId]) return prev;
        const n = { ...prev };
        delete n[data.groupId];
        return n;
      });
    };

    const onGlobalDm = (m: {
      _id: string;
      convId: string;
      from: string;
      to: string;
      text?: string;
      attachments?: any[];
      createdAt?: string;
    }) => {
      if (seen(m._id)) return;
      remember(m._id);

      const otherId = m.from === meId ? m.to : m.from;
      const timestamp = m.createdAt ? new Date(m.createdAt).getTime() : Date.now();
      setGlobalDmLastMessageTime((prev) => ({ ...prev, [otherId]: timestamp }));
      
      const txt = m.attachments && m.attachments.length > 0 ? "Sent an attachment" : (m.text || "");
      setGlobalDmLastMessageText((prev) => ({ ...prev, [otherId]: txt }));

      if (m.to !== meId) return;
      const conv = globalDmConvId(meId, m.from);
      if (conv === activeConvId) return;
      setGlobalDmUnread((prev) => ({ ...prev, [m.from]: (prev[m.from] || 0) + 1 }));
    };

    const onGlobalDmRead = (data: { otherId: string; convId: string }) => {
      setGlobalDmUnread((prev) => {
        if (!prev[data.otherId]) return prev;
        const n = { ...prev };
        delete n[data.otherId];
        return n;
      });
    };

    s.on("dm:message", onDm);
    s.on("group:message", onGroup);
    s.on("dm:read", onDmRead);
    s.on("group:read", onGroupRead);
    s.on("global-dm:message", onGlobalDm);
    s.on("global-dm:read", onGlobalDmRead);
    return () => {
      s.off("dm:message", onDm);
      s.off("group:message", onGroup);
      s.off("dm:read", onDmRead);
      s.off("group:read", onGroupRead);
      s.off("global-dm:message", onGlobalDm);
      s.off("global-dm:read", onGlobalDmRead);
    };
  }, [meId, activeConvId]);

  const clearDmUnread = useCallback((otherId: string) => {
    setDmUnread((prev) => {
      if (!prev[otherId]) return prev;
      const n = { ...prev };
      delete n[otherId];
      return n;
    });
  }, []);

  const clearGroupUnread = useCallback((groupId: string) => {
    setGroupUnread((prev) => {
      if (!prev[groupId]) return prev;
      const n = { ...prev };
      delete n[groupId];
      return n;
    });
    setGroupMentioned((prev) => {
      if (!prev[groupId]) return prev;
      const n = { ...prev };
      delete n[groupId];
      return n;
    });
  }, []);

  const clearGlobalDmUnread = useCallback((otherId: string) => {
    setGlobalDmUnread((prev) => {
      if (!prev[otherId]) return prev;
      const n = { ...prev };
      delete n[otherId];
      return n;
    });
  }, []);

  const value = useMemo(
    () => ({
      activeConvId,
      setActiveConvId,
      dmUnread,
      groupUnread,
      groupMentioned,
      globalDmUnread,
      dmLastMessageTime,
      groupLastMessageTime,
      globalDmLastMessageTime,
      dmLastMessageText,
      groupLastMessageText,
      globalDmLastMessageText,
      clearDmUnread,
      clearGroupUnread,
      clearGlobalDmUnread,
      draftTexts,
      setDraftTexts,
      draftFiles,
      setDraftFiles,
    }),
    [
      activeConvId,
      dmUnread,
      groupUnread,
      groupMentioned,
      globalDmUnread,
      dmLastMessageTime,
      groupLastMessageTime,
      globalDmLastMessageTime,
      dmLastMessageText,
      groupLastMessageText,
      globalDmLastMessageText,
      clearDmUnread,
      clearGroupUnread,
      clearGlobalDmUnread,
      draftTexts,
      draftFiles,
    ]
  );

  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}
