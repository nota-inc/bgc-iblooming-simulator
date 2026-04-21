import type {
  DecisionPackDecisionLogEntry,
  DecisionPackHistoricalTruthCoverage,
  DecisionPackRecommendedSetup,
  DecisionPackTruthAssumptionItem
} from "@bgc-alpha/schemas";

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

type GuardrailStatus = "allowed" | "conditional" | "locked";
type ParameterKind = "number" | "currency" | "percent" | "string" | "integer" | "months";

export type CompareDecisionSupportParameters = {
  k_pc: number;
  k_sp: number;
  reward_global_factor: number;
  reward_pool_factor: number;
  cap_user_monthly: string;
  cap_group_monthly: string;
  sink_target: number;
  cashout_mode: "ALWAYS_OPEN" | "WINDOWS";
  cashout_min_usd: number;
  cashout_fee_bps: number;
  cashout_windows_per_year: number;
  cashout_window_days: number;
  projection_horizon_months: number | null;
  milestone_count: number;
  cohort_projection_label: string;
};

export type CompareDecisionSupportRun = {
  id: string;
  label: string;
  scenarioName: string;
  snapshotName: string;
  verdict: string;
  summaryMetrics: Record<string, number>;
  parameters: CompareDecisionSupportParameters;
  historicalTruthCoverage: DecisionPackHistoricalTruthCoverage | null;
  strategicObjectives: {
    objective_key: string;
    label: string;
    status: string;
    score: number;
    evidence_level: string;
    primary_metrics: string[];
    reasons: string[];
  }[];
  milestoneEvaluations: {
    milestone_key: string;
    label: string;
    policy_status: string;
    reasons: string[];
  }[];
  decisionLog: DecisionPackDecisionLogEntry[];
  truthAssumptionMatrix: DecisionPackTruthAssumptionItem[];
  recommendedSetup: DecisionPackRecommendedSetup | null;
};

export type ParameterRangeSynthesisRow = {
  parameterKey: string;
  label: string;
  guardrailStatus: GuardrailStatus;
  recommendedValues: string;
  cautionValues: string | null;
  rejectedValues: string | null;
  testedValues: string;
  evidence: string;
  rationale: string;
};

export type RecommendedPilotEnvelope = {
  status: "recommended" | "review" | "blocked";
  recommendedRunId: string | null;
  recommendedRunLabel: string | null;
  summary: string;
  items: Array<{
    label: string;
    value: string;
    status: "recommended" | "caution" | "locked";
    rationale: string;
  }>;
  reasons: string[];
};

export type CompareDecisionLogEntry = {
  key: string;
  title: string;
  status: "fixed_truth" | "recommended" | "pending_founder" | "blocked";
  owner: string;
  rationale: string;
};

export type CompareTruthAssumptionRow = {
  key: string;
  label: string;
  value: string;
  classification: "historical_truth" | "scenario_lever" | "scenario_assumption" | "locked_boundary" | "derived_assessment";
  note: string;
};

export type CompareDecisionSupportArtifacts = {
  parameterRanges: ParameterRangeSynthesisRow[];
  recommendedEnvelope: RecommendedPilotEnvelope;
  decisionLog: CompareDecisionLogEntry[];
  truthAssumptionMatrix: CompareTruthAssumptionRow[];
};

type ParameterDescriptor = {
  key: keyof CompareDecisionSupportParameters;
  label: string;
  kind: ParameterKind;
  guardrailStatus: GuardrailStatus;
  rationale: string;
};

