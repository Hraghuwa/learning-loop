type Props = {
  values: number[];
  labels: string[];
};

export function RadarChart({ values, labels }: Props) {
  const size = 320;
  const center = size / 2;
  const radius = 110;
  const toPoint = (index: number, magnitude: number) => {
    const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
    const r = radius * (magnitude / 10);
    return { x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r };
  };
  const polygonPoints = values.map((v, i) => toPoint(i, v)).map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {labels.map((label, i) => {
        const axisPoint = toPoint(i, 10);
        return (
          <g key={label}>
            <line x1={center} y1={center} x2={axisPoint.x} y2={axisPoint.y} stroke="var(--border)" />
            <text x={axisPoint.x} y={axisPoint.y} fill="var(--muted)" fontSize="11" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
      <polygon points={polygonPoints} fill="var(--gold)" fillOpacity="0.15" stroke="var(--gold)" strokeWidth="1.5" />
    </svg>
  );
}
