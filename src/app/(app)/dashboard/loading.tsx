export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-baseline justify-between">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-[var(--paper2)]" />
          <div className="h-9 w-64 rounded bg-[var(--paper2)]" />
        </div>
        <div className="h-9 w-32 rounded bg-[var(--paper2)]" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="paper-card p-4 space-y-2">
            <div className="h-2 w-16 rounded bg-[var(--paper2)]" />
            <div className="h-8 w-12 rounded bg-[var(--paper2)]" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="paper-card p-5 h-48" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="paper-card p-5 space-y-3">
            <div className="h-6 w-40 rounded bg-[var(--paper2)]" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-4 w-full rounded bg-[var(--paper2)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
