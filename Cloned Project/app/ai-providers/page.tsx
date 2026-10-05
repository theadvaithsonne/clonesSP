"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Key,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ProviderKey {
  providerId: string;
  maskedKey: string;
  createdAt: string;
}

const AI_PROVIDERS = [
  {
    id: "google-gemini",
    name: "Google Gemini",
    description: "Powers Betty AI assistant for leave requests, time tracking queries, and more.",
    icon: "/rectangle-gemini-google-icon-symbol-logo-free-png.webp",
    placeholder: "AIzaSy...",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models for advanced text generation and analysis.",
    icon: "/openai-chatgpt-logo-icon-free-png.webp",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Claude models for safe and helpful AI interactions.",
    icon: "/claude.png",
    placeholder: "sk-ant-...",
  },
];

export default function AIProvidersPage() {
  const router = useRouter();
  const { amIFounder, isLoading: isLoadingFounder } = useAmIFounder();
  const [savedKeys, setSavedKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // Fetch saved keys
  const fetchKeys = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ keys?: ProviderKey[]; data?: { keys: ProviderKey[] }; ok?: boolean }>(
        `/founder-ai-providers/keys?orgId=${orgId}`,
        {},
        getToken()!
      );
      // Handle both response formats: { keys: [...] } or { data: { keys: [...] } }
      const keys = res.keys || res.data?.keys || [];
      setSavedKeys(keys);
    } catch (error) {
      console.error("Failed to fetch AI provider keys:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // if (!isLoadingFounder && !amIFounder) {
    //   toast.error("Only founders can access AI Provider settings");
    //   router.push("/workspace");
    //   return;
    // }
    // if (!isLoadingFounder && amIFounder) {
    //   fetchKeys();
    // }
      fetchKeys();

  }, [amIFounder, isLoadingFounder, router]);

  const handleSaveKey = async (providerId: string) => {
    const apiKey = keyInputs[providerId]?.trim();
    if (!apiKey) {
      toast.error("Please enter an API key");
      return;
    }

    setSavingProvider(providerId);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      await api<{ maskedKey?: string; success?: boolean }>(
        `/founder-ai-providers/keys?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({ providerId, apiKey }),
        },
        getToken()!
      );

      // If we get here without throwing, the save was successful
      toast.success("API key saved successfully");
      setKeyInputs((prev) => ({ ...prev, [providerId]: "" }));
      setShowKeyInput((prev) => ({ ...prev, [providerId]: false }));
      fetchKeys();
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) {
      return;
    }

    setDeletingProvider(providerId);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      await api<{ success?: boolean }>(
        `/founder-ai-providers/keys/${providerId}?orgId=${orgId}`,
        { method: "DELETE" },
        getToken()!
      );

      // If we get here without throwing, the delete was successful
      toast.success("API key deleted");
      fetchKeys();
    } catch (error) {
      console.error("Failed to delete API key:", error);
      toast.error("Failed to delete API key");
    } finally {
      setDeletingProvider(null);
    }
  };

  const getSavedKey = (providerId: string) => {
    return savedKeys.find((k) => k.providerId === providerId);
  };

  if (isLoadingFounder || loading) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0b0b0d]/95 backdrop-blur border-b border-[#2a2a35]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/workspace")}
              className="text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand" />
                AI Providers
              </h1>
              <p className="text-sm text-[#9fa0b8]">
                Configure API keys for AI features in your organization
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {AI_PROVIDERS.map((provider) => {
            const savedKey = getSavedKey(provider.id);
            const isShowingInput = showKeyInput[provider.id];
            const isSaving = savingProvider === provider.id;
            const isDeleting = deletingProvider === provider.id;

            return (
              <div
                key={provider.id}
                className="bg-[#111116] border border-[#2a2a35] rounded-xl p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#1a1a22] flex items-center justify-center overflow-hidden">
                      <img
                        src={provider.icon}
                        alt={provider.name}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{provider.name}</h3>
                      <p className="text-sm text-[#9fa0b8] mt-1">
                        {provider.description}
                      </p>
                    </div>
                  </div>

                  {savedKey && !isShowingInput && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">Configured</span>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  {savedKey && !isShowingInput ? (
                    <div className="flex items-center justify-between bg-[#1a1a22] rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-[#9fa0b8]" />
                        <code className="text-sm text-[#9fa0b8] font-mono">
                          {savedKey.maskedKey}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowKeyInput((prev) => ({
                              ...prev,
                              [provider.id]: true,
                            }))
                          }
                          className="text-[#9fa0b8] hover:text-white"
                        >
                          Update
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKey(provider.id)}
                          disabled={isDeleting}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Input
                          type={showApiKey[provider.id] ? "text" : "password"}
                          placeholder={provider.placeholder}
                          value={keyInputs[provider.id] || ""}
                          onChange={(e) =>
                            setKeyInputs((prev) => ({
                              ...prev,
                              [provider.id]: e.target.value,
                            }))
                          }
                          className="bg-[#1a1a22] border-[#2a2a35] text-white pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-[#9fa0b8] hover:text-white"
                          onClick={() =>
                            setShowApiKey((prev) => ({
                              ...prev,
                              [provider.id]: !prev[provider.id],
                            }))
                          }
                        >
                          {showApiKey[provider.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleSaveKey(provider.id)}
                          disabled={isSaving || !keyInputs[provider.id]?.trim()}
                          className="bg-brand hover:bg-brand-2 text-brand-foreground"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            "Save API Key"
                          )}
                        </Button>
                        {savedKey && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setShowKeyInput((prev) => ({
                                ...prev,
                                [provider.id]: false,
                              }));
                              setKeyInputs((prev) => ({
                                ...prev,
                                [provider.id]: "",
                              }));
                            }}
                            className="text-[#9fa0b8] hover:text-white"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-[#111116] border border-[#2a2a35] rounded-xl p-6">
          <h3 className="font-medium text-white mb-3">How it works</h3>
          <ul className="space-y-2 text-sm text-[#9fa0b8]">
            <li className="flex items-start gap-2">
              <span className="text-brand">1.</span>
              Add your API key for the AI provider you want to use
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand">2.</span>
              Your API keys are encrypted and stored securely
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand">3.</span>
              AI features like Betty will automatically use your organization's configured keys
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand">4.</span>
              If no key is configured, the default system key will be used
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
