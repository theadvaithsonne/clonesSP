// app/taskroom/backOffice/athena/short/[id]/page.tsx
import { Metadata } from "next";
import { redirect } from "next/navigation";

type ApiResponse = {
  status: boolean;
  data: {
    _id: string;
    longurl: string;
    og: {
      title: string;
      description: string;
      assignedBy: string;
      assignedTo: string[];
    };
    status: string;
  };
};

async function getShortUrlData(id: string): Promise<ApiResponse | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
    const res = await fetch(
      `${baseUrl}short/urls/${id}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getShortUrlData(params.id);

  if (!result || !result.status) {
    return {
      title: "Garage App",
      description: "Task room redirect",
    };
  }

  const { og } = result.data;
  const assignedToText = og.assignedTo?.join(", ") || "";

  const title = `${og.assignedBy} assigned "${og.title}" to ${assignedToText}`;
  const description = og.description || "View task details on Garage App";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ShortUrlPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await getShortUrlData(params.id);

  if (result?.status && result.data.longurl) {
    redirect(result.data.longurl);
  }

  return <div>Invalid or expired link.</div>;
}