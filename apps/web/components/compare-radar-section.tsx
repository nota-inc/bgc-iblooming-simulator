"use client";

import { CompareRadarChart } from "./compare-radar-chart";

type CompareRadarSectionProps = {
  runs: {
    name: string;
    metrics: Record<string, number>;
  }[];
};

const RADAR_DIMENSIONS = [
  { key: "reserve_runway_months", name: "Treasury Safety", max: 24 },
  { key: "reward_concentration_top10_pct", name: "Fairness", max: 100, invert: true },
  { key: "sink_utilization_rate", name: "Internal Use", max: 100 },
  { key: "alpha_issued_total", name: "Growth Support", max: 0 },
  { key: "payout_inflow_ratio", name: "Cash-Out Risk", max: 2, invert: true },
];

const SERIES_COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EF4444", "#A855F7"];

export function CompareRadarSection({ runs }: CompareRadarSectionProps) {
  if (runs.length === 0) return null;

  // Calculate dynamic max for alpha_issued_total
  const maxIssued = Math.max(1, ...runs.map((r) => r.metrics.alpha_issued_total ?? 0));

  const dimensions = RADAR_DIMENSIONS.map((d) => ({
    name: d.name,
    max: d.key === "alpha_issued_total" ? maxIssued * 1.2 : d.max,
  }));

  const series = runs.map((run, i) => ({
    name: run.name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    values: RADAR_DIMENSIONS.map((d) => {
      const raw = run.metrics[d.key] ?? 0;
      if (d.invert) {
        const maxVal = d.key === "alpha_issued_total" ? maxIssued * 1.2 : d.max;
        return Math.max(0, maxVal - raw);
      }
      return raw;
    }),
  }));

  return (
    <div className="card span-12">
      <h3>Scenario Comparison</h3>
      <p className="muted" style={{ marginTop: "-0.4rem", marginBottom: "0.5rem", fontSize: "0.82rem" }}>
        Visual overlay of key dimensions across scenarios — larger area = stronger profile.
      </p>
      <CompareRadarChart dimensions={dimensions} series={series} />
    </div>
  );
}
