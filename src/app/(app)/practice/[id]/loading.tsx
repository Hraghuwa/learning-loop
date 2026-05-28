export default function QuestionLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="paper-card p-4 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-[var(--paper2)]" />
        <div className="h-6 w-24 rounded-full bg-[var(--paper2)]" />
        <div className="h-6 w-16 rounded-full bg-[var(--paper2)]" />
      </div>
      <div className="paper-card p-6 space-y-3">
        <div className="h-7 w-full rounded bg-[var(--paper2)]" />
        <div className="h-7 w-4/5 rounded bg-[var(--paper2)]" />
        <div className="h-7 w-3/5 rounded bg-[var(--paper2)]" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="paper-card p-4 h-12" />
        ))}
      </div>
      <div className="paper-card p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-[var(--paper2)]" />
        <div className="h-36 w-full rounded bg-[var(--paper2)]" />
      </div>
      <div className="h-14 w-full rounded bg-[var(--paper2)]" />
    </div>
  );
}
