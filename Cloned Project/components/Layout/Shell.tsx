import Topbar from "./Topbar";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Topbar />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
