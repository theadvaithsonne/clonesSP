import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const BASE = "/games/bat246/lostmoney/index";

// Same domain-aware split as SiteHeader — see the comment there.
export function SiteFooter({ isCustomDomain = false }: { isCustomDomain?: boolean }) {
  const home = isCustomDomain ? "/home" : BASE;
  const about = isCustomDomain ? "/aboutus" : `${BASE}/about`;
  const register = isCustomDomain ? "/register" : `${BASE}/register`;
  const paid = isCustomDomain ? "/paidlist" : `${BASE}/paid`;
  const testimonials = isCustomDomain ? "/testimonials" : `${BASE}/testimonials`;

  return (
    <footer className="bg-stone-900 mt-24">
      <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 py-12 grid grid-cols-1 sm:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2 text-white font-black text-lg mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            YourMoneyBack.info
          </div>
          <p className="text-stone-400 text-[15px] leading-relaxed max-w-[320px]">
            An organized, fair way to identify, verify, and repay legitimate losses from previous
            business.
          </p>
        </div>

        <div>
          <div className="text-white font-bold text-base mb-3">Site</div>
          <div className="flex flex-col gap-2.5">
            <Link href={home} className="text-stone-400 hover:text-white text-[15px]">Home</Link>
            <Link href={about} className="text-stone-400 hover:text-white text-[15px]">About Us</Link>
            <Link href={register} className="text-stone-400 hover:text-white text-[15px]">Register a Claim</Link>
            <Link href={paid} className="text-stone-400 hover:text-white text-[15px]">Paid List</Link>
            <Link href={testimonials} className="text-stone-400 hover:text-white text-[15px]">Testimonials</Link>
          </div>
        </div>

        <div>
          <div className="text-white font-bold text-base mb-3">A Note</div>
          <p className="text-stone-400 text-[15px] leading-relaxed italic">
            &quot;A Continuous Goal&quot; — Alan Kippax
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 px-5 sm:px-8 lg:px-12">
        <p className="text-stone-500 text-sm text-center sm:text-left max-w-[1600px] mx-auto leading-relaxed">
          © {new Date().getFullYear()} YourMoneyBack.info;- TLS · BAT 246. All claims are reviewed individually
          and repayment is not guaranteed. See Terms &amp; Conditions.
        </p>
      </div>
    </footer>
  );
}
