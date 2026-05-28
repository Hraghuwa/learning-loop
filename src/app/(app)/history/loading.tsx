export default function HistoryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-baseline justify-between">
        <div className="h-9 w-48 rounded bg-[var(--paper2)]" />
        <div className="h-3 w-20 rounded bg-[var(--paper2)]" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded-full bg-[var(--paper2)]" />
        ))}
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="paper-card p-4 flex justify-between items-start gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-2 w-32 rounded bg-[var(--paper2)]" />
              <div className="h-4 w-56 rounded bg-[var(--paper2)]" />
              <div className="h-3 w-72 rounded bg-[var(--paper2)]" />
            </div>
            <div className="space-y-1 text-right">
              <div className="h-4 w-16 rounded bg-[var(--paper2)]" />
              <div className="h-3 w-20 rounded bg-[var(--paper2)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
