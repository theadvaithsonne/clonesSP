"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Bell, Mail, Smartphone, TestTube } from "lucide-react";
import { toast } from "sonner";

interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  checkInterval: number;
}

interface LeadNotificationSettingsProps {
  preferences: NotificationPreferences;
  onPreferencesChange: (prefs: NotificationPreferences) => void;
  isEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onTestNotification?: () => void;
}

export function LeadNotificationSettings({
  preferences,
  onPreferencesChange,
  isEnabled,
  onEnabledChange,
  onTestNotification,
}: LeadNotificationSettingsProps) {
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleSave = () => {
    onPreferencesChange(localPreferences);
    setIsOpen(false);
  };

  const handleIntervalChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 10) {
      setLocalPreferences({
        ...localPreferences,
        checkInterval: numValue * 1000, // Convert seconds to milliseconds
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bell className="h-4 w-4" />
          Notification Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lead Notification Settings</DialogTitle>
          <DialogDescription>
            Configure how you want to be notified about new leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-enabled">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Turn notifications on or off completely
              </p>
            </div>
            <Switch
              id="notifications-enabled"
              checked={isEnabled}
              onCheckedChange={onEnabledChange}
            />
          </div>

          {isEnabled && (
            <>
              {/* In-App Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="in-app-notifications" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    In-App Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show toast notifications in the app
                  </p>
                </div>
                <Switch
                  id="in-app-notifications"
                  checked={localPreferences.inAppEnabled}
                  onCheckedChange={(checked) =>
                    setLocalPreferences({
                      ...localPreferences,
                      inAppEnabled: checked,
                    })
                  }
                />
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts for new leads
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={localPreferences.emailEnabled}
                  onCheckedChange={(checked) =>
                    setLocalPreferences({
                      ...localPreferences,
                      emailEnabled: checked,
                    })
                  }
                />
              </div>

              {/* Check Interval */}
              <div className="space-y-2">
                <Label htmlFor="check-interval">Check Interval (seconds)</Label>
                <p className="text-sm text-muted-foreground">
                  How often to check for new leads (minimum 10 seconds)
                </p>
                <Input
                  id="check-interval"
                  type="number"
                  min="10"
                  value={localPreferences.checkInterval / 1000}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between items-center">
          {onTestNotification && (
            <Button
              variant="outline"
              onClick={() => {
                onTestNotification();
                toast.info("Test notification triggered. Check for toast and email.");
              }}
              className="gap-2"
            >
              <TestTube className="h-4 w-4" />
              Test Notification
            </Button>
          )}
          <div className="flex justify-end gap-2 ml-auto">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

