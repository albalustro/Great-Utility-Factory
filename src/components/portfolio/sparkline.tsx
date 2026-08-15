import { cn } from "@/lib/utils";

/**
 * Minimal inline chart for a metric series.
 *
 * Deliberately dependency-free: these are small trend indicators, not analytical
 * charts, and points with no value are skipped rather than being drawn as zero.
 */
export function Sparkline({
  values,
  labels,
  className,
  invert = false,
  height = 48,
}: {
  values: Array<number | null>;
  labels?: string[];
  className?: string;
  /** For metrics where lower is better, e.g. average position. */
  invert?: boolean;
  height?: number;
}) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value !== null);

  if (points.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Needs at least two recorded windows
      </div>
    );
  }

  const width = 240;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);

  const toY = (value: number) => {
    const ratio = (value - min) / span;
    const normalized = invert ? ratio : 1 - ratio;
    return 4 + normalized * (height - 8);
  };

  const path = points
    .map((point, i) => `${i === 0 ? "M" : "L"} ${point.index * stepX} ${toY(point.value)}`)
    .join(" ");

  const last = points[points.length - 1];
  const first = points[0];
  const rising = invert ? last.value < first.value : last.value > first.value;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={
        labels
          ? `Trend from ${labels[first.index] ?? "start"} to ${labels[last.index] ?? "end"}`
          : "Metric trend"
      }
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        className={rising ? "stroke-[var(--positive)]" : "stroke-[var(--danger)]"}
      />
      {points.map((point) => (
        <circle
          key={point.index}
          cx={point.index * stepX}
          cy={toY(point.value)}
          r={2}
          className={rising ? "fill-[var(--positive)]" : "fill-[var(--danger)]"}
        />
      ))}
    </svg>
  );
}
