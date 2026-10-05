import type { Metadata } from "next";
import { DocusignErrorBoundary } from "@/components/dashboard/docusign/shared/DocusignErrorBoundary";
import { PublicSigningView } from "./PublicSigningView";

/**
 * The public self-sign page — lives at /workspace/sign/[token] to match the backend's
 * FRONTEND_URL base (see the docusign backend's utils/frontendUrl.util.js). Physically nested
 * under app/(dashboard)/ (there is no way to also claim "/workspace" from outside that group —
 * app/(dashboard)/workspace already owns it), but explicitly excluded from that layout's
 * auth-guard redirect — see isPublicEsignSignPage in app/(dashboard)/layout.tsx. No login, no
 * account, nothing but the token in the URL.
 */

export const metadata: Metadata = {
  title: "Sign document | Garage",
  description: "Review and sign a document sent to you for your signature.",
  robots: { index: false, follow: false },
};

export default async function EsignSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A render-time crash anywhere in the signing page shows a "Try again" card instead of a blank screen.
  return (
    <DocusignErrorBoundary>
      <PublicSigningView token={token} />
    </DocusignErrorBoundary>
  );
}
