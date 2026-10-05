"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { InlinePostComposer } from "./InlinePostComposer";

interface MobileCreatePostPageProps {
  channels: {
    channelId: string;
    channelTitle: string;
    logo?: string | null;
    memberCount?: number;
  }[];
  orgId: string;
  user: {
    name: string;
    email?: string;
    profilePicture?: string;
  };
  onPostCreated: () => void;
  onClose: () => void;
  teamMembers?: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  }[];
  existingTags?: string[];
}

export function MobileCreatePostPage({
  channels,
  orgId,
  user,
  onPostCreated,
  onClose,
  teamMembers,
  existingTags,
}: MobileCreatePostPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while page is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Notify dashboard layout to hide mobile sticky footer
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("feed:mobile-composer-visibility", {
        detail: { visible: true },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("feed:mobile-composer-visibility", {
          detail: { visible: false },
        })
      );
    };
  }, []);

  // Adjust container height when mobile keyboard opens (iOS Safari)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const initialHeight = vv.height;

    function onViewportChange() {
      if (!containerRef.current) return;
      const el = containerRef.current;
      const keyboardOpen = vv!.height < initialHeight - 50;
      if (keyboardOpen) {
        el.style.height = `${vv!.height}px`;
        el.style.top = `${vv!.offsetTop}px`;
      } else {
        el.style.height = "";
        el.style.top = "";
      }
    }

    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    return () => {
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
      if (containerRef.current) {
        containerRef.current.style.height = "";
        containerRef.current.style.top = "";
      }
    };
  }, []);

  const handlePostCreated = () => {
    onPostCreated();
    onClose();
  };

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9500] bg-[#16181C] h-[100dvh]"
    >
      <InlinePostComposer
        renderAsPage
        channels={channels}
        orgId={orgId}
        user={user}
        onPostCreated={handlePostCreated}
        onCancel={onClose}
        teamMembers={teamMembers}
        existingTags={existingTags}
      />
    </div>,
    document.body
  );
}