const parameterDescriptors: ParameterDescriptor[] = [
  {
    key: "k_pc",
    label: "k_pc",
    kind: "number",
    guardrailStatus: "allowed",
    rationale: "Allowed ALPHA conversion overlay on top of PC truth."
  },
  {
    key: "k_sp",
    label: "k_sp",
    kind: "number",
    guardrailStatus: "allowed",
    rationale: "Allowed ALPHA conversion overlay on top of SP/LTS truth."
  },
  {
    key: "cap_user_monthly",
    label: "User monthly cap",
    kind: "string",
    guardrailStatus: "allowed",
    rationale: "User-level monthly cap changes policy exposure without rewriting historical events."
  },
  {
    key: "cap_group_monthly",
    label: "Group monthly cap",
    kind: "string",
    guardrailStatus: "allowed",
    rationale: "Group-level monthly cap changes policy exposure without rewriting historical events."
  },
  {
    key: "sink_target",
    label: "Sink target",
    kind: "number",
    guardrailStatus: "conditional",
    rationale: "Sink posture is a scenario assumption about desired internal use."
  },
  {
    key: "cashout_mode",
    label: "Cash-out mode",
    kind: "string",
    guardrailStatus: "conditional",
    rationale: "Cash-out release policy is an ALPHA overlay assumption."
  },
  {
    key: "cashout_min_usd",
    label: "Cash-out minimum",
    kind: "currency",
    guardrailStatus: "conditional",
    rationale: "Cash-out minimum is an ALPHA overlay assumption."
  },
  {
    key: "cashout_fee_bps",
    label: "Cash-out fee",
    kind: "integer",
    guardrailStatus: "conditional",
    rationale: "Cash-out fee is an ALPHA overlay assumption."
  },
  {
    key: "cashout_windows_per_year",
    label: "Cash-out windows / year",
    kind: "integer",
    guardrailStatus: "conditional",
    rationale: "Cash-out windows are scenario assumptions, not historical truth."
  },
  {
    key: "cashout_window_days",
    label: "Cash-out window days",
    kind: "integer",
    guardrailStatus: "conditional",
    rationale: "Cash-out window duration is a scenario assumption, not historical truth."
  },
  {
    key: "projection_horizon_months",
    label: "Projection horizon",
    kind: "months",
    guardrailStatus: "conditional",
    rationale: "Projection horizon extends beyond observed history and must be framed as an assumption."
  },
  {
    key: "milestone_count",
    label: "Milestone count",
    kind: "integer",
    guardrailStatus: "conditional",
    rationale: "Milestone schedule is a staged policy assumption, not historical truth."
  }
];

function getStatusRank(status: string) {
  if (status === "candidate") return 0;
  if (status === "risky") return 1;
  if (status === "rejected") return 2;
  return 3;
}

function formatMonths(value: number | null) {
  return value === null ? "snapshot window" : `${decimalFormatter.format(value)} months`;
}

function formatParameterValue(
  descriptor: ParameterDescriptor,
  value: CompareDecisionSupportParameters[keyof CompareDecisionSupportParameters]
) {
  switch (descriptor.kind) {
    case "currency":
      return currencyFormatter.format(Number(value));
    case "percent":
      return `${decimalFormatter.format(Number(value))}%`;
    case "integer":
      return `${Math.round(Number(value))}`;
    case "months":
      return formatMonths((value as number | null) ?? null);
    case "number":
      return decimalFormatter.format(Number(value));
    default:
      return String(value);
  }
}

function formatValueSet(descriptor: ParameterDescriptor, values: Array<string | number | null>) {
  const normalizedValues = [...new Set(values.map((value) => value ?? "__null__"))];
  if (normalizedValues.length === 0) {
    return "n/a";
  }

  if (descriptor.kind === "number" || descriptor.kind === "currency" || descriptor.kind === "integer") {
    const numericValues = normalizedValues
      .map((value) => (value === "__null__" ? null : Number(value)))
      .filter((value): value is number => value !== null && Number.isFinite(value))
      .sort((left, right) => left - right);

    if (numericValues.length === 0) {
      return "n/a";
    }

    if (numericValues.length === 1 || numericValues[0] === numericValues[numericValues.length - 1]) {
      return formatParameterValue(descriptor, numericValues[0]);
    }

    return `${formatParameterValue(descriptor, numericValues[0])} → ${formatParameterValue(
      descriptor,
      numericValues[numericValues.length - 1]
    )}`;
  }

  return normalizedValues
    .map((value) => (value === "__null__" ? "snapshot window" : formatParameterValue(descriptor, value)))
    .join(", ");
}

