export default function DistributorsLoading() {
  return (
    <div className="min-h-full bg-[#09090f] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back link skeleton */}
        <div className="mb-5 h-4 w-24 bg-white/8 rounded animate-pulse" />

        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 w-36 bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_110px_150px_44px_44px_44px_44px_100px] px-5 py-3 border-b border-white/5">
            {[180, 70, 100, 20, 20, 20, 20, 60].map((w, i) => (
              <div key={i} className={`h-2 bg-white/8 rounded animate-pulse ${i > 2 ? "mx-auto" : ""}`} style={{ maxWidth: w }} />
            ))}
          </div>

          {/* Skeleton rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_110px_150px_44px_44px_44px_44px_100px] px-5 py-3.5 items-center border-b border-white/5 last:border-b-0"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-white/8 shrink-0 animate-pulse" />
                <div>
                  <div className="h-3 w-28 bg-white/10 rounded animate-pulse mb-1.5" />
                  <div className="h-2 w-36 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
              {/* Phone */}
              <div className="h-2.5 w-20 bg-white/8 rounded animate-pulse" />
              {/* Location */}
              <div className="h-2.5 w-24 bg-white/8 rounded animate-pulse" />
              {/* Flags */}
              {[1, 2, 3, 4].map((f) => (
                <div key={f} className="flex justify-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-white/8 animate-pulse" />
                </div>
              ))}
              {/* Qualified date */}
              <div className="h-2.5 w-16 bg-white/8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
