import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import "./docs.css";
import Chrome from "./components/Chrome";

/**
 * One superfamily, three voices. Plex was drawn for technical documentation,
 * so the serif and the sans share a skeleton — chapter titles can carry a
 * bookish authority without reading as a pairing of strangers, and the mono
 * used for routes and event names sits in the same world as the prose.
 *
 * Scoped to /docs: the rest of the app keeps Geist.
 */
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--doc-font-sans",
  display: "swap",
});

const serif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--doc-font-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--doc-font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Garage — the manual",
    template: "%s · Garage docs",
  },
  description:
    "How Garage works: the virtual office, the apps inside it, and the architecture underneath.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`doc-root ${sans.variable} ${serif.variable} ${mono.variable}`}>
      <Chrome>{children}</Chrome>
    </div>
  );
}