function sortRunsForRecommendation(runs: CompareDecisionSupportRun[]) {
  return [...runs].sort((left, right) => {
    const leftRank = getStatusRank(left.verdict);
    const rightRank = getStatusRank(right.verdict);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftPressure = left.summaryMetrics.payout_inflow_ratio ?? 0;
    const rightPressure = right.summaryMetrics.payout_inflow_ratio ?? 0;
    if (leftPressure !== rightPressure) {
      return leftPressure - rightPressure;
    }

    const leftNet = left.summaryMetrics.company_net_treasury_delta_total ?? 0;
    const rightNet = right.summaryMetrics.company_net_treasury_delta_total ?? 0;
    if (leftNet !== rightNet) {
      return rightNet - leftNet;
    }

    const leftRunway = left.summaryMetrics.reserve_runway_months ?? 0;
    const rightRunway = right.summaryMetrics.reserve_runway_months ?? 0;
    if (leftRunway !== rightRunway) {
      return rightRunway - leftRunway;
    }

    const leftConcentration = left.summaryMetrics.reward_concentration_top10_pct ?? 0;
    const rightConcentration = right.summaryMetrics.reward_concentration_top10_pct ?? 0;
    return leftConcentration - rightConcentration;
  });
}

export function buildParameterRangeSynthesis(
  runs: CompareDecisionSupportRun[]
): ParameterRangeSynthesisRow[] {
  return parameterDescriptors.map((descriptor) => {
    const candidateRuns = runs.filter((run) => run.verdict === "candidate");
    const riskyRuns = runs.filter((run) => run.verdict === "risky");
    const rejectedRuns = runs.filter((run) => run.verdict === "rejected");

    const getValues = (targetRuns: CompareDecisionSupportRun[]) =>
      targetRuns.map((run) => run.parameters[descriptor.key]);

    const candidateValues = getValues(candidateRuns);
    const riskyValues = getValues(riskyRuns);
    const rejectedValues = getValues(rejectedRuns);
    const testedValues = runs.map((run) => run.parameters[descriptor.key]);

    return {
      parameterKey: String(descriptor.key),
      label: descriptor.label,
      guardrailStatus: descriptor.guardrailStatus,
      recommendedValues:
        candidateValues.length > 0
          ? formatValueSet(descriptor, candidateValues)
          : riskyValues.length > 0
            ? formatValueSet(descriptor, riskyValues)
            : formatValueSet(descriptor, testedValues),
      cautionValues:
        riskyValues.length > 0
          ? formatValueSet(descriptor, riskyValues)
          : null,
      rejectedValues:
        rejectedValues.length > 0
          ? formatValueSet(descriptor, rejectedValues)
          : null,
      testedValues: formatValueSet(descriptor, testedValues),
      evidence: `${candidateRuns.length} ready · ${riskyRuns.length} review · ${rejectedRuns.length} rejected`,
      rationale: descriptor.rationale
    };
  });
}

