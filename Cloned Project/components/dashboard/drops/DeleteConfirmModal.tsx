"use client";

import { Trash2, Loader2 } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  title = "Delete this drop?",
  message = "This can't be undone.",
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(320px, 88vw)",
          background: "#161620",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          overflow: "hidden",
          animation: "dcmIn 0.15s ease-out",
        }}
      >
        <style>{`@keyframes dcmIn{0%{opacity:0;transform:scale(.97)}100%{opacity:1;transform:scale(1)}}`}</style>

        {/* Content */}
        <div style={{ padding: "20px 20px 16px", textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", color: "white", fontSize: 15, fontWeight: 600 }}>{title}</p>
          <p style={{ margin: 0, color: "#6b6b80", fontSize: 13 }}>{message}</p>
        </div>

        {/* Divider + buttons */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              width: "100%", padding: "13px",
              background: "transparent", border: "none",
              color: "#ef4444", fontSize: 15, fontWeight: 600,
              cursor: isDeleting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: isDeleting ? 0.5 : 1,
              transition: "background 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              width: "100%", padding: "13px",
              background: "transparent", border: "none",
              color: "#9fa0b8", fontSize: 14, fontWeight: 400,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
