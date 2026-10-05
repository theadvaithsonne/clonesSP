"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Key, AlertTriangle, UserCog } from "lucide-react";

interface AIProviderRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  isFounder?: boolean;
}

export default function AIProviderRequiredModal({
  open,
  onOpenChange,
  featureName = "AI features",
  isFounder = true,
}: AIProviderRequiredModalProps) {
  const router = useRouter();

  const handleConfigureKeys = () => {
    onOpenChange(false);
    router.push("/ai-providers");
  };

  // Stakeholder view - show message to contact founder
  if (!isFounder) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#111116] border-[#2a2a35] text-white max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <UserCog className="w-6 h-6 text-brand" />
              </div>
              <DialogTitle className="text-lg font-semibold">
                Betty AI Not Configured
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#9fa0b8] text-sm">
              Betty AI requires an API key to be set up by your organization founder.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-[#1a1a22] rounded-lg p-4 border border-[#2a2a35]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-brand mt-0.5 shrink-0" />
                <div className="text-sm text-[#9fa0b8]">
                  <p className="text-white font-medium mb-2">Action Required</p>
                  <p>Please contact your organization founder to set up Betty AI by configuring an API key (Google Gemini or Anthropic Claude).</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a22] rounded-lg p-4 border border-[#2a2a35]">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-[#9fa0b8]">
                  <p>Once configured by the founder, all organization members will be able to use Betty AI features.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-brand hover:bg-brand-2 text-brand-foreground font-medium"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Founder view - show configure button
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111116] border-[#2a2a35] text-white max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-brand" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Betty AI Key Required
            </DialogTitle>
          </div>
          <DialogDescription className="text-[#9fa0b8] text-sm">
            To use {featureName}, you need to configure at least one AI provider API key.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-[#1a1a22] rounded-lg p-4 border border-[#2a2a35]">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-brand mt-0.5 shrink-0" />
              <div className="text-sm text-[#9fa0b8]">
                <p className="text-white font-medium mb-2">Supported AI Providers:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <img src="/rectangle-gemini-google-icon-symbol-logo-free-png.webp" alt="Gemini" className="w-5 h-5 object-contain" />
                    <span>Google Gemini</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <img src="/claude.png" alt="Claude" className="w-5 h-5 object-contain" />
                    <span>Anthropic (Claude)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <img src="/openai-chatgpt-logo-icon-free-png.webp" alt="OpenAI" className="w-5 h-5 object-contain" />
                    <span>OpenAI (GPT)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a22] rounded-lg p-4 border border-[#2a2a35]">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-[#9fa0b8]">
                <p>Your API keys are encrypted and stored securely. Once configured, all organization members will be able to use Betty AI.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfigureKeys}
            className="bg-brand hover:bg-brand-2 text-brand-foreground font-medium"
          >
            Configure Betty AI Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
