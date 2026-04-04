export const compareMetricKeys = [
  "alpha_issued_total",
  "alpha_spent_total",
  "alpha_held_total",
  "payout_inflow_ratio",
  "reserve_runway_months",
  "reward_concentration_top10_pct"
] as const;

export const compareMetricOptimization: Record<string, "lower" | "higher"> = {
  alpha_issued_total: "higher",
  alpha_spent_total: "higher",
  alpha_held_total: "higher",
  payout_inflow_ratio: "lower",
  reserve_runway_months: "higher",
  reward_concentration_top10_pct: "lower"
};

export const compareSeriesColors = [
  "#10B981",
  "#6366F1",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
  "#8B5CF6"
] as const;

export const compareRadarDimensions: ReadonlyArray<{
  key: string;
  name: string;
  max: number;
  invert: boolean;
}> = [
  { key: "reserve_runway_months", name: "Treasury Safety", max: 24, invert: false },
  { key: "reward_concentration_top10_pct", name: "Fairness", max: 100, invert: true },
  { key: "sink_utilization_rate", name: "Internal Use", max: 100, invert: false },
  { key: "alpha_issued_total", name: "Growth Support", max: 0, invert: false },
  { key: "payout_inflow_ratio", name: "Cash-Out Risk", max: 2, invert: true }
];
