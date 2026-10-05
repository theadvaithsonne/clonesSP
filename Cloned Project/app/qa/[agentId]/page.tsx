import PublicQAChat from "@/components/qa/PublicQAChat";

// Public unauthenticated Q&A page. Mounted at /qa/[agentId]. The
// middleware excludes /api/ from its matcher but still returns
// NextResponse.next() for everything else, so this page is reachable
// without any auth state. Branding + welcome message are fetched
// client-side by PublicQAChat to keep this entry as simple as possible.
export default async function PublicQAPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <PublicQAChat agentId={agentId} />
    </div>
  );
}
