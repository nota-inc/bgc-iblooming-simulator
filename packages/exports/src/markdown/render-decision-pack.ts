import type { DecisionPack } from "@bgc-alpha/schemas";

const policyStatusLabels: Record<string, string> = {
  candidate: "Ready",
  risky: "Needs Review",
  rejected: "Do Not Use"
};

const evidenceLevelLabels: Record<string, string> = {
  checklist: "Checklist Only",
  direct: "Direct Data",
  proxy: "Proxy Estimate"
};

const objectiveLabels: Record<string, string> = {
  active_user: "Active-User Growth",
  affiliate: "Affiliate Acquisition",
  ops_cost: "Operational Cost Reduction",
  revenue: "Revenue Growth",
  tax: "Tax Optimization"
};

function getPolicyStatusLabel(value: string) {
  return policyStatusLabels[value] ?? value;
}

function getEvidenceLevelLabel(value: string) {
  return evidenceLevelLabels[value] ?? value;
}

function getObjectiveLabel(value: string) {
  return objectiveLabels[value] ?? value;
}

export function renderDecisionPackMarkdown(pack: DecisionPack) {
  return `# ${pack.title}

## Policy Status

${getPolicyStatusLabel(pack.policy_status)}

## Recommendation

${pack.recommendation}

## Preferred Settings

${pack.preferred_settings.map((item) => `- ${item}`).join("\n")}

## Rejected Settings

${pack.rejected_settings.map((item) => `- ${item}`).join("\n")}

## Strategic Objectives

${
  pack.strategic_objectives.length === 0
    ? "No strategic scorecards were generated for this run."
    : pack.strategic_objectives
        .map(
          (objective) => `### ${objective.label}

- Status: ${getPolicyStatusLabel(objective.status)}
- Score: ${objective.score}
- Evidence: ${getEvidenceLevelLabel(objective.evidence_level)}
- Primary metrics:
${objective.primary_metrics
  .map((metric) => `  - ${metric.label}: ${metric.value} (${metric.unit})`)
  .join("\n")}
- Reasons:
${objective.reasons.map((reason) => `  - ${reason}`).join("\n")}`
        )
        .join("\n\n")
}

## Milestone Gates

${
  pack.milestone_evaluations.length === 0
    ? "No milestone gate evaluations were generated for this run."
    : pack.milestone_evaluations
        .map(
          (milestone) => `### ${milestone.label}

- Period: ${milestone.start_period_key} to ${milestone.end_period_key}
- Status: ${getPolicyStatusLabel(milestone.policy_status)}
- Payout / Inflow: ${milestone.summary_metrics.payout_inflow_ratio}
- Reserve runway: ${milestone.summary_metrics.reserve_runway_months}
- Reward concentration top 10%: ${milestone.summary_metrics.reward_concentration_top10_pct}
- Strong objectives: ${milestone.strong_objectives.map(getObjectiveLabel).join(", ") || "none"}
- Weak objectives: ${milestone.weak_objectives.map(getObjectiveLabel).join(", ") || "none"}
- Reasons:
${milestone.reasons.map((reason) => `  - ${reason}`).join("\n")}`
        )
        .join("\n\n")
}

## Unresolved Questions

${pack.unresolved_questions.map((item) => `- ${item}`).join("\n")}
`;
}
