import type {
  StrategicMetricUnit,
  StrategicObjectiveEvidenceLevel,
  StrategicObjectiveKey,
  StrategicObjectiveScorecard,
  SummaryMetrics
} from "@bgc-alpha/schemas";

type StrategicAssumptions = {
  score_thresholds: {
    candidate: number;
    risky: number;
  };
  revenue: {
    proxy_revenue_capture_rate: number;
    target_revenue_per_active_member: number;
    target_cross_app_share_pct: number;
  };
  ops_cost: {
    automation_coverage_score: number;
    target_cost_to_serve_index: number;
    cashout_ops_penalty_weight: number;
  };
  tax: {
    legal_readiness_score: number;
    compliance_structure_score: number;
    target_tax_event_reduction_pct: number;
  };
  affiliate: {
    target_activation_rate_pct: number;
    target_retention_rate_pct: number;
    target_productivity_share_pct: number;
  };
  active_user: {
    target_retention_rate_pct: number;
    target_cross_app_share_pct: number;
  };
};

export type StrategicBaselineModel = {
  strategicKpiAssumptions: StrategicAssumptions;
};

export type StrategicWorkingRow = {
  periodKey: string;
  memberKey: string;
  sourceSystem: string;
  memberTier?: string | null;
  issued: number;
  spent: number;
  cashout: number;
  activeMember: boolean;
  recognizedRevenueUsd?: number | null;
  grossMarginUsd?: number | null;
  memberJoinPeriod?: string | null;
  isAffiliate?: boolean | null;
  crossAppActive?: boolean | null;
  lifecycleStage: "existing" | "new" | "retained" | "reactivated" | "inactive";
};

type StrategicMetric = {
  metric_key: string;
  label: string;
  value: number;
  unit: StrategicMetricUnit;
};

type StrategicEvaluation = {
  strategic_metrics: Record<string, number>;
  strategic_objectives: StrategicObjectiveScorecard[];
};

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function statusFromScore(
  score: number,
  thresholds: StrategicAssumptions["score_thresholds"]
): StrategicObjectiveScorecard["status"] {
  if (score >= thresholds.candidate) {
    return "candidate";
  }

  if (score >= thresholds.risky) {
    return "risky";
  }

  return "rejected";
}

function scoreAgainstTarget(value: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return clamp(safeDivide(value, target) * 100, 0, 100);
}

function buildMetric(
  metricKey: string,
  label: string,
  value: number,
  unit: StrategicMetricUnit
): StrategicMetric {
  return {
    metric_key: metricKey,
    label,
    value: roundMetric(value),
    unit
  };
}

function buildScorecard(
  objectiveKey: StrategicObjectiveKey,
  label: string,
  score: number,
  evidenceLevel: StrategicObjectiveEvidenceLevel,
  primaryMetrics: StrategicMetric[],
  reasons: string[],
  thresholds: StrategicAssumptions["score_thresholds"]
): StrategicObjectiveScorecard {
  return {
    objective_key: objectiveKey,
    label,
    score: roundMetric(clamp(score, 0, 100)),
    status: statusFromScore(score, thresholds),
    evidence_level: evidenceLevel,
    primary_metrics: primaryMetrics,
    reasons
  };
}

