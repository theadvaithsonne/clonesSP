export default function Bat246MembersLoading() {
  return (
    <div className="min-h-full bg-[#09090f] text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* Back link placeholder */}
        <div className="mb-5 h-4 w-20 bg-white/8 rounded animate-pulse" />

        {/* Header */}
        <div className="mb-6">
          <div className="h-6 w-52 bg-white/10 rounded animate-pulse mb-2" />
          <div className="h-3.5 w-36 bg-white/5 rounded animate-pulse" />
        </div>

        {/* Search */}
        <div className="h-11 w-full bg-[#141414] border border-white/8 rounded-xl animate-pulse mb-5" />

        {/* Table */}
        <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_150px_100px_85px_180px] px-5 py-3 border-b border-white/5">
            {[200, 80, 110, 60, 55, 120].map((w, i) => (
              <div key={i} className="h-2 bg-white/8 rounded animate-pulse" style={{ maxWidth: w }} />
            ))}
          </div>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_120px_150px_100px_85px_180px] px-5 py-3.5 items-center border-b border-white/5 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/8 shrink-0 animate-pulse" style={{ width: 36, height: 36 }} />
                <div>
                  <div className="h-3 w-28 bg-white/10 rounded animate-pulse mb-1.5" />
                  <div className="h-2 w-36 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-2.5 w-20 bg-white/8 rounded animate-pulse" />
              <div className="h-2.5 w-24 bg-white/8 rounded animate-pulse" />
              <div className="h-5 w-16 bg-white/8 rounded-full animate-pulse" />
              <div className="h-2.5 w-16 bg-white/8 rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-white/8 animate-pulse shrink-0" style={{ width: 28, height: 28 }} />
                <div>
                  <div className="h-2.5 w-20 bg-white/10 rounded animate-pulse mb-1" />
                  <div className="h-2 w-28 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
