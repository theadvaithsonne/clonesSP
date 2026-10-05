import type { Metadata } from "next";
import IrlHandoff from "@/components/garage-irl/IrlHandoff";
import { fetchIrlProduct } from "@/lib/garageIrl";

// A GarageIRL product share link. `?ref=aff_…` is an affiliate id, forwarded
// to the app by IrlHandoff. Phones with the app normally never load this — the
// OS opens the app on the link (Universal / App Links, see app/.well-known) —
// so this is for in-app browsers, phones without the app, and desktops.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchIrlProduct(id);
  const title = product ? `${product.title} · GarageIRL` : "GarageIRL";
  const description = product
    ? [product.price, product.storeName && `at ${product.storeName}`]
        .filter(Boolean)
        .join(" ") || "View this item in GarageIRL"
    : "View this item in GarageIRL";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: product?.image ? [product.image] : ["/garage-irl-icon.png"],
    },
  };
}

export default async function ProductSharePage({ params }: Props) {
  const { id } = await params;
  const product = await fetchIrlProduct(id);
  return <IrlHandoff kind="product" id={id} product={product} />;
}
