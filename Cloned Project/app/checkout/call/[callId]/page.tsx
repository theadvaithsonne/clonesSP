import { CallCheckoutPage } from "./CallCheckoutPage";

interface PageProps {
  params: Promise<{ callId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { callId } = await params;
  return <CallCheckoutPage callId={callId} />;
}
