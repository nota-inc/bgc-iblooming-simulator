import type { SummaryMetrics } from "@bgc-alpha/schemas";

export type SummaryMetricKey = keyof SummaryMetrics;
export type SummaryMetricGroup = "outcome" | "cashflow" | "signal";
export type SummaryMetricUnit = "value" | "usd" | "percent" | "ratio" | "months" | "count";

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

const metricCurrencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency",
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
    key: "alpha_actual_spent_total",
    label: "Actual ALPHA Used",
    shortLabel: "Actual Used",
    description:
      "Internal use anchored directly to imported snapshot sink_spend_usd.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_modeled_spent_total",
    label: "Modeled ALPHA Used",
    shortLabel: "Modeled Used",
    description:
      "Incremental internal use created by scenario sink target and sink adoption assumptions.",
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
    label: "ALPHA Cash-Out",
    shortLabel: "Cash-Out",
    description:
      "Amount of issued ALPHA released into the cash-out path under the scenario's payout settings.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_opening_balance_total",
    label: "Opening ALPHA Balance",
    shortLabel: "Opening",
    description:
      "Cumulative ALPHA balance at the start of the simulated ledger window.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_ending_balance_total",
    label: "Ending ALPHA Balance",
    shortLabel: "Ending",
    description:
      "Cumulative ALPHA balance after issued, used, cash-out, and burn/expiry flows.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_expired_burned_total",
    label: "Expired / Burned ALPHA",
    shortLabel: "Burned",
    description:
      "ALPHA removed from circulation by expiry or burn policy. Phase 1 defaults this to zero until a burn rule is explicitly defined.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "company_gross_cash_in_total",
    label: "Gross Cash In",
    shortLabel: "Gross In",
    description:
      "Gross business cash collected before pass-through partner payouts or internal obligations.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_retained_revenue_total",
    label: "Retained Revenue",
    shortLabel: "Revenue",
    description:
      "Revenue support that remains attributable to the company after pass-through splits.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_partner_payout_out_total",
    label: "Partner Payout Out",
    shortLabel: "Partner Out",
    description:
      "Pass-through partner payouts such as the CP creator share on iBLOOMING product sales.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_direct_reward_obligation_total",
    label: "Direct Reward Obligations",
    shortLabel: "Direct Obl.",
    description:
      "Direct reward obligations created by snapshot truth, such as RR, GR, LR, CPR, GRR, and iRR.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_pool_funding_obligation_total",
    label: "Pool Funding Obligations",
    shortLabel: "Pool Fund",
    description:
      "Pool funding obligations created by snapshot truth, kept separate from actual cash payouts.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_actual_payout_out_total",
    label: "Actual Payout Out",
    shortLabel: "Payout Out",
    description:
      "Actual cash-equivalent payouts released under the scenario's cash-out policy.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_product_fulfillment_out_total",
    label: "Product Fulfillment Out",
    shortLabel: "Fulfillment",
    description:
      "Physical-product fulfillment value triggered when PC is redeemed on the BGC side.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_net_treasury_delta_total",
    label: "Net Treasury Delta",
    shortLabel: "Net Delta",
    description:
      "Retained revenue minus partner payouts, actual member payouts, and product fulfillment out.",
    group: "cashflow",
    unit: "usd",
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
    key: "actual_sink_utilization_rate",
    label: "Actual Internal Use Rate",
    shortLabel: "Actual Use",
    description: "Share of issued ALPHA used by observed sink_spend_usd from the approved snapshot.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
  {
    key: "modeled_sink_utilization_rate",
    label: "Modeled Internal Use Rate",
    shortLabel: "Modeled Use",
    description: "Share of issued ALPHA used by forecast sink adoption or policy uplift assumptions.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
  {
    key: "payout_inflow_ratio",
    label: "Treasury Pressure",
    shortLabel: "Pressure",
    description:
      "Modeled obligations compared with imported recognized revenue support. Above 1.0 means obligations are overtaking recognized revenue support.",
    group: "signal",
    unit: "ratio",
    chartMax: 3,
  },
  {
    key: "reserve_runway_months",
    label: "Reserve Runway",
    shortLabel: "Runway",
    description:
      "Estimated number of months the reserve can support modeled obligations given the current recognized revenue support profile.",
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
  {
    key: "forecast_actual_period_count",
    label: "Actual Periods",
    shortLabel: "Actual",
    description:
      "Number of periods in the result that are direct reads from the imported snapshot window.",
    group: "signal",
    unit: "count",
    chartMax: 24,
  },
  {
    key: "forecast_projected_period_count",
    label: "Projected Periods",
    shortLabel: "Forecast",
    description:
      "Number of periods in the result that are generated by projection rather than directly observed history.",
    group: "signal",
    unit: "count",
    chartMax: 24,
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
    case "usd":
      return metricCurrencyFormatter.format(value);
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