function extractMemberPeriodHistory(rows: StrategicWorkingRow[]) {
  const periods = [...new Set(rows.map((row) => row.periodKey))].sort();
  const earliestPeriod = periods[0] ?? null;
  const activePeriodsByMember = new Map<string, Set<string>>();
  const sourceSystemsByMember = new Map<string, Set<string>>();
  const firstSeenPeriodByMember = new Map<string, string>();
  const explicitCrossAppMembers = new Set<string>();

  for (const row of rows) {
    if (row.activeMember) {
      const activePeriods = activePeriodsByMember.get(row.memberKey) ?? new Set<string>();
      activePeriods.add(row.periodKey);
      activePeriodsByMember.set(row.memberKey, activePeriods);
    }

    const sourceSystems = sourceSystemsByMember.get(row.memberKey) ?? new Set<string>();
    sourceSystems.add(row.sourceSystem);
    sourceSystemsByMember.set(row.memberKey, sourceSystems);

    const firstSeen = firstSeenPeriodByMember.get(row.memberKey);

    if (!firstSeen || row.periodKey < firstSeen) {
      firstSeenPeriodByMember.set(row.memberKey, row.periodKey);
    }

    if (row.crossAppActive) {
      explicitCrossAppMembers.add(row.memberKey);
    }
  }

  const crossAppMembers = new Set(
    [...sourceSystemsByMember.entries()]
      .filter(([, sourceSystems]) => sourceSystems.size > 1)
      .map(([memberKey]) => memberKey)
  );

  for (const memberKey of explicitCrossAppMembers) {
    crossAppMembers.add(memberKey);
  }

  return {
    periods,
    earliestPeriod,
    activePeriodsByMember,
    firstSeenPeriodByMember,
    crossAppMembers
  };
}

function evaluateRevenue(
  rows: StrategicWorkingRow[],
  summary: SummaryMetrics,
  assumptions: StrategicAssumptions,
  history: ReturnType<typeof extractMemberPeriodHistory>
) {
  const activeMemberCount = new Set(
    rows.filter((row) => row.activeMember).map((row) => row.memberKey)
  ).size;
  const directRevenueTotal = rows.reduce(
    (total, row) => total + (row.recognizedRevenueUsd ?? 0),
    0
  );
  const directMarginTotal = rows.reduce((total, row) => total + (row.grossMarginUsd ?? 0), 0);
  const directDataAvailable = directRevenueTotal > 0 || directMarginTotal > 0;
  const proxyRevenueTotal = rows.reduce(
    (total, row) => total + row.spent * assumptions.revenue.proxy_revenue_capture_rate,
    0
  );
  const revenueTotal = directDataAvailable ? directRevenueTotal : proxyRevenueTotal;
  const grossMarginTotal = directMarginTotal > 0 ? directMarginTotal : revenueTotal * 0.35;
  const revenuePerActiveMember = safeDivide(revenueTotal, activeMemberCount);
  const crossAppRevenueTotal = rows.reduce((total, row) => {
    const revenueBasis = directDataAvailable
      ? row.recognizedRevenueUsd ?? 0
      : row.spent * assumptions.revenue.proxy_revenue_capture_rate;

    return history.crossAppMembers.has(row.memberKey) ? total + revenueBasis : total;
  }, 0);
  const crossAppRevenueShare = safeDivide(crossAppRevenueTotal, revenueTotal) * 100;
  const sinkToRevenueRatio = safeDivide(summary.alpha_spent_total, Math.max(revenueTotal, 1));
  const score =
    scoreAgainstTarget(
      revenuePerActiveMember,
      assumptions.revenue.target_revenue_per_active_member
    ) * 0.5 +
    scoreAgainstTarget(crossAppRevenueShare, assumptions.revenue.target_cross_app_share_pct) * 0.25 +
    clamp(summary.sink_utilization_rate, 0, 100) * 0.25;
  const evidenceLevel: StrategicObjectiveEvidenceLevel = directDataAvailable ? "direct" : "proxy";
  const reasons = [
    directDataAvailable
      ? "Uses imported recognized revenue or margin fields as direct evidence."
      : "Uses spend-to-revenue proxy logic because direct revenue fields are missing.",
    revenuePerActiveMember >= assumptions.revenue.target_revenue_per_active_member
      ? "Revenue per active member is at or above the current target."
      : "Revenue per active member is still below the current target.",
    crossAppRevenueShare >= assumptions.revenue.target_cross_app_share_pct
      ? "Cross-app revenue participation is broad enough to support ecosystem growth."
      : "Cross-app revenue share is still too narrow to prove ecosystem-level lift."
  ];
  const primaryMetrics = [
    buildMetric("strategic.revenue.revenue_recognized_total", "Revenue recognized", revenueTotal, "value"),
    buildMetric(
      "strategic.revenue.revenue_per_active_member",
      "Revenue per active member",
      revenuePerActiveMember,
      "value"
    ),
    buildMetric(
      "strategic.revenue.cross_app_revenue_share",
      "Cross-app revenue share",
      crossAppRevenueShare,
      "percent"
    )
  ];

  return {
    metrics: {
      "strategic.revenue.revenue_recognized_total": roundMetric(revenueTotal),
      "strategic.revenue.gross_margin_total": roundMetric(grossMarginTotal),
      "strategic.revenue.revenue_per_active_member": roundMetric(revenuePerActiveMember),
      "strategic.revenue.cross_app_revenue_share": roundMetric(crossAppRevenueShare),
      "strategic.revenue.sink_to_revenue_ratio": roundMetric(sinkToRevenueRatio),
      "strategic.revenue.revenue_growth_index": roundMetric(score),
      "strategic.revenue.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "revenue",
      "Revenue Growth",
      score,
      evidenceLevel,
      primaryMetrics,
      reasons,
      assumptions.score_thresholds
    )
  };
}

