import { z } from "zod";

export const scenarioTemplateSchema = z.enum([
  "Baseline",
  "Conservative",
  "Growth",
  "Stress"
]);

export const scenarioCohortAssumptionsSchema = z.object({
  new_members_per_month: z.number().int().min(0).optional().default(0),
  monthly_churn_rate_pct: z.number().min(0).max(100).optional().default(0),
  monthly_reactivation_rate_pct: z.number().min(0).max(100).optional().default(0),
  affiliate_new_member_share_pct: z.number().min(0).max(100).optional().default(0),
  cross_app_adoption_rate_pct: z.number().min(0).max(100).optional().default(0),
  new_member_value_factor: z.number().min(0).max(10).optional().default(0.6),
  reactivated_member_value_factor: z.number().min(0).max(10).optional().default(0.7)
});

export const scenarioCoreParametersSchema = z.object({
  k_pc: z.number().positive(),
  k_sp: z.number().positive(),
  reward_global_factor: z.number().positive(),
  reward_pool_factor: z.number().positive(),
  cap_user_monthly: z.string(),
  cap_group_monthly: z.string(),
  sink_target: z.number().min(0).max(1),
  cashout_mode: z.enum(["ALWAYS_OPEN", "WINDOWS"]),
  cashout_min_usd: z.number().min(0),
  cashout_fee_bps: z.number().min(0).max(10000),
  cashout_windows_per_year: z.number().int().positive(),
  cashout_window_days: z.number().int().positive(),
  cohort_assumptions: scenarioCohortAssumptionsSchema.optional().default({})
});

export const scenarioParameterOverrideSchema = scenarioCoreParametersSchema
  .omit({
    cohort_assumptions: true
  })
  .partial()
  .extend({
    cohort_assumptions: scenarioCohortAssumptionsSchema.partial().optional()
  });

export const scenarioMilestoneScheduleItemSchema = z
  .object({
    milestone_key: z.string().min(1),
    label: z.string().min(1),
    start_month: z.number().int().positive(),
    end_month: z.number().int().positive().nullable().optional(),
    parameter_overrides: scenarioParameterOverrideSchema.optional().default({})
  })
  .superRefine((value, context) => {
    if (value.end_month !== null && value.end_month !== undefined && value.end_month < value.start_month) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_month"],
        message: "end_month must be greater than or equal to start_month."
      });
    }
  });

export const scenarioParametersSchema = scenarioCoreParametersSchema
  .extend({
    projection_horizon_months: z.number().int().positive().nullable().optional().default(null),
    milestone_schedule: z.array(scenarioMilestoneScheduleItemSchema).optional().default([])
  })
  .superRefine((value, context) => {
    const milestoneKeys = new Set<string>();

    for (const [index, milestone] of value.milestone_schedule.entries()) {
      if (milestoneKeys.has(milestone.milestone_key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["milestone_schedule", index, "milestone_key"],
          message: "milestone_key must be unique within one scenario."
        });
      }

      milestoneKeys.add(milestone.milestone_key);
    }
  });

export const scenarioSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  template: scenarioTemplateSchema,
  parameters: scenarioParametersSchema
});

export const createScenarioSchema = z.object({
  name: z.string().min(3),
  templateType: scenarioTemplateSchema,
  description: z.string().max(1000).nullable().optional(),
  snapshotIdDefault: z.string().min(1).nullable().optional(),
  modelVersionId: z.string().min(1),
  parameters: scenarioParametersSchema
});

export const updateScenarioSchema = createScenarioSchema.extend({
  id: z.string().min(1)
});

export type ScenarioInput = z.infer<typeof scenarioSchema>;
export type ScenarioParameters = z.infer<typeof scenarioParametersSchema>;
export type ScenarioParameterOverride = z.infer<typeof scenarioParameterOverrideSchema>;
export type ScenarioMilestoneScheduleItem = z.infer<typeof scenarioMilestoneScheduleItemSchema>;
export type ScenarioCohortAssumptions = z.infer<typeof scenarioCohortAssumptionsSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
