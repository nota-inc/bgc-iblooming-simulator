import { z } from "zod";

import { scenarioSchema } from "./scenario";
import { summaryMetricsSchema } from "./metrics";
import { strategicObjectiveScorecardSchema } from "./strategic";

export const simulationRunRequestSchema = z.object({
  snapshotId: z.string().min(1),
  baselineModelVersionId: z.string().min(1),
  scenario: scenarioSchema
});

export const simulationRunLaunchSchema = z.object({
  snapshotId: z.string().min(1).optional()
});

export const simulationRunCreateSchema = z.object({
  scenarioId: z.string().min(1),
  snapshotId: z.string().min(1).optional()
});

export const recommendationSignalSchema = z.object({
  policy_status: z.enum(["candidate", "risky", "rejected"]),
  reasons: z.array(z.string())
});

export const runFlagSchema = z.object({
  flag_type: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  period_key: z.string().nullable().optional()
});

export const runTimeSeriesMetricSchema = z.object({
  period_key: z.string(),
  metric_key: z.string(),
  metric_value: z.number()
});

export const runSegmentMetricSchema = z.object({
  segment_type: z.string(),
  segment_key: z.string(),
  metric_key: z.string(),
  metric_value: z.number()
});

export const milestoneEvaluationSchema = z.object({
  milestone_key: z.string().min(1),
  label: z.string().min(1),
  start_period_key: z.string().min(1),
  end_period_key: z.string().min(1),
  policy_status: z.enum(["candidate", "risky", "rejected"]),
  reasons: z.array(z.string()),
  summary_metrics: summaryMetricsSchema,
  flags: z.array(runFlagSchema),
  strong_objectives: z.array(z.string()).optional().default([]),
  weak_objectives: z.array(z.string()).optional().default([])
});

export const simulationRunResultSchema = z.object({
  run_id: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  summary_metrics: summaryMetricsSchema,
  strategic_metrics: z.record(z.number()).optional().default({}),
  time_series_metrics: z.array(runTimeSeriesMetricSchema),
  segment_metrics: z.array(runSegmentMetricSchema),
  flags: z.array(runFlagSchema),
  recommendation_signals: recommendationSignalSchema,
  strategic_objectives: z.array(strategicObjectiveScorecardSchema).optional().default([]),
  milestone_evaluations: z.array(milestoneEvaluationSchema).optional().default([])
});

export type SimulationRunRequest = z.infer<typeof simulationRunRequestSchema>;
export type SimulationRunResult = z.infer<typeof simulationRunResultSchema>;
export type SimulationRunCreateInput = z.infer<typeof simulationRunCreateSchema>;
export type RunFlag = z.infer<typeof runFlagSchema>;
export type RunTimeSeriesMetric = z.infer<typeof runTimeSeriesMetricSchema>;
export type RunSegmentMetric = z.infer<typeof runSegmentMetricSchema>;
export type MilestoneEvaluation = z.infer<typeof milestoneEvaluationSchema>;