function evaluateOpsCost(
  rows: StrategicWorkingRow[],
  summary: SummaryMetrics,
  assumptions: StrategicAssumptions
) {
  const activeMemberCount = new Set(
    rows.filter((row) => row.activeMember).map((row) => row.memberKey)
  ).size;
  const manualOpsProxyTotal = rows.filter((row) => row.cashout > 0).length;
  const cashoutOpsLoadIndex = safeDivide(manualOpsProxyTotal, Math.max(activeMemberCount, 1)) * 100;
  const costPerActiveMemberProxy = safeDivide(manualOpsProxyTotal, Math.max(activeMemberCount, 1));
  const costToServeIndex = clamp(
    assumptions.ops_cost.automation_coverage_score * 0.4 +
      clamp(summary.sink_utilization_rate, 0, 100) * 0.35 +
      clamp(
        100 - cashoutOpsLoadIndex * assumptions.ops_cost.cashout_ops_penalty_weight,
        0,
        100
      ) *
        0.25,
    0,
    100
  );
  const reasons = [
    "Uses proxy metrics based on cash-out load, sink usage, and assumed automation coverage.",
    costToServeIndex >= assumptions.ops_cost.target_cost_to_serve_index
      ? "The modeled operating pattern is efficient enough for the current target."
      : "Cash-out handling and manual servicing pressure still look too heavy.",
    summary.alpha_cashout_equivalent_total <= summary.alpha_spent_total
      ? "Spend behavior is helping reduce service pressure versus pure cash extraction."
      : "Cash-out behavior is still dominating spend and increasing service burden."
  ];
  const score = costToServeIndex;
  const primaryMetrics = [
    buildMetric(
      "strategic.ops_cost.cost_to_serve_index",
      "Cost-to-serve index",
      costToServeIndex,
      "score"
    ),
    buildMetric(
      "strategic.ops_cost.cashout_ops_load_index",
      "Cash-out ops load",
      cashoutOpsLoadIndex,
      "percent"
    ),
    buildMetric(
      "strategic.ops_cost.automation_coverage_score",
      "Automation coverage",
      assumptions.ops_cost.automation_coverage_score,
      "score"
    )
  ];

  return {
    metrics: {
      "strategic.ops_cost.cost_to_serve_index": roundMetric(costToServeIndex),
      "strategic.ops_cost.cashout_ops_load_index": roundMetric(cashoutOpsLoadIndex),
      "strategic.ops_cost.manual_ops_proxy_total": roundMetric(manualOpsProxyTotal),
      "strategic.ops_cost.cost_per_active_member_proxy": roundMetric(costPerActiveMemberProxy),
      "strategic.ops_cost.automation_coverage_score": roundMetric(
        assumptions.ops_cost.automation_coverage_score
      ),
      "strategic.ops_cost.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "ops_cost",
      "Operational Cost Reduction",
      score,
      "proxy",
      primaryMetrics,
      reasons,
      assumptions.score_thresholds
    )
  };
}

