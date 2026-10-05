"use client";

import { ProviderKey } from "@/lib/hooks/useAIProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AIProviderSelectorProps {
  keys: ProviderKey[];
  selectedProvider: string | null;
  onProviderChange: (providerId: string) => void;
  disabled?: boolean;
}

const PROVIDER_INFO: Record<string, { name: string; icon: string; shortName: string }> = {
  "google-gemini": {
    name: "Google Gemini",
    shortName: "Gemini",
    icon: "/rectangle-gemini-google-icon-symbol-logo-free-png.webp",
  },
  openai: {
    name: "OpenAI GPT",
    shortName: "GPT",
    icon: "/openai-chatgpt-logo-icon-free-png.webp",
  },
  anthropic: {
    name: "Anthropic Claude",
    shortName: "Claude",
    icon: "/claude.png",
  },
};

export default function AIProviderSelector({
  keys,
  selectedProvider,
  onProviderChange,
  disabled = false,
}: AIProviderSelectorProps) {
  if (keys.length === 0) {
    return null;
  }

  // Filter to only show providers that have keys configured
  const availableProviders = keys
    .map((k) => k.providerId)
    .filter((id) => PROVIDER_INFO[id]);

  if (availableProviders.length === 0) {
    return null;
  }

  // Always show dropdown so user can see/switch the active model
  return (
    <Select
      value={selectedProvider || availableProviders[0]}
      onValueChange={onProviderChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-[150px] h-8 bg-[#1a1a22] border-[#2a2a35] text-white text-xs gap-1">
        <SelectValue placeholder="Select Model">
          {selectedProvider && PROVIDER_INFO[selectedProvider] && (
            <div className="flex items-center gap-2">
              <img
                src={PROVIDER_INFO[selectedProvider].icon}
                alt={PROVIDER_INFO[selectedProvider].name}
                className="w-4 h-4 object-contain"
              />
              <span className="text-yellow-400 font-medium">{PROVIDER_INFO[selectedProvider].shortName}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
        {availableProviders.map((providerId) => {
          const info = PROVIDER_INFO[providerId];
          const isSelected = providerId === selectedProvider;
          return (
            <SelectItem
              key={providerId}
              value={providerId}
              className={`text-white hover:bg-[#2a2a35] focus:bg-[#2a2a35] cursor-pointer ${isSelected ? 'bg-yellow-500/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <img
                  src={info.icon}
                  alt={info.name}
                  className="w-4 h-4 object-contain"
                />
                <span>{info.name}</span>
                {isSelected && <span className="text-yellow-400 text-xs ml-1">(Active)</span>}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
