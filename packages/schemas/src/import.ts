import { z } from "zod";

export const snapshotImportStatusSchema = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]);

export const snapshotImportCsvHeaders = [
  "period_key",
  "member_key",
  "source_system",
  "member_tier",
  "group_key",
  "pc_volume",
  "sp_reward_basis",
  "global_reward_usd",
  "pool_reward_usd",
  "cashout_usd",
  "sink_spend_usd",
  "active_member"
] as const;

export const snapshotImportCsvRowSchema = z.object({
  period_key: z.string().min(1),
  member_key: z.string().min(1),
  source_system: z.string().min(1),
  member_tier: z.string().optional().default(""),
  group_key: z.string().optional().default(""),
  pc_volume: z.string().min(1),
  sp_reward_basis: z.string().min(1),
  global_reward_usd: z.string().min(1),
  pool_reward_usd: z.string().min(1),
  cashout_usd: z.string().min(1),
  sink_spend_usd: z.string().min(1),
  active_member: z.string().min(1),
  recognized_revenue_usd: z.string().optional().default(""),
  gross_margin_usd: z.string().optional().default(""),
  member_join_period: z.string().optional().default(""),
  is_affiliate: z.string().optional().default(""),
  cross_app_active: z.string().optional().default(""),
  extra_json: z.string().optional().default("")
});

export const snapshotMemberMonthFactSchema = z.object({
  periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  memberKey: z.string().min(1),
  sourceSystem: z.string().min(1),
  memberTier: z.string().min(1).nullable().optional(),
  groupKey: z.string().min(1).nullable().optional(),
  pcVolume: z.number().min(0),
  spRewardBasis: z.number().min(0),
  globalRewardUsd: z.number().min(0),
  poolRewardUsd: z.number().min(0),
  cashoutUsd: z.number().min(0),
  sinkSpendUsd: z.number().min(0),
  activeMember: z.boolean(),
  metadataJson: z.record(z.unknown()).nullable().optional()
});

export const snapshotImportJobSchema = z.object({
  snapshotId: z.string().min(1),
  importRunId: z.string().min(1)
});

export type SnapshotImportCsvRow = z.infer<typeof snapshotImportCsvRowSchema>;
export type SnapshotMemberMonthFact = z.infer<typeof snapshotMemberMonthFactSchema>;
export type SnapshotImportJob = z.infer<typeof snapshotImportJobSchema>;