function evaluateTax(summary: SummaryMetrics, assumptions: StrategicAssumptions) {
  const taxEventReductionProxyPct = clamp(
    100 - safeDivide(summary.alpha_cashout_equivalent_total, Math.max(summary.alpha_issued_total, 1)) * 100,
    0,
    100
  );
  const jurisdictionFitScore =
    (assumptions.tax.legal_readiness_score + assumptions.tax.compliance_structure_score) / 2;
  const score =
    scoreAgainstTarget(
      taxEventReductionProxyPct,
      assumptions.tax.target_tax_event_reduction_pct
    ) * 0.3 +
    clamp(assumptions.tax.legal_readiness_score, 0, 100) * 0.35 +
    clamp(assumptions.tax.compliance_structure_score, 0, 100) * 0.35;
  const reasons = [
    "This is a checklist-based scorecard and not a direct tax simulation.",
    taxEventReductionProxyPct >= assumptions.tax.target_tax_event_reduction_pct
      ? "Cash-out pressure is low enough to support a cleaner transaction structure."
      : "Cash-out pressure still looks too high to claim meaningful tax-event reduction.",
    assumptions.tax.legal_readiness_score >= 50
      ? "Legal readiness assumptions are progressing toward an implementation path."
      : "Legal readiness remains an explicit blocker for stronger tax claims."
  ];
  const primaryMetrics = [
    buildMetric(
      "strategic.tax.tax_event_reduction_proxy_pct",
      "Tax-event reduction proxy",
      taxEventReductionProxyPct,
      "percent"
    ),
    buildMetric(
      "strategic.tax.legal_readiness_score",
      "Legal readiness",
      assumptions.tax.legal_readiness_score,
      "score"
    ),
    buildMetric(
      "strategic.tax.compliance_structure_score",
      "Compliance structure",
      assumptions.tax.compliance_structure_score,
      "score"
    )
  ];

  return {
    metrics: {
      "strategic.tax.tax_event_reduction_proxy_pct": roundMetric(taxEventReductionProxyPct),
      "strategic.tax.legal_readiness_score": roundMetric(assumptions.tax.legal_readiness_score),
      "strategic.tax.compliance_structure_score": roundMetric(
        assumptions.tax.compliance_structure_score
      ),
      "strategic.tax.jurisdiction_fit_score": roundMetric(jurisdictionFitScore),
      "strategic.tax.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "tax",
      "Tax Optimization",
      score,
      "checklist",
      primaryMetrics,
      reasons,
      assumptions.score_thresholds
    )
  };
}

