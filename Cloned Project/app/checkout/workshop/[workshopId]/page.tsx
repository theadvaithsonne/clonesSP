import { WorkshopCheckoutPage } from "./WorkshopCheckoutPage";

interface PageProps {
  params: Promise<{ workshopId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { workshopId } = await params;
  return <WorkshopCheckoutPage workshopId={workshopId} />;
}
