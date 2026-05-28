type Point = { day: string; value: number };

type Props = {
  data: Point[];
  maxValue?: number;
  height?: number;
  width?: number;
  label?: string;
};

export function TrendChart({ data, maxValue = 10, height = 120, width = 480, label }: Props) {
  if (!data.length) {
    return (
      <div className="text-[var(--muted)] text-sm italic font-mono p-4">
        No data yet — solve a few loops to see your trend.
      </div>
    );
  }
  const padding = 24;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: padding + chartH - (Math.min(maxValue, d.value) / maxValue) * chartH,
    raw: d,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1].x},${padding + chartH} L ${points[0].x},${padding + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {label && (
        <text x={padding} y={14} fill="var(--muted)" fontSize="10" fontFamily="monospace">
          {label}
        </text>
      )}
      <line
        x1={padding}
        y1={padding + chartH}
        x2={padding + chartW}
        y2={padding + chartH}
        stroke="var(--border)"
      />
      <path d={area} fill="var(--gold)" fillOpacity="0.12" />
      <path d={path} stroke="var(--gold)" strokeWidth="2" fill="none" />
      {points.map((p) => (
        <g key={`${p.raw.day}-${p.x}`}>
          <circle cx={p.x} cy={p.y} r="3" fill="var(--gold)" />
          <text
            x={p.x}
            y={padding + chartH + 14}
            textAnchor="middle"
            fontSize="9"
            fill="var(--muted)"
            fontFamily="monospace"
          >
            {p.raw.day}
          </text>
        </g>
      ))}
    </svg>
  );
}
