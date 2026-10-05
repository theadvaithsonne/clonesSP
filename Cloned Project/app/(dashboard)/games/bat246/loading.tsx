export default function Bat246Loading() {
  return (
    <div className="min-h-full bg-[#09090f] text-white overflow-auto animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-white/[0.07] px-8 py-10 max-w-5xl mx-auto">
        <div className="h-4 w-24 bg-white/8 rounded-full mb-5" />
        <div className="h-10 w-64 bg-white/8 rounded-lg mb-2" />
        <div className="h-3 w-40 bg-white/5 rounded-full mt-2" />
        <div className="flex items-center gap-6 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              {i > 1 && <div className="w-px h-6 bg-white/10" />}
              <div>
                <div className="h-6 w-8 bg-white/10 rounded mb-1" />
                <div className="h-2 w-20 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.07] h-44"
              style={{ background: "linear-gradient(145deg, #0e0e1c 0%, #09090f 100%)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
