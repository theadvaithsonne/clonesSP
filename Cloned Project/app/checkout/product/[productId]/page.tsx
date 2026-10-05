import { ProductCheckoutPage } from "./ProductCheckoutPage";

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { productId } = await params;
  return <ProductCheckoutPage productId={productId} />;
}
