import { Suspense } from "react";
import VacancyDetailClient from "./VacancyDetailClient";

export default function VacancyDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VacancyDetailClient />
    </Suspense>
  );
}