function evaluateAffiliate(
  rows: StrategicWorkingRow[],
  summary: SummaryMetrics,
  assumptions: StrategicAssumptions,
  history: ReturnType<typeof extractMemberPeriodHistory>
) {
  const explicitAffiliateRows = rows.filter((row) => row.isAffiliate === true);
  const directAffiliateEvidence = explicitAffiliateRows.length > 0;
  const affiliateMembers = new Set(
    (directAffiliateEvidence
      ? explicitAffiliateRows
      : rows.filter((row) => ["builder", "leader"].includes(row.memberTier?.toLowerCase() ?? "")))
      .map((row) => row.memberKey)
  );
  const activeAffiliateMembers = new Set(
    rows.filter((row) => row.activeMember && affiliateMembers.has(row.memberKey)).map((row) => row.memberKey)
  );
  const affiliateRetentionMembers = new Set(
    [...history.activePeriodsByMember.entries()]
      .filter(([memberKey, activePeriods]) => affiliateMembers.has(memberKey) && activePeriods.size >= 2)
      .map(([memberKey]) => memberKey)
  );
  const newAffiliateMembers = new Set(
    rows
      .filter((row) => {
        if (!affiliateMembers.has(row.memberKey) || !row.activeMember) {
          return false;
        }

        if (row.memberJoinPeriod) {
          return row.memberJoinPeriod === row.periodKey;
        }

        return history.earliestPeriod !== null && history.firstSeenPeriodByMember.get(row.memberKey) !== history.earliestPeriod;
      })
      .map((row) => row.memberKey)
  );
  const affiliateIssuedTotal = rows.reduce(
    (total, row) => total + (affiliateMembers.has(row.memberKey) ? row.issued : 0),
    0
  );
  const activationRate = safeDivide(activeAffiliateMembers.size, affiliateMembers.size) * 100;
  const retentionRate = safeDivide(affiliateRetentionMembers.size, affiliateMembers.size) * 100;
  const productivityShare = safeDivide(affiliateIssuedTotal, Math.max(summary.alpha_issued_total, 1)) * 100;
  const score =
    scoreAgainstTarget(activationRate, assumptions.affiliate.target_activation_rate_pct) * 0.4 +
    scoreAgainstTarget(retentionRate, assumptions.affiliate.target_retention_rate_pct) * 0.35 +
    scoreAgainstTarget(productivityShare, assumptions.affiliate.target_productivity_share_pct) * 0.25;
  const evidenceLevel: StrategicObjectiveEvidenceLevel = directAffiliateEvidence ? "direct" : "proxy";
  const reasons = [
    directAffiliateEvidence
      ? "Uses imported affiliate flags as direct evidence."
      : "Uses member-tier proxy logic because explicit affiliate fields are missing.",
    activationRate >= assumptions.affiliate.target_activation_rate_pct
      ? "Affiliate activation is strong enough for the current target."
      : "Affiliate activation is still below the current target.",
    retentionRate >= assumptions.affiliate.target_retention_rate_pct
      ? "Affiliate retention is stable enough to support expansion."
      : "Affiliate retention still looks fragile across periods."
  ];
  const primaryMetrics = [
    buildMetric(
      "strategic.affiliate.active_affiliate_count",
      "Active affiliates",
      activeAffiliateMembers.size,
      "count"
    ),
    buildMetric(
      "strategic.affiliate.affiliate_activation_rate",
      "Affiliate activation rate",
      activationRate,
      "percent"
    ),
    buildMetric(
      "strategic.affiliate.affiliate_retention_rate",
      "Affiliate retention rate",
      retentionRate,
      "percent"
    )
  ];

  return {
    metrics: {
      "strategic.affiliate.new_affiliate_count": roundMetric(newAffiliateMembers.size),
      "strategic.affiliate.active_affiliate_count": roundMetric(activeAffiliateMembers.size),
      "strategic.affiliate.affiliate_activation_rate": roundMetric(activationRate),
      "strategic.affiliate.affiliate_retention_rate": roundMetric(retentionRate),
      "strategic.affiliate.affiliate_productivity_share": roundMetric(productivityShare),
      "strategic.affiliate.affiliate_growth_index": roundMetric(score),
      "strategic.affiliate.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "affiliate",
      "Affiliate Acquisition",
      score,
      evidenceLevel,
      primaryMetrics,
      reasons,
      assumptions.score_thresholds
    )
  };
}

