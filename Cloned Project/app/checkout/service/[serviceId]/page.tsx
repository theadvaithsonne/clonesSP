import { ServiceCheckoutPage } from "./ServiceCheckoutPage";

interface PageProps {
  params: Promise<{ serviceId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { serviceId } = await params;
  return <ServiceCheckoutPage serviceId={serviceId} />;
}
