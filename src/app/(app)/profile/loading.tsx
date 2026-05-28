export default function ProfileLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-baseline">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-[var(--paper2)]" />
          <div className="h-9 w-52 rounded bg-[var(--paper2)]" />
        </div>
        <div className="space-y-1 text-right">
          <div className="h-3 w-24 rounded bg-[var(--paper2)]" />
          <div className="h-9 w-12 rounded bg-[var(--paper2)]" />
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="paper-card p-5 h-72" />
        <div className="paper-card p-5 space-y-4">
          <div className="h-3 w-32 rounded bg-[var(--paper2)]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-4 w-full rounded bg-[var(--paper2)]" />
              <div className="h-1.5 w-full rounded bg-[var(--paper2)]" />
            </div>
          ))}
        </div>
      </div>
      <div className="paper-card p-5 h-40" />
      <div className="paper-card p-5 h-52" />
    </div>
  );
}
