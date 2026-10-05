"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function RevenueNetworkPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/garage-admin/revenue-network/admins");
  }, [router]);

  return <></>;
}
