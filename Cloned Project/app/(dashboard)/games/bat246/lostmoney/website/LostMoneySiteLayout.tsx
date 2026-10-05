import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";

export function LostMoneySiteLayout({
  children,
  isCustomDomain = false,
}: {
  children: React.ReactNode;
  isCustomDomain?: boolean;
}) {
  return (
    <div className="min-h-screen w-full bg-[#faf6ec] text-stone-900 flex flex-col">
      <SiteHeader isCustomDomain={isCustomDomain} />
      <main className="flex-1 w-full">{children}</main>
      <SiteFooter isCustomDomain={isCustomDomain} />
    </div>
  );
}
