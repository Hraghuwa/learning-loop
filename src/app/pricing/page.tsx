const plans = [
  { name: "Free", price: "₹0", points: ["10 questions/month", "Basic error classification", "No peer comparison", "No voice input"] },
  { name: "Pro", price: "₹499/mo", points: ["Unlimited questions", "Full AI diagnosis", "Voice input", "Radar chart + peer benchmark"], nudge: "Annual plan saves ₹2,000" },
  { name: "Institute", price: "₹8,000/mo", points: ["All Pro features", "Class analytics", "AI teaching recommendations", "CSV export + support"] },
];

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-serif text-5xl mb-8">Pricing</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div key={p.name} className="paper-card p-5">
            <p className="font-mono text-xs text-[var(--muted)]">{p.name.toUpperCase()}</p>
            <p className="font-serif text-4xl mt-2">{p.price}</p>
            {p.nudge && <p className="text-sm text-[var(--gold)] mt-2">{p.nudge}</p>}
            <ul className="mt-4 space-y-2 text-sm">
              {p.points.map((x) => <li key={x}>• {x}</li>)}
            </ul>
            <button className="mt-5 rounded bg-[var(--gold)] px-4 py-2 text-white">Choose {p.name}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
