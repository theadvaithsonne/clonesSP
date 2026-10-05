import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHAPTERS, chapterBySlug } from "../content";
import ChapterPage from "../components/ChapterPage";

export function generateStaticParams() {
  return CHAPTERS.map((chapter) => ({ slug: chapter.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const chapter = chapterBySlug(slug);
  if (!chapter) return { title: "Not found" };
  return { title: chapter.title, description: chapter.blurb };
}

export default async function Chapter({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chapter = chapterBySlug(slug);
  if (!chapter) notFound();
  return <ChapterPage chapter={chapter} />;
}
