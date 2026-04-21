import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import {
  evaluateFounderScenarioGuardrails,
  parseFounderSafeScenarioParameters,
  scenarioGuardrailMatrix,
  type DecisionPack,
  type DecisionPackHistoricalTruthCoverage,
  type MilestoneEvaluation,
  type RunFlag,
  type SimulationRunRequest,
  type StrategicObjectiveScorecard,
  type SummaryMetrics
} from "@bgc-alpha/schemas";
import { evaluateRecommendation, simulateScenario } from "@bgc-alpha/simulation-core";

import { upsertRunDecisionPack } from "./decision-packs";
import {
  getSnapshotTruthCoverage,
  getSnapshotCanonicalGapAudit,
  listSnapshotMemberMonthFacts,
  listSnapshotPoolPeriodFacts
} from "./snapshots";
import {
  getRunById,
  markRunFailed,
  markRunStarted,
  persistCompletedRun
} from "./runs";
import { writeAuditEvent } from "./audit";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency"
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const scenarioGuardrailByKey = new Map(
  scenarioGuardrailMatrix.map((entry) => [entry.parameter_key, entry] as const)
);

function readMetadataRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readRecordAlias(
  record: Record<string, unknown> | null,
  aliases: string[]
) {
  if (!record) {
    return null;
  }

  for (const alias of aliases) {
    const candidate = readMetadataRecord(record[alias]);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function readNumberAlias(
  record: Record<string, unknown> | null,
  aliases: string[]
) {
  if (!record) {
    return null;
  }

  for (const alias of aliases) {
    const candidate = readOptionalNumber(record[alias]);

    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function readStringAlias(
  record: Record<string, unknown> | null,
  aliases: string[]
) {
  if (!record) {
    return null;
  }

  for (const alias of aliases) {
    const candidate = readOptionalString(record[alias]);

    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function buildPoolFundingEntries(
  metadata: Record<string, unknown> | null,
  periodKey: string,
  sourceSystem: string
) {
  const poolFundingBasis = readRecordAlias(metadata, ["pool_funding_basis", "poolFundingBasis"]);
  const poolShareSnapshot = readRecordAlias(metadata, ["pool_share_snapshot", "poolShareSnapshot"]);

  if (!poolFundingBasis) {
    return null;
  }

  const entries = Object.entries(poolFundingBasis)
    .flatMap(([poolCode, poolValue]) => {
      const normalizedPoolValue = readMetadataRecord(poolValue);

      if (!normalizedPoolValue) {
        return [];
      }

      const fundingAmount = readNumberAlias(normalizedPoolValue, ["funding_amount", "fundingAmount"]);

      if (!(fundingAmount && fundingAmount > 0)) {
        return [];
      }

      const distributionAmount =
        readNumberAlias(normalizedPoolValue, ["distribution_amount", "distributionAmount"]) ?? 0;
      const distributionCycle =
        readStringAlias(normalizedPoolValue, ["distribution_cycle", "distributionCycle"]) ?? "ADHOC";
      const shareSnapshot = poolShareSnapshot
        ? readMetadataRecord(poolShareSnapshot[poolCode])
        : null;
      const eligibilitySnapshotKey =
        readStringAlias(shareSnapshot, ["eligibility_snapshot_key", "eligibilitySnapshotKey"]) ??
        `${periodKey}::${sourceSystem}::${poolCode}::${distributionCycle}`;

      return [
        {
          poolCode,
          fundingAmount,
          distributionAmount,
          distributionCycle,
          cycleKey: eligibilitySnapshotKey
        }
      ];
    })
    .sort((left, right) => left.poolCode.localeCompare(right.poolCode));

  return entries.length > 0 ? entries : null;
}

function buildSimulationFact(
  fact: Awaited<ReturnType<typeof listSnapshotMemberMonthFacts>>[number]
) {
  const metadata = readMetadataRecord(fact.metadataJson);
  const recognizedRevenueUsd =
    readNumberAlias(metadata, ["recognizedRevenueUsd", "recognized_revenue_usd"]);
  const grossMarginUsd =
    readNumberAlias(metadata, ["grossMarginUsd", "gross_margin_usd"]);
  const memberJoinPeriod =
    readStringAlias(metadata, ["memberJoinPeriod", "member_join_period"]);
  const isAffiliate =
    readOptionalBoolean(metadata?.isAffiliate) ?? readOptionalBoolean(metadata?.is_affiliate);
  const crossAppActive =
    readOptionalBoolean(metadata?.crossAppActive) ?? readOptionalBoolean(metadata?.cross_app_active);
  const recognizedRevenueBasis = readRecordAlias(metadata, [
    "recognized_revenue_basis",
    "recognizedRevenueBasis"
  ]);
  const sinkBreakdown = readRecordAlias(metadata, ["sink_breakdown_usd", "sinkBreakdownUsd"]);
  const entryFeeUsd = readNumberAlias(recognizedRevenueBasis, ["entry_fee_usd", "entryFeeUsd"]);
  const grossSaleUsd = readNumberAlias(recognizedRevenueBasis, ["gross_sale_usd", "grossSaleUsd"]);
  const cpUserShareUsd = readNumberAlias(recognizedRevenueBasis, ["cp_user_share_usd", "cpUserShareUsd"]);
  const ibPlatformRevenueUsd = readNumberAlias(recognizedRevenueBasis, [
    "ib_platform_revenue_usd",
    "ibPlatformRevenueUsd"
  ]);
  const productFulfillmentOutUsd = readNumberAlias(sinkBreakdown, ["PC_SPEND"]);

  let grossCashInUsd: number | null = null;
  let retainedRevenueUsd: number | null = recognizedRevenueUsd;
  let partnerPayoutOutUsd: number | null = null;

  if (entryFeeUsd !== null) {
    grossCashInUsd = entryFeeUsd;
    retainedRevenueUsd = entryFeeUsd;
  } else if (grossSaleUsd !== null) {
    grossCashInUsd = grossSaleUsd;
    retainedRevenueUsd = ibPlatformRevenueUsd ?? recognizedRevenueUsd;
    partnerPayoutOutUsd = cpUserShareUsd;
  } else if (recognizedRevenueUsd !== null) {
    grossCashInUsd = recognizedRevenueUsd;
    retainedRevenueUsd = recognizedRevenueUsd;
  }

  return {
    periodKey: fact.periodKey,
    memberKey: fact.memberKey,
    sourceSystem: fact.sourceSystem,
    memberTier: fact.memberTier,
    groupKey: fact.groupKey,
    pcVolume: fact.pcVolume,
    spRewardBasis: fact.spRewardBasis,
    globalRewardUsd: fact.globalRewardUsd,
    poolRewardUsd: fact.poolRewardUsd,
    cashoutUsd: fact.cashoutUsd,
    sinkSpendUsd: fact.sinkSpendUsd,
    activeMember: fact.activeMember,
    recognizedRevenueUsd,
    grossMarginUsd,
    memberJoinPeriod,
    isAffiliate,
    crossAppActive,
    grossCashInUsd,
    retainedRevenueUsd,
    partnerPayoutOutUsd,
    productFulfillmentOutUsd,
    poolFundingEntries: buildPoolFundingEntries(metadata, fact.periodKey, fact.sourceSystem)
  };
}

function buildSummary(run: Awaited<ReturnType<typeof getRunById>>): SummaryMetrics {
  const metricValue = (metricKey: string) =>
    run?.summaryMetrics.find((metric) => metric.metricKey === metricKey)?.metricValue ?? 0;

  return {
    alpha_issued_total: metricValue("alpha_issued_total"),
    alpha_spent_total: metricValue("alpha_spent_total"),
    alpha_held_total: metricValue("alpha_held_total"),
    alpha_cashout_equivalent_total: metricValue("alpha_cashout_equivalent_total"),
    company_gross_cash_in_total: metricValue("company_gross_cash_in_total"),
    company_retained_revenue_total: metricValue("company_retained_revenue_total"),
    company_partner_payout_out_total: metricValue("company_partner_payout_out_total"),
    company_direct_reward_obligation_total: metricValue("company_direct_reward_obligation_total"),
    company_pool_funding_obligation_total: metricValue("company_pool_funding_obligation_total"),
    company_actual_payout_out_total: metricValue("company_actual_payout_out_total"),
    company_product_fulfillment_out_total: metricValue("company_product_fulfillment_out_total"),
    company_net_treasury_delta_total: metricValue("company_net_treasury_delta_total"),
    sink_utilization_rate: metricValue("sink_utilization_rate"),
    payout_inflow_ratio: metricValue("payout_inflow_ratio"),
    reserve_runway_months: metricValue("reserve_runway_months"),
    reward_concentration_top10_pct: metricValue("reward_concentration_top10_pct")
  };
}

function buildFlags(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>): RunFlag[] {
  return run.flags.map((flag) => ({
    flag_type: flag.flagType,
    severity:
      flag.severity === "critical" || flag.severity === "warning" || flag.severity === "info"
        ? flag.severity
        : "warning",
    message: flag.message,
    period_key: flag.periodKey
  }));
}

function formatPercent(value: number) {
  return `${percentageFormatter.format(value)}%`;
}

function formatPlanningHorizon(months: number | null) {
  return months ? `${months} months` : "snapshot window";
}

function buildCohortProjectionValue(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>
) {
  const cohort = parameters.cohort_assumptions;

  if (
    cohort.new_members_per_month === 0 &&
    cohort.monthly_churn_rate_pct === 0 &&
    cohort.monthly_reactivation_rate_pct === 0
  ) {
    return "disabled in founder-safe mode";
  }

  return [
    `${cohort.new_members_per_month} new/mo`,
    `${formatPercent(cohort.monthly_churn_rate_pct)} churn`,
    `${formatPercent(cohort.monthly_reactivation_rate_pct)} reactivation`
  ].join(" · ");
}

function buildMilestoneValue(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>
) {
  if (parameters.milestone_schedule.length === 0) {
    return "none";
  }

  return `${parameters.milestone_schedule.length} milestone${
    parameters.milestone_schedule.length === 1 ? "" : "s"
  }`;
}

function buildRunRecommendedSetup(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>,
  summary: SummaryMetrics,
  recommendation: ReturnType<typeof evaluateRecommendation>,
  truthCoverage: DecisionPackHistoricalTruthCoverage
): DecisionPack["recommended_setup"] {
  const pushItem = (
    items: DecisionPack["recommended_setup"]["items"],
    parameterKey: string,
    label: string,
    value: string,
    status: "recommended" | "caution" | "locked"
  ) => {
    const guardrail = scenarioGuardrailByKey.get(parameterKey as never);

    items.push({
      parameter_key: parameterKey,
      label,
      value,
      status,
      rationale:
        guardrail?.business_rationale ??
        "This setup item is included to keep the recommended pilot envelope explicit."
    });
  };

  const items: DecisionPack["recommended_setup"]["items"] = [];

  pushItem(items, "k_pc", "k_pc", String(parameters.k_pc), "recommended");
  pushItem(items, "k_sp", "k_sp", String(parameters.k_sp), "recommended");
  pushItem(items, "cap_user_monthly", "User monthly cap", parameters.cap_user_monthly, "recommended");
  pushItem(items, "cap_group_monthly", "Group monthly cap", parameters.cap_group_monthly, "recommended");
  pushItem(items, "sink_target", "Sink target", String(parameters.sink_target), "caution");
  pushItem(items, "cashout_mode", "Cash-out mode", parameters.cashout_mode, "caution");
  pushItem(items, "cashout_min_usd", "Cash-out minimum", currencyFormatter.format(parameters.cashout_min_usd), "caution");
  pushItem(items, "cashout_fee_bps", "Cash-out fee", `${parameters.cashout_fee_bps} bps`, "caution");
  pushItem(items, "cashout_windows_per_year", "Cash-out windows / year", String(parameters.cashout_windows_per_year), "caution");
  pushItem(items, "cashout_window_days", "Cash-out window days", String(parameters.cashout_window_days), "caution");
  pushItem(items, "projection_horizon_months", "Projection horizon", formatPlanningHorizon(parameters.projection_horizon_months), "caution");
  pushItem(items, "milestone_schedule", "Milestone schedule", buildMilestoneValue(parameters), "caution");
  pushItem(items, "reward_global_factor", "Global reward factor", String(parameters.reward_global_factor), "locked");
  pushItem(items, "reward_pool_factor", "Pool reward factor", String(parameters.reward_pool_factor), "locked");
  pushItem(items, "cohort_assumptions", "Cohort projection", buildCohortProjectionValue(parameters), "locked");

  const warnings: string[] = [];

  if (truthCoverage.status !== "strong") {
    warnings.push("Historical truth coverage is not yet fully strong, so recommendation wording should stay calibrated.");
  }

  if (recommendation.policy_status !== "candidate") {
    warnings.push("This pilot envelope is still under review and should not be treated as the final default.");
  }

  if (summary.payout_inflow_ratio >= 1) {
    warnings.push("Treasury pressure is at or above retained revenue support and still needs founder review.");
  }

  return {
    title: "Recommended Pilot Envelope",
    summary:
      recommendation.policy_status === "candidate"
        ? "This run provides a founder-facing pilot envelope that stays explicit about which levers are policy choices and which truths remain fixed."
        : "This run exposes a draft pilot envelope, but the settings still need caution before they can be treated as the recommended default.",
    items,
    warnings
  };
}

function buildRunDecisionLog(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  summary: SummaryMetrics,
  recommendation: ReturnType<typeof evaluateRecommendation>,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[],
  truthCoverage: DecisionPackHistoricalTruthCoverage
): DecisionPack["decision_log"] {
  const proxyObjectives = strategicObjectives.filter((objective) => objective.evidence_level !== "direct");
  const riskyMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status !== "candidate");
  const log: DecisionPack["decision_log"] = [
    {
      key: "understanding_doc_truth",
      title: "Historical business truth stays fixed",
      status: "fixed_truth",
      owner: "Understanding Doc",
      rationale: `Run ${run.scenario.name} is evaluated on top of ${run.snapshot.name}; scenario levers do not rewrite imported business truth.`
    }
  ];

  log.push({
    key: "pilot_policy_envelope",
    title: "Pilot policy envelope from this run",
    status:
      recommendation.policy_status === "candidate"
        ? "recommended"
        : recommendation.policy_status === "risky"
          ? "pending_founder"
          : "blocked",
    owner: recommendation.policy_status === "candidate" ? "Founder" : "Founder",
    rationale:
      recommendation.policy_status === "candidate"
        ? `Treasury pressure is ${summary.payout_inflow_ratio.toFixed(2)}x with net treasury delta ${currencyFormatter.format(summary.company_net_treasury_delta_total)}.`
        : recommendation.policy_status === "risky"
          ? "This run is still usable for discussion, but founder review is required before it can become the pilot default."
          : "This run fails core treasury or cashflow thresholds and should not be promoted as the pilot default."
  });

  if (truthCoverage.status !== "strong") {
    log.push({
      key: "truth_coverage_gap",
      title: "Historical truth coverage still needs strengthening",
      status: "blocked",
      owner: "Data / Ops",
      rationale: truthCoverage.summary
    });
  }

  if (proxyObjectives.length > 0) {
    log.push({
      key: "strategic_evidence_gap",
      title: "Some strategic claims still rely on proxy or checklist evidence",
      status: "blocked",
      owner: "Data / Legal / Ops",
      rationale: proxyObjectives
        .map((objective) => `${objective.label} is ${objective.evidence_level}`)
        .join("; ")
    });
  }

  if (riskyMilestones.length > 0) {
    log.push({
      key: "milestone_governance_review",
      title: "Milestone promotion still needs founder review",
      status: "pending_founder",
      owner: "Founder",
      rationale: riskyMilestones
        .map((milestone) => `${milestone.label}: ${milestone.reasons[0] ?? milestone.policy_status}`)
        .join("; ")
    });
  }

  return log;
}

function buildRunTruthAssumptionMatrix(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>,
  truthCoverage: DecisionPackHistoricalTruthCoverage
): DecisionPack["truth_assumption_matrix"] {
  return [
    {
      key: "snapshot_truth",
      label: "Approved snapshot truth",
      value: run.snapshot.name,
      classification: "historical_truth",
      note: "Imported recognized revenue support and reward distributions remain fixed business truth."
    },
    {
      key: "truth_coverage",
      label: "Historical truth coverage",
      value: truthCoverage.status,
      classification: "derived_assessment",
      note: truthCoverage.summary
    },
    {
      key: "k_pc",
      label: "k_pc",
      value: String(parameters.k_pc),
      classification: "scenario_lever",
      note: "Allowed ALPHA conversion overlay on top of PC truth."
    },
    {
      key: "k_sp",
      label: "k_sp",
      value: String(parameters.k_sp),
      classification: "scenario_lever",
      note: "Allowed ALPHA conversion overlay on top of SP/LTS truth."
    },
    {
      key: "caps",
      label: "Monthly caps",
      value: `user ${parameters.cap_user_monthly} · group ${parameters.cap_group_monthly}`,
      classification: "scenario_lever",
      note: "Monthly issuance caps are policy levers and do not rewrite historical events."
    },
    {
      key: "cashout_policy",
      label: "Cash-out policy",
      value: `${parameters.cashout_mode} · ${currencyFormatter.format(parameters.cashout_min_usd)} min · ${parameters.cashout_fee_bps} bps`,
      classification: "scenario_assumption",
      note: "Cash-out release policy is an ALPHA overlay assumption, not historical business truth."
    },
    {
      key: "sink_target",
      label: "Sink target",
      value: String(parameters.sink_target),
      classification: "scenario_assumption",
      note: "Sink posture is a scenario assumption about desired internal use."
    },
    {
      key: "projection_horizon",
      label: "Projection horizon",
      value: formatPlanningHorizon(parameters.projection_horizon_months),
      classification: "scenario_assumption",
      note: "Any projection beyond the observed snapshot window must be read as an assumption."
    },
    {
      key: "milestone_schedule",
      label: "Milestone schedule",
      value: buildMilestoneValue(parameters),
      classification: "scenario_assumption",
      note: "Time-staged policy changes are governance assumptions layered on top of truth."
    },
    {
      key: "reward_factor_lock",
      label: "Global / pool reward factors",
      value: "locked to neutral baseline",
      classification: "locked_boundary",
      note: "Generic reward multipliers stay locked so named understanding-doc reward semantics are not distorted."
    },
    {
      key: "cohort_projection",
      label: "Synthetic cohort projection",
      value: buildCohortProjectionValue(parameters),
      classification: "locked_boundary",
      note: "Founder-safe mode keeps synthetic cohort projections outside the faithful business-truth envelope."
    }
  ];
}

function buildDecisionPack(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[],
  truthCoverage: DecisionPackHistoricalTruthCoverage,
  canonicalGapAudit: DecisionPack["canonical_gap_audit"]
): DecisionPack {
  const summary = buildSummary(run);
  const flags = buildFlags(run);
  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const recommendation = evaluateRecommendation(
    summary,
    flags,
    baselineModel.recommendationThresholds
  );
  const parameters = parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
    reward_global_factor: baselineModel.defaults.reward_global_factor,
    reward_pool_factor: baselineModel.defaults.reward_pool_factor
  });
  const strongObjectives = strategicObjectives.filter((objective) => objective.status === "candidate");
  const weakObjectives = strategicObjectives.filter((objective) => objective.status === "rejected");
  const proxyObjectives = strategicObjectives.filter((objective) => objective.evidence_level !== "direct");
  const failedMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status === "rejected");
  const riskyMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status === "risky");
  const recommendedSetup = buildRunRecommendedSetup(
    parameters,
    summary,
    recommendation,
    truthCoverage
  );
  const decisionLog = buildRunDecisionLog(
    run,
    summary,
    recommendation,
    strategicObjectives,
    milestoneEvaluations,
    truthCoverage
  );
  const truthAssumptionMatrix = buildRunTruthAssumptionMatrix(run, parameters, truthCoverage);

  return {
    title: `${run.scenario.name} Decision Pack`,
    policy_status: recommendation.policy_status,
    recommendation:
      recommendation.policy_status === "candidate"
        ? strongObjectives.length > 0
          ? "This scenario stays within the current treasury thresholds when measured against imported recognized revenue support and snapshot reward distributions, and the cashflow lens remains readable enough for founder review."
          : "This scenario stays within the current treasury thresholds when measured against imported recognized revenue support and snapshot reward distributions, but the strategic upside remains limited."
        : recommendation.policy_status === "risky"
          ? "This scenario is usable for discussion, but treasury pressure, concentration, or cashflow clarity still need founder review before adoption."
          : "This scenario breaches core treasury safety thresholds against recognized revenue support or produces an unacceptable cashflow posture and should not be used as the pilot default.",
    preferred_settings: [
      `Evaluated snapshot: ${run.snapshot.name}`,
      `Evaluated template: ${run.scenario.templateType}`,
      "Evaluation basis: imported recognized revenue support + snapshot reward distributions",
      `Gross cash in: ${currencyFormatter.format(summary.company_gross_cash_in_total)}`,
      `Retained revenue: ${currencyFormatter.format(summary.company_retained_revenue_total)}`,
      `Partner payout out: ${currencyFormatter.format(summary.company_partner_payout_out_total)}`,
      `Direct reward obligations: ${currencyFormatter.format(summary.company_direct_reward_obligation_total)}`,
      `Pool funding obligations: ${currencyFormatter.format(summary.company_pool_funding_obligation_total)}`,
      `Actual payout out: ${currencyFormatter.format(summary.company_actual_payout_out_total)}`,
      `Product fulfillment out: ${currencyFormatter.format(summary.company_product_fulfillment_out_total)}`,
      `Net treasury delta: ${currencyFormatter.format(summary.company_net_treasury_delta_total)}`,
      `Treasury pressure: ${summary.payout_inflow_ratio.toFixed(2)}x`,
      `Reserve runway: ${summary.reserve_runway_months.toFixed(2)} months`,
      `k_pc: ${parameters.k_pc}`,
      `k_sp: ${parameters.k_sp}`,
      `Cash-out mode: ${parameters.cashout_mode}`,
      `Sink target: ${parameters.sink_target}`,
      `Projection horizon: ${parameters.projection_horizon_months ?? "snapshot window"}`,
      `New members / month: ${parameters.cohort_assumptions.new_members_per_month}`,
      `Monthly churn: ${parameters.cohort_assumptions.monthly_churn_rate_pct}%`,
      `Monthly reactivation: ${parameters.cohort_assumptions.monthly_reactivation_rate_pct}%`,
      ...parameters.milestone_schedule.map(
        (milestone) =>
          `Milestone ${milestone.label}: starts month ${milestone.start_month}${
            milestone.end_month ? `, ends month ${milestone.end_month}` : ""
          }`
      ),
      ...milestoneEvaluations.map(
        (milestone) =>
          `Gate ${milestone.label}: ${milestone.policy_status} (${milestone.start_period_key} to ${milestone.end_period_key})`
      ),
      ...strongObjectives.map(
        (objective) =>
          `${objective.label}: ${objective.status} (${objective.score.toFixed(2)} / ${objective.evidence_level})`
      )
    ],
    rejected_settings: [
      ...flags.map((flag) => flag.message),
      ...failedMilestones.map(
        (milestone) =>
          `${milestone.label}: milestone gate failed (${milestone.reasons[0] ?? "Treasury thresholds are violated."})`
      ),
      ...weakObjectives.map(
        (objective) => `${objective.label}: ${objective.reasons[0] ?? "Strategic score is below threshold."}`
      )
    ],
    unresolved_questions: [
      "Confirm whether the selected snapshot has complete recognized revenue fields for the period under review.",
      "Confirm whether gross-cash, partner-payout, and product-fulfillment fields are complete enough for the current cashflow lens.",
      "Confirm whether the pilot should keep the current cash-out policy baseline or use a windowed override.",
      "Confirm whether the sink target aligns with the initial utility scope approved for Phase 1.",
      ...riskyMilestones.map(
        (milestone) =>
          `${milestone.label}: milestone gate is risky and still needs founder review before promotion.`
      ),
      ...proxyObjectives.map(
        (objective) =>
          `${objective.label}: evidence level is ${objective.evidence_level}, so stronger source data is still needed.`
      )
    ],
    strategic_objectives: strategicObjectives,
    milestone_evaluations: milestoneEvaluations,
    historical_truth_coverage: truthCoverage,
    recommended_setup: recommendedSetup,
    decision_log: decisionLog,
    truth_assumption_matrix: truthAssumptionMatrix,
    canonical_gap_audit: canonicalGapAudit
  };
}

export async function generateDecisionPackForRun(
  runId: string,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[]
) {
  const run = await getRunById(runId);

  if (!run) {
    throw new Error(`Run ${runId} was not found.`);
  }

  const truthCoverage =
    (await getSnapshotTruthCoverage(run.snapshotId)) ?? {
      status: "weak",
      summary: "Historical truth coverage could not be read for this snapshot.",
      rows: []
    };
  const canonicalGapAudit =
    (await getSnapshotCanonicalGapAudit(run.snapshotId)) ?? {
      readiness: "weak",
      summary: "Canonical fidelity audit could not be read for this snapshot.",
      rows: []
    };
  const pack = buildDecisionPack(
    run,
    strategicObjectives,
    milestoneEvaluations,
    truthCoverage,
    canonicalGapAudit
  );
  const savedPack = await upsertRunDecisionPack({
    runId,
    title: pack.title,
    recommendationJson: pack,
    createdBy: run.createdBy
  });

  await writeAuditEvent({
    actorUserId: run.createdBy,
    entityType: "decision_pack",
    entityId: savedPack.id,
    action: "decision_pack.generated",
    metadata: {
      runId,
      policyStatus: pack.policy_status
    }
  });

  return savedPack;
}

export async function processSimulationRun(runId: string) {
  const run = await getRunById(runId);

  if (!run) {
    throw new Error(`Run ${runId} was not found.`);
  }

  if (run.status === "COMPLETED") {
    if (!run.decisionPacks[0]) {
      const [facts, poolPeriodFacts] = await Promise.all([
        listSnapshotMemberMonthFacts(run.snapshotId),
        listSnapshotPoolPeriodFacts(run.snapshotId)
      ]);
      const baselineModel = resolveBaselineModelRuleset(
        run.modelVersion.rulesetJson,
        run.modelVersion.versionName
      );
      const input: SimulationRunRequest = {
        snapshotId: run.snapshotId,
        baselineModelVersionId: run.modelVersionId,
        scenario: {
          id: run.scenario.id,
          name: run.scenario.name,
          template: run.scenario.templateType as "Baseline" | "Conservative" | "Growth" | "Stress",
          parameters: parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
            reward_global_factor: baselineModel.defaults.reward_global_factor,
            reward_pool_factor: baselineModel.defaults.reward_pool_factor
          })
        }
      };
      const guardrailIssues = evaluateFounderScenarioGuardrails(input.scenario.parameters, {
        reward_global_factor: baselineModel.defaults.reward_global_factor,
        reward_pool_factor: baselineModel.defaults.reward_pool_factor
      });

      if (guardrailIssues.some((issue) => issue.severity === "ERROR")) {
        throw new Error(
          guardrailIssues
            .filter((issue) => issue.severity === "ERROR")
            .map((issue) => issue.message)
            .join(" ")
        );
      }

      const result = simulateScenario({
        request: input,
        facts: facts.map(buildSimulationFact),
        poolPeriodFacts: poolPeriodFacts.map((fact) => ({
          periodKey: fact.periodKey,
          poolCode: fact.poolCode,
          distributionCycle: fact.distributionCycle,
          unit: fact.unit,
          fundingAmount: fact.fundingAmount,
          distributionAmount: fact.distributionAmount,
          recipientCount: fact.recipientCount,
          shareCountTotal: fact.shareCountTotal
        })),
        baselineModel
      });

      await generateDecisionPackForRun(
        runId,
        result.strategic_objectives as StrategicObjectiveScorecard[],
        result.milestone_evaluations as MilestoneEvaluation[]
      );

      return getRunById(runId);
    }

    return run;
  }

  if (run.status === "RUNNING") {
    return run;
  }

  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const input: SimulationRunRequest = {
    snapshotId: run.snapshotId,
    baselineModelVersionId: run.modelVersionId,
    scenario: {
      id: run.scenario.id,
      name: run.scenario.name,
      template: run.scenario.templateType as "Baseline" | "Conservative" | "Growth" | "Stress",
      parameters: parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
        reward_global_factor: baselineModel.defaults.reward_global_factor,
        reward_pool_factor: baselineModel.defaults.reward_pool_factor
      })
    }
  };

  try {
    await markRunStarted(runId);

    const [facts, poolPeriodFacts] = await Promise.all([
      listSnapshotMemberMonthFacts(run.snapshotId),
      listSnapshotPoolPeriodFacts(run.snapshotId)
    ]);

    const result = simulateScenario({
      request: input,
      facts: facts.map(buildSimulationFact),
      poolPeriodFacts: poolPeriodFacts.map((fact) => ({
        periodKey: fact.periodKey,
        poolCode: fact.poolCode,
        distributionCycle: fact.distributionCycle,
        unit: fact.unit,
        fundingAmount: fact.fundingAmount,
        distributionAmount: fact.distributionAmount,
        recipientCount: fact.recipientCount,
        shareCountTotal: fact.shareCountTotal
      })),
      baselineModel
    });

    const persistedRun = await persistCompletedRun(runId, {
      summaryMetrics: {
        ...result.summary_metrics,
        ...result.strategic_metrics
      },
      timeSeriesMetrics: result.time_series_metrics,
      segmentMetrics: result.segment_metrics,
      flags: result.flags,
      recommendationSignals: result.recommendation_signals,
      runNotes: `policy_status=${result.recommendation_signals.policy_status}`
    });

    await generateDecisionPackForRun(
      runId,
      result.strategic_objectives as StrategicObjectiveScorecard[],
      result.milestone_evaluations as MilestoneEvaluation[]
    );

    await writeAuditEvent({
      actorUserId: persistedRun.createdBy,
      entityType: "simulation_run",
      entityId: runId,
      action: "run.completed",
      metadata: {
        policyStatus: result.recommendation_signals.policy_status,
        flagCount: result.flags.length
      }
    });

    return getRunById(runId);
  } catch (error) {
    await markRunFailed(runId, error instanceof Error ? error.message : "worker_run_failed");
    await writeAuditEvent({
      actorUserId: run.createdBy,
      entityType: "simulation_run",
      entityId: runId,
      action: "run.failed",
      metadata: {
        message: error instanceof Error ? error.message : "worker_run_failed"
      }
    });
    throw error;
  }
}
