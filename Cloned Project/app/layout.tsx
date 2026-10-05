import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Oswald, Graduate, Doto } from "next/font/google";
import "./globals.css";
import Header from "@/components/shared/Header";
import Footer from "@/components/landing/Footer";
import { Toaster } from "sonner";
import FirstVisitCleanup from "@/components/FirstVisitCleanup";
import PostHogInit from "@/components/PostHogInit";
import { MeetingProvider } from "@/lib/meeting-context";
import { PipProvider } from "@/components/meet/PersistentPipRenderer";
import OpenInAppGate from "@/components/shared/OpenInAppGate";
import Bat246Branding from "@/components/bat246/Bat246Branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-chat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Condensed athletic display font used by the Bat246 board (scoreboard headings)
const oswald = Oswald({
  variable: "--font-bat-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Collegiate slab-serif for varsity/baseball lettering (MINOR LEAGUE, DUGOUT)
const graduate = Graduate({
  variable: "--font-bat-varsity",
  subsets: ["latin"],
  weight: ["400"],
});

// Dot-matrix LED font for the stadium Game Clock scoreboard
const doto = Doto({
  variable: "--font-bat-led",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://my.garage.app"),
  title: "Garage.App - Ai Operating System for startups 🚀",
  description: "Developed for startups",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${oswald.variable} ${graduate.variable} ${doto.variable} antialiased`}
        suppressHydrationWarning
      >
        <FirstVisitCleanup />
        {/* BAT 246 tab title + favicon on bat246.com and in the BAT 246 office */}
        <Bat246Branding />
        <PostHogInit />
        {/* <Header /> */}
        <MeetingProvider>
          <PipProvider>
            <OpenInAppGate>
              {children}
            </OpenInAppGate>
          </PipProvider>
        </MeetingProvider>

        <Toaster />

        {/* <Footer /> */}
      </body>
    </html>
  );
}