export function buildRecommendedPilotEnvelope(
  runs: CompareDecisionSupportRun[],
  parameterRanges: ParameterRangeSynthesisRow[]
): RecommendedPilotEnvelope {
  if (runs.length === 0) {
    return {
      status: "blocked",
      recommendedRunId: null,
      recommendedRunLabel: null,
      summary: "No selected runs are available to build a pilot envelope.",
      items: [],
      reasons: []
    };
  }

  const [bestRun] = sortRunsForRecommendation(runs);
  const status =
    bestRun.verdict === "candidate"
      ? "recommended"
      : bestRun.verdict === "risky"
        ? "review"
        : "blocked";

  const items = parameterRanges.map((row) => {
    const setupItem = bestRun.recommendedSetup?.items.find((item) => item.parameter_key === row.parameterKey);

    return {
      label: row.label,
      value:
        setupItem?.value ??
        formatParameterValue(
          parameterDescriptors.find((descriptor) => String(descriptor.key) === row.parameterKey) ?? parameterDescriptors[0],
          bestRun.parameters[row.parameterKey as keyof CompareDecisionSupportParameters]
        ),
      status:
        setupItem?.status ??
        (row.guardrailStatus === "allowed"
          ? "recommended"
          : row.guardrailStatus === "conditional"
            ? "caution"
            : "locked"),
      rationale: setupItem?.rationale ?? row.rationale
    };
  });

  const reasons = [
    `Best current candidate: ${bestRun.label}.`,
    `Net treasury delta ${currencyFormatter.format(bestRun.summaryMetrics.company_net_treasury_delta_total ?? 0)} with treasury pressure ${decimalFormatter.format(bestRun.summaryMetrics.payout_inflow_ratio ?? 0)}x.`,
    `Reserve runway ${decimalFormatter.format(bestRun.summaryMetrics.reserve_runway_months ?? 0)} months and top 10% reward share ${decimalFormatter.format(bestRun.summaryMetrics.reward_concentration_top10_pct ?? 0)}%.`
  ];

  if (bestRun.historicalTruthCoverage) {
    reasons.push(`Historical truth coverage is ${bestRun.historicalTruthCoverage.status}.`);
  }

  const firstDecisionBlocker = bestRun.decisionLog.find((entry) => entry.status === "blocked");
  if (firstDecisionBlocker) {
    reasons.push(firstDecisionBlocker.rationale);
  }

  return {
    status,
    recommendedRunId: bestRun.id,
    recommendedRunLabel: bestRun.label,
    summary:
      status === "recommended"
        ? "Selected runs already define a usable pilot envelope. The values below are taken from the strongest ready candidate while keeping conditional assumptions explicit."
        : status === "review"
          ? "Selected runs do not yet produce a clean ready envelope. The values below come from the least risky option and still need founder review."
          : "Selected runs do not yet define a defensible pilot envelope. Use the parameter ranges and decision log to understand what must be changed first.",
    items,
    reasons
  };
}

function buildCoverageSummary(runs: CompareDecisionSupportRun[]) {
  const counts = {
    strong: 0,
    partial: 0,
    weak: 0
  };

  for (const run of runs) {
    const status = run.historicalTruthCoverage?.status ?? "weak";
    counts[status] += 1;
  }

  return counts;
}

function buildPendingFounderLevers(parameterRanges: ParameterRangeSynthesisRow[]) {
  return parameterRanges
    .filter((row) => row.guardrailStatus === "conditional")
    .filter((row) => row.testedValues !== row.recommendedValues || row.cautionValues || row.rejectedValues)
    .map((row) => row.label);
}

export function buildCompareDecisionLog(
  runs: CompareDecisionSupportRun[],
  recommendedEnvelope: RecommendedPilotEnvelope,
  parameterRanges: ParameterRangeSynthesisRow[]
): CompareDecisionLogEntry[] {
  const coverage = buildCoverageSummary(runs);
  const proxyObjectives = [
    ...new Set(
      runs.flatMap((run) =>
        run.strategicObjectives
          .filter((objective) => objective.evidence_level !== "direct")
          .map((objective) => `${objective.label ?? objective.objective_key} (${objective.evidence_level})`)
      )
    )
  ];
  const nonCandidateMilestones = [
    ...new Set(
      runs.flatMap((run) =>
        run.milestoneEvaluations
          .filter((milestone) => milestone.policy_status !== "candidate")
          .map((milestone) => `${run.label}: ${milestone.label}`)
      )
    )
  ];
  const pendingFounderLevers = buildPendingFounderLevers(parameterRanges);

  const log: CompareDecisionLogEntry[] = [
    {
      key: "understanding_doc_truth",
      title: "Historical business truth stays fixed across compared runs",
      status: "fixed_truth",
      owner: "Understanding Doc",
      rationale: "Compare reads selected scenarios on top of snapshot truth; scenario overlays do not rewrite imported reward or cashflow history."
    },
    {
      key: "pilot_envelope_recommendation",
      title: "Pilot envelope recommendation from compare",
      status:
        recommendedEnvelope.status === "recommended"
          ? "recommended"
          : recommendedEnvelope.status === "review"
            ? "pending_founder"
            : "blocked",
      owner: "Founder",
      rationale:
        recommendedEnvelope.recommendedRunLabel
          ? `${recommendedEnvelope.recommendedRunLabel} is the strongest current envelope among the selected runs.`
          : recommendedEnvelope.summary
    }
  ];

  if (pendingFounderLevers.length > 0) {
    log.push({
      key: "founder_assumption_levers",
      title: "Conditional policy assumptions still need founder choice",
      status: "pending_founder",
      owner: "Founder",
      rationale: `The compared runs still vary on ${pendingFounderLevers.join(", ")}. These must be explicitly chosen as assumptions rather than treated as historical truth.`
    });
  }

  if (coverage.partial > 0 || coverage.weak > 0) {
    log.push({
      key: "truth_coverage_gap",
      title: "Historical truth coverage is not uniformly strong",
      status: "blocked",
      owner: "Data / Ops",
      rationale: `${coverage.strong} strong, ${coverage.partial} partial, and ${coverage.weak} weak snapshot-truth coverage states are present in the selected runs.`
    });
  }

  if (proxyObjectives.length > 0) {
    log.push({
      key: "strategic_evidence_gap",
      title: "Some strategic goals still rely on proxy or checklist evidence",
      status: "blocked",
      owner: "Data / Legal / Ops",
      rationale: proxyObjectives.join("; ")
    });
  }

  if (nonCandidateMilestones.length > 0) {
    log.push({
      key: "milestone_governance_gap",
      title: "Milestone promotion still needs governance review",
      status: "pending_founder",
      owner: "Founder",
      rationale: nonCandidateMilestones.join("; ")
    });
  }

  return log;
}

