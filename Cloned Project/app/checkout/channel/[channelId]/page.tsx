import { ChannelCheckoutPage } from "./ChannelCheckoutPage";

interface PageProps {
  params: Promise<{ channelId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { channelId } = await params;
  return <ChannelCheckoutPage channelId={channelId} />;
}