function evaluateActiveUsers(
  rows: StrategicWorkingRow[],
  assumptions: StrategicAssumptions,
  history: ReturnType<typeof extractMemberPeriodHistory>
) {
  const activeMembers = new Set(
    rows.filter((row) => row.activeMember).map((row) => row.memberKey)
  );
  const directLifecycleEvidence = rows.some(
    (row) => Boolean(row.memberJoinPeriod) || row.crossAppActive === true
  );
  const retainedMembers = new Set(
    [...history.activePeriodsByMember.entries()]
      .filter(([, activePeriods]) => activePeriods.size >= 2)
      .map(([memberKey]) => memberKey)
  );
  const newActiveMembers = new Set(
    rows
      .filter((row) => {
        if (!row.activeMember) {
          return false;
        }

        if (row.memberJoinPeriod) {
          return row.memberJoinPeriod === row.periodKey;
        }

        return history.earliestPeriod !== null && history.firstSeenPeriodByMember.get(row.memberKey) !== history.earliestPeriod;
      })
      .map((row) => row.memberKey)
  );
  const reactivatedMembers = new Set(
    rows.filter((row) => row.lifecycleStage === "reactivated").map((row) => row.memberKey)
  );
  const crossAppActiveShare = safeDivide(
    [...activeMembers].filter((memberKey) => history.crossAppMembers.has(memberKey)).length,
    Math.max(activeMembers.size, 1)
  ) * 100;
  const retainedShare = safeDivide(retainedMembers.size, Math.max(activeMembers.size, 1)) * 100;
  const newActiveShare = safeDivide(newActiveMembers.size, Math.max(activeMembers.size, 1)) * 100;
  const score =
    scoreAgainstTarget(retainedShare, assumptions.active_user.target_retention_rate_pct) * 0.5 +
    scoreAgainstTarget(crossAppActiveShare, assumptions.active_user.target_cross_app_share_pct) * 0.3 +
    clamp(newActiveShare * 2, 0, 100) * 0.2;
  const evidenceLevel: StrategicObjectiveEvidenceLevel = directLifecycleEvidence ? "direct" : "proxy";
  const reasons = [
    directLifecycleEvidence
      ? "Uses imported lifecycle or cross-app activity fields as direct evidence."
      : "Uses member-history proxy logic because direct lifecycle fields are missing.",
    retainedShare >= assumptions.active_user.target_retention_rate_pct
      ? "Active-user retention is strong enough for the current target."
      : "Active-user retention is still below the current target.",
    crossAppActiveShare >= assumptions.active_user.target_cross_app_share_pct
      ? "Cross-app activity is broad enough to support ecosystem stickiness."
      : "Cross-app activity is still too narrow to prove durable ecosystem growth."
  ];
  const primaryMetrics = [
    buildMetric(
      "strategic.active_user.active_user_count",
      "Active users",
      activeMembers.size,
      "count"
    ),
    buildMetric(
      "strategic.active_user.retained_active_user_count",
      "Retained active users",
      retainedMembers.size,
      "count"
    ),
    buildMetric(
      "strategic.active_user.cross_app_active_user_share",
      "Cross-app active-user share",
      crossAppActiveShare,
      "percent"
    )
  ];

  return {
    metrics: {
      "strategic.active_user.active_user_count": roundMetric(activeMembers.size),
      "strategic.active_user.new_active_user_count": roundMetric(newActiveMembers.size),
      "strategic.active_user.retained_active_user_count": roundMetric(retainedMembers.size),
      "strategic.active_user.reactivated_user_count": roundMetric(reactivatedMembers.size),
      "strategic.active_user.cross_app_active_user_share": roundMetric(crossAppActiveShare),
      "strategic.active_user.active_user_growth_index": roundMetric(score),
      "strategic.active_user.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "active_user",
      "Active-User Growth",
      score,
      evidenceLevel,
      primaryMetrics,
      reasons,
      assumptions.score_thresholds
    )
  };
}

export function evaluateStrategicObjectives(input: {
  rows: StrategicWorkingRow[];
  summary: SummaryMetrics;
  baselineModel: StrategicBaselineModel;
}): StrategicEvaluation {
  const assumptions = input.baselineModel.strategicKpiAssumptions;
  const history = extractMemberPeriodHistory(input.rows);
  const revenue = evaluateRevenue(input.rows, input.summary, assumptions, history);
  const opsCost = evaluateOpsCost(input.rows, input.summary, assumptions);
  const tax = evaluateTax(input.summary, assumptions);
  const affiliate = evaluateAffiliate(input.rows, input.summary, assumptions, history);
  const activeUser = evaluateActiveUsers(input.rows, assumptions, history);

  return {
    strategic_metrics: {
      ...revenue.metrics,
      ...opsCost.metrics,
      ...tax.metrics,
      ...affiliate.metrics,
      ...activeUser.metrics
    },
    strategic_objectives: [
      revenue.scorecard,
      opsCost.scorecard,
      tax.scorecard,
      affiliate.scorecard,
      activeUser.scorecard
    ]
  };
}
