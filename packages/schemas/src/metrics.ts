import { z } from "zod";

export const summaryMetricsSchema = z.object({
  alpha_issued_total: z.number(),
  alpha_spent_total: z.number(),
  alpha_held_total: z.number(),
  alpha_cashout_equivalent_total: z.number(),
  sink_utilization_rate: z.number(),
  payout_inflow_ratio: z.number(),
  reserve_runway_months: z.number(),
  reward_concentration_top10_pct: z.number()
});

export type SummaryMetrics = z.infer<typeof summaryMetricsSchema>;

