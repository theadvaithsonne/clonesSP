"use client";

import { Toaster } from "sonner";
import { ThemeProvider } from "./components/theme-provider";
import { UserProvider } from "@/context/UserContext";
import { FollowUpKnockReminder } from "./components/FollowUpKnockReminder";
import CmsAccessGateHost from "@/components/deals/cms/CmsAccessGateHost";

export default function DealsLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
            storageKey="deals-theme"
        >
            <UserProvider>
                {/* Scope primary color overrides to Deals only */}
                <div className="deals-primary-scope">
                    <Toaster position="top-center" />
                    <FollowUpKnockReminder />
                    <CmsAccessGateHost />
                    {children}
                </div>
            </UserProvider>
        </ThemeProvider>
    );
}
