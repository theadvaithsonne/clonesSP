"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useCallback } from "react";

export type ConnectionState =
  | "connected"
  | "disconnected"
  | "presence_expired"
  | "reconnecting";

interface DisconnectedOverlayProps {
  connectionState: ConnectionState;
  onReconnect: () => void;
  isReconnecting: boolean;
}

// Animated WiFi/Signal Icon Component
function SignalIcon({ isReconnecting }: { isReconnecting: boolean }) {
  return (
    <div className="relative w-16 h-16">
      {/* Signal waves - animate when reconnecting */}
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer arc */}
        <path
          d="M12 28C12 28 20 16 32 16C44 16 52 28 52 28"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className={cn(
            "transition-opacity duration-500",
            isReconnecting
              ? "text-amber-400 animate-pulse"
              : "text-zinc-600"
          )}
        />
        {/* Middle arc */}
        <path
          d="M18 36C18 36 23 28 32 28C41 28 46 36 46 36"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className={cn(
            "transition-opacity duration-500",
            isReconnecting
              ? "text-amber-400 animate-pulse [animation-delay:150ms]"
              : "text-zinc-600"
          )}
        />
        {/* Inner arc */}
        <path
          d="M24 44C24 44 27 40 32 40C37 40 40 44 40 44"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className={cn(
            "transition-opacity duration-500",
            isReconnecting
              ? "text-amber-400 animate-pulse [animation-delay:300ms]"
              : "text-zinc-600"
          )}
        />
        {/* Center dot */}
        <circle
          cx="32"
          cy="50"
          r="3"
          className={cn(
            "transition-colors duration-300",
            isReconnecting ? "fill-amber-400" : "fill-zinc-500"
          )}
        />
        {/* X mark when disconnected (not reconnecting) */}
        {!isReconnecting && (
          <g className="text-red-400">
            <line
              x1="44"
              y1="8"
              x2="54"
              y2="18"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="54"
              y1="8"
              x2="44"
              y2="18"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

export function DisconnectedOverlay({
  connectionState,
  onReconnect,
  isReconnecting,
}: DisconnectedOverlayProps) {
  const isVisible = connectionState !== "connected";
  const showReconnecting = connectionState === "reconnecting" || isReconnecting;

  // Keyboard support - Enter to reconnect
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && isVisible && !showReconnecting) {
        onReconnect();
      }
    },
    [isVisible, showReconnecting, onReconnect]
  );

  useEffect(() => {
    if (isVisible) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isVisible, handleKeyDown]);

  const getMessage = () => {
    switch (connectionState) {
      case "disconnected":
        return {
          title: "Connection Lost",
          description: "Unable to reach the workspace server.",
        };
      case "presence_expired":
        return {
          title: "You're Offline",
          description: "Your session timed out while you were away.",
        };
      case "reconnecting":
        return {
          title: "Reconnecting",
          description: "Restoring your connection...",
        };
      default:
        return {
          title: "Disconnected",
          description: "Click below to reconnect.",
        };
    }
  };

  const { title, description } = getMessage();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl"
          >
            <div className="flex flex-col items-center text-center">
              {/* Signal Icon */}
              <div className="mb-5">
                <SignalIcon isReconnecting={showReconnecting} />
              </div>

              {/* Title */}
              <h2 className="text-lg font-semibold text-zinc-100 mb-1">
                {title}
              </h2>

              {/* Description */}
              <p className="text-sm text-zinc-400 mb-6">{description}</p>

              {/* Reconnect Button */}
              <Button
                onClick={onReconnect}
                disabled={showReconnecting}
                className={cn(
                  "w-full h-11 text-sm font-medium rounded-lg transition-all duration-200",
                  showReconnecting
                    ? "bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    : "bg-zinc-100 text-zinc-900 hover:bg-white active:scale-[0.98]"
                )}
              >
                {showReconnecting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reconnecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Reconnect
                  </span>
                )}
              </Button>

              {/* Keyboard hint */}
              {!showReconnecting && (
                <p className="mt-4 text-xs text-zinc-600">
                  Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono text-[10px]">Enter</kbd> to reconnect
                </p>
              )}

              {/* Status indicator */}
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    showReconnecting
                      ? "bg-amber-500 animate-pulse"
                      : "bg-red-500"
                  )}
                />
                <span>
                  {showReconnecting ? "Attempting to reconnect" : "Offline"}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