export function buildCompareTruthAssumptionMatrix(
  runs: CompareDecisionSupportRun[],
  parameterRanges: ParameterRangeSynthesisRow[]
): CompareTruthAssumptionRow[] {
  const snapshotNames = [...new Set(runs.map((run) => run.snapshotName))];
  const coverage = buildCoverageSummary(runs);

  const baseRows: CompareTruthAssumptionRow[] = [
    {
      key: "snapshot_truth",
      label: "Approved snapshot truth",
      value: snapshotNames.length === 1 ? snapshotNames[0] : `${snapshotNames.length} snapshots selected`,
      classification: "historical_truth",
      note: "Imported reward distributions and recognized revenue support remain the historical basis underneath compare."
    },
    {
      key: "truth_coverage",
      label: "Historical truth coverage",
      value: `${coverage.strong} strong · ${coverage.partial} partial · ${coverage.weak} weak`,
      classification: "derived_assessment",
      note: "Canonical/event-ledger coverage is summarized so founder claims stay calibrated to actual stored truth."
    }
  ];

  const parameterRows = parameterRanges.map<CompareTruthAssumptionRow>((row) => ({
    key: row.parameterKey,
    label: row.label,
    value: row.recommendedValues,
    classification:
      row.guardrailStatus === "allowed"
        ? "scenario_lever"
        : row.guardrailStatus === "conditional"
          ? "scenario_assumption"
          : "locked_boundary",
    note: row.rationale
  }));

  parameterRows.push({
    key: "reward_factor_lock",
    label: "Global / pool reward factors",
    value: "locked to neutral baseline",
    classification: "locked_boundary",
    note: "Generic reward multipliers stay locked so named understanding-doc reward semantics are not distorted."
  });
  parameterRows.push({
    key: "cohort_projection_lock",
    label: "Synthetic cohort projection",
    value: "disabled in founder-safe mode",
    classification: "locked_boundary",
    note: "Synthetic member growth, churn, and reactivation are not treated as faithful historical truth."
  });

  return [...baseRows, ...parameterRows];
}

export function buildCompareDecisionSupportArtifacts(
  runs: CompareDecisionSupportRun[]
): CompareDecisionSupportArtifacts {
  const parameterRanges = buildParameterRangeSynthesis(runs);
  const recommendedEnvelope = buildRecommendedPilotEnvelope(runs, parameterRanges);
  const decisionLog = buildCompareDecisionLog(runs, recommendedEnvelope, parameterRanges);
  const truthAssumptionMatrix = buildCompareTruthAssumptionMatrix(runs, parameterRanges);

  return {
    parameterRanges,
    recommendedEnvelope,
    decisionLog,
    truthAssumptionMatrix
  };
}
