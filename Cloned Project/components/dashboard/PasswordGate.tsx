"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

const PASSWORD_HASH = "d1f857ec8fd273ead62a3c98f409b70423060570490ced82dece195d49aaf1f0";
const AUTH_STORAGE_KEY = "openclaw_password_authenticated";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

function usePasswordAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authenticated = sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
    setIsAuthenticated(authenticated);
    setLoading(false);
  }, []);

  const authenticate = async (password: string): Promise<boolean> => {
    try {
      const hash = await hashPassword(password);
      if (hash === PASSWORD_HASH) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return { isAuthenticated, loading, authenticate };
}

interface PasswordGateProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function PasswordGate({ children, pageTitle = "OpenClaw" }: PasswordGateProps) {
  const { isAuthenticated, loading, authenticate } = usePasswordAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="animate-spin">
          <Lock className="h-6 w-6 text-brand" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);

      try {
        const success = await authenticate(password);
        if (!success) {
          setError("Incorrect password");
          setPassword("");
        }
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f]">
        <div className="w-full max-w-md">
          <form onSubmit={handleSubmit} className="space-y-6 p-8 bg-[#15151b] border border-[#2a2a35] rounded-xl">
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
                <Lock className="h-6 w-6 text-brand" />
              </div>
              <h1 className="text-xl font-semibold text-white">{pageTitle}</h1>
              <p className="text-sm text-[#9fa0b8]">Enter password to continue</p>
            </div>

            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) {
                    handleSubmit(e as any);
                  }
                }}
                disabled={submitting}
                className="h-10 bg-[#0a0a0f] border-[#2a2a35] text-white placeholder:text-[#5a5a72]"
                autoFocus
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={submitting || !password.trim()}
              className="w-full h-10 bg-brand text-brand-foreground hover:bg-brand/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Verifying..." : "Unlock"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function usePasswordGate() {
  return usePasswordAuth();
}
