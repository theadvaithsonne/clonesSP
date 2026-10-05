import { api } from "./api";

export interface IAuction {
  _id: string;
  createdBy: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorOrgName: string;
  organizationId: string;
  productSource: "garage" | "outside";
  productId?: string;
  productName: string;
  productImages: string[];
  productDescription?: string;
  productVideoUrl?: string;
  minPrice: number;
  currency: "INR" | "USD";
  durationHours: number;
  startTime: string;
  endTime: string;
  status: "ongoing" | "ended" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuctionPayload {
  productSource: "garage" | "outside";
  productId?: string;
  productName: string;
  productImages: string[];
  productDescription?: string;
  productVideoUrl?: string;
  minPrice: number;
  currency: "INR" | "USD";
  durationHours: 1 | 6 | 24 | 48;
  creatorName: string;
  creatorAvatar?: string;
}

export interface AuctionProduct {
  _id: string;
  name: string;
  images: string[];
  organizationId: string;
}

export async function getAuctionMyProducts(): Promise<AuctionProduct[]> {
  const res = await api<{ products: AuctionProduct[] }>("/auctions/my-products");
  return res.products;
}

export async function getAuctions(): Promise<IAuction[]> {
  const res = await api<{ auctions: IAuction[] }>("/auctions");
  return res.auctions;
}

export async function createAuction(payload: CreateAuctionPayload): Promise<IAuction> {
  const res = await api<{ auction: IAuction }>("/auctions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.auction;
}

export async function updateAuction(
  id: string,
  payload: Partial<CreateAuctionPayload>
): Promise<IAuction> {
  const res = await api<{ auction: IAuction }>(`/auctions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.auction;
}

export async function cancelAuction(id: string): Promise<IAuction> {
  const res = await api<{ auction: IAuction }>(`/auctions/${id}/cancel`, {
    method: "PATCH",
  });
  return res.auction;
}
