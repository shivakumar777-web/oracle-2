export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-gold-d"
              style={{ animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite` }}
            />
          ))}
        </div>
        <p className="font-body text-xs italic text-cream/25">Churning…</p>
      </div>
    </div>
  );
}
