import type { SummaryMetrics } from "@bgc-alpha/schemas";

export type SummaryMetricKey = keyof SummaryMetrics;
export type SummaryMetricGroup = "outcome" | "signal";
export type SummaryMetricUnit = "value" | "percent" | "ratio" | "months";

export type SummaryMetricDefinition = {
  key: SummaryMetricKey;
  label: string;
  shortLabel: string;
  description: string;
  group: SummaryMetricGroup;
  unit: SummaryMetricUnit;
  chartMax?: number;
};

const metricValueFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatMonthCountLabel(months: number) {
  const formatted = metricValueFormatter.format(months);
  return `${formatted} ${Math.abs(months) === 1 ? "month" : "months"}`;
}

export const summaryMetricDefinitions: SummaryMetricDefinition[] = [
  {
    key: "alpha_issued_total",
    label: "Total ALPHA Issued",
    shortLabel: "Issued",
    description:
      "How much ALPHA the scenario creates after reward rules and caps are applied.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_spent_total",
    label: "Total ALPHA Used",
    shortLabel: "Used",
    description:
      "How much issued ALPHA gets used inside the ecosystem.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_held_total",
    label: "Total ALPHA Held",
    shortLabel: "Held",
    description:
      "How much issued ALPHA remains held instead of being used or cashed out.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_cashout_equivalent_total",
    label: "Cash-Out Demand",
    shortLabel: "Cash-Out",
    description:
      "Cash-out equivalent value released under the scenario's payout settings.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "sink_utilization_rate",
    label: "Internal Use Rate",
    shortLabel: "Use Rate",
    description: "Share of issued ALPHA that gets used inside modeled sinks.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
  {
    key: "payout_inflow_ratio",
    label: "Treasury Pressure",
    shortLabel: "Pressure",
    description:
      "Payout pressure compared with treasury inflow. Above 1.0 means outflow is overtaking inflow.",
    group: "signal",
    unit: "ratio",
    chartMax: 3,
  },
  {
    key: "reserve_runway_months",
    label: "Reserve Runway",
    shortLabel: "Runway",
    description:
      "Estimated number of months the reserve can support the modeled payout profile.",
    group: "signal",
    unit: "months",
    chartMax: 24,
  },
  {
    key: "reward_concentration_top10_pct",
    label: "Top 10% Reward Share",
    shortLabel: "Top 10% Share",
    description:
      "Share of total rewards captured by the top 10% of members.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
];

const summaryMetricDefinitionByKey = Object.fromEntries(
  summaryMetricDefinitions.map((definition) => [definition.key, definition]),
) as Record<SummaryMetricKey, SummaryMetricDefinition>;

export function getSummaryMetricDefinition(key: SummaryMetricKey) {
  return summaryMetricDefinitionByKey[key];
}

export function formatSummaryMetricValue(key: SummaryMetricKey, value: number) {
  const definition = getSummaryMetricDefinition(key);
  const formattedValue = metricValueFormatter.format(value);

  switch (definition.unit) {
    case "percent":
      return `${formattedValue}%`;
    case "ratio":
      return `${formattedValue}x`;
    case "months":
      return formatMonthCountLabel(value);
    default:
      return formattedValue;
  }
}
