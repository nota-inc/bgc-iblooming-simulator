import { z } from "zod";

import { strategicObjectiveScorecardSchema } from "./strategic";
import { milestoneEvaluationSchema } from "./run";

export const decisionPackSchema = z.object({
  title: z.string().min(1),
  policy_status: z.enum(["candidate", "risky", "rejected"]),
  recommendation: z.string(),
  preferred_settings: z.array(z.string()),
  rejected_settings: z.array(z.string()),
  unresolved_questions: z.array(z.string()),
  strategic_objectives: z.array(strategicObjectiveScorecardSchema).optional().default([]),
  milestone_evaluations: z.array(milestoneEvaluationSchema).optional().default([])
});

export type DecisionPack = z.infer<typeof decisionPackSchema>;
