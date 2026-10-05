import { Suspense } from "react";
import CareersClient from "./CareersClient";

export default function CareersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CareersClient />
    </Suspense>
  );
}
