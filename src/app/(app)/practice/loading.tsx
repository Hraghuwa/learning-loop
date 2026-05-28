export default function PracticeLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[var(--paper2)]" />
        <div className="h-9 w-80 rounded bg-[var(--paper2)]" />
        <div className="h-4 w-96 rounded bg-[var(--paper2)]" />
      </div>
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="space-y-3">
          <div className="h-7 w-40 rounded bg-[var(--paper2)]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="paper-card p-4 flex justify-between items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-[var(--paper2)]" />
                <div className="h-4 w-full rounded bg-[var(--paper2)]" />
              </div>
              <div className="h-4 w-12 rounded bg-[var(--paper2)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
