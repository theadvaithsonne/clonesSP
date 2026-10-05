import { CourseCheckoutPage } from "./CourseCheckoutPage";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { courseId } = await params;
  return <CourseCheckoutPage courseId={courseId} />;
}
