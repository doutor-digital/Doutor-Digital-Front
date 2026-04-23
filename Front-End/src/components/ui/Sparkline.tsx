import { cn } from "@/lib/utils";

/**
 * Sparkline SVG puro — sem deps de chart lib, render instantâneo.
 * Suporta area fill e marcação do último ponto.
 */
export function Sparkline({
  data,
  width = 80,
  height = 28,
  stroke = "currentColor",
  fill = "currentColor",
  strokeWidth = 1.5,
  fillOpacity = 0.15,
  showLastDot = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  showLastDot?: boolean;
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <svg width={width} height={height} className={cn("text-slate-600", className)}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.4}
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = strokeWidth;

  const points = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * (width - 2) + 1;
    const y = padY + (1 - (v - min) / range) * (height - padY * 2);
    return [x, y] as const;
  });

  const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  const areaPath =
    linePath +
    ` L${points[points.length - 1][0].toFixed(2)},${height}` +
    ` L${points[0][0].toFixed(2)},${height} Z`;

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <path d={areaPath} fill={fill} fillOpacity={fillOpacity} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {showLastDot && (
        <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.5} fill={stroke} />
      )}
    </svg>
  );
}
