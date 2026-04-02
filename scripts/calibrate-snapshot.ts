import {
  getActiveBaselineModelVersion,
  getBaselineModelVersionById,
  getScenarioById,
  getSnapshotById,
  listSnapshotMemberMonthFacts,
  prisma
} from "@bgc-alpha/db";
import { getBaselineScenarioDefaults, resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { scenarioParametersSchema, type ScenarioParameters } from "@bgc-alpha/schemas";
import { simulateScenario } from "@bgc-alpha/simulation-core";

type ParsedArgs = {
  snapshotId: string;
  scenarioId?: string;
  modelVersionId?: string;
  json: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const snapshotId = args.shift();

  if (!snapshotId) {
    throw new Error("Pass the snapshot ID as the first argument.");
  }

  let scenarioId: string | undefined;
  let modelVersionId: string | undefined;
  let json = false;

  while (args.length > 0) {
    const token = args.shift();

    if (token === "--scenario") {
      scenarioId = args.shift();
      continue;
    }

    if (token === "--model") {
      modelVersionId = args.shift();
      continue;
    }

    if (token === "--json") {
      json = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    snapshotId,
    scenarioId,
    modelVersionId,
    json
  };
}

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function percentDelta(simulated: number, observed: number) {
  if (observed === 0) {
    return simulated === 0 ? 0 : null;
  }

  return roundMetric(((simulated - observed) / observed) * 100);
}

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

function toFactInputs(facts: Awaited<ReturnType<typeof listSnapshotMemberMonthFacts>>) {
  return facts.map((fact) => ({
    ...(readMetadataRecord(fact.metadataJson)
      ? {
          recognizedRevenueUsd: readOptionalNumber(readMetadataRecord(fact.metadataJson)?.recognizedRevenueUsd),
          grossMarginUsd: readOptionalNumber(readMetadataRecord(fact.metadataJson)?.grossMarginUsd),
          memberJoinPeriod: readOptionalString(readMetadataRecord(fact.metadataJson)?.memberJoinPeriod),
          isAffiliate: readOptionalBoolean(readMetadataRecord(fact.metadataJson)?.isAffiliate),
          crossAppActive: readOptionalBoolean(readMetadataRecord(fact.metadataJson)?.crossAppActive)
        }
      : {}),
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
    activeMember: fact.activeMember
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = await getSnapshotById(args.snapshotId);

  if (!snapshot) {
    throw new Error(`Snapshot ${args.snapshotId} was not found.`);
  }

  const facts = await listSnapshotMemberMonthFacts(snapshot.id);

  if (facts.length === 0) {
    throw new Error(`Snapshot ${snapshot.id} does not contain imported member-month facts.`);
  }

  const scenario = args.scenarioId ? await getScenarioById(args.scenarioId) : null;

  if (args.scenarioId && !scenario) {
    throw new Error(`Scenario ${args.scenarioId} was not found.`);
  }

  const modelVersionId =
    args.modelVersionId ?? scenario?.modelVersionId ?? (await getActiveBaselineModelVersion())?.id;

  if (!modelVersionId) {
    throw new Error("No baseline model version is available for calibration.");
  }

  const modelVersion = await getBaselineModelVersionById(modelVersionId);

  if (!modelVersion) {
    throw new Error(`Baseline model ${modelVersionId} was not found.`);
  }

  const baselineModel = resolveBaselineModelRuleset(
    modelVersion.rulesetJson,
    modelVersion.versionName
  );
  const parameters: ScenarioParameters = scenario
    ? scenarioParametersSchema.parse(scenario.parameterJson)
    : scenarioParametersSchema.parse(getBaselineScenarioDefaults(baselineModel));

  const simulated = simulateScenario({
    request: {
      snapshotId: snapshot.id,
      baselineModelVersionId: modelVersion.id,
      scenario: {
        id: scenario?.id,
        name: scenario?.name ?? `${snapshot.name} Calibration Baseline`,
        template: (scenario?.templateType as "Baseline" | "Conservative" | "Growth" | "Stress") ?? "Baseline",
        parameters
      }
    },
    facts: toFactInputs(facts),
    baselineModel
  });

  const memberSet = new Set(facts.map((fact) => fact.memberKey));
  const activeMemberSet = new Set(
    facts.filter((fact) => fact.activeMember).map((fact) => fact.memberKey)
  );
  const groupSet = new Set(facts.map((fact) => fact.groupKey).filter(Boolean));
  const periodSet = new Set(facts.map((fact) => fact.periodKey));

  const observedPcVolumeTotal = roundMetric(facts.reduce((sum, fact) => sum + fact.pcVolume, 0));
  const observedSpRewardBasisTotal = roundMetric(
    facts.reduce((sum, fact) => sum + fact.spRewardBasis, 0)
  );
  const observedGlobalRewardTotal = roundMetric(
    facts.reduce((sum, fact) => sum + fact.globalRewardUsd, 0)
  );
  const observedPoolRewardTotal = roundMetric(
    facts.reduce((sum, fact) => sum + fact.poolRewardUsd, 0)
  );
  const observedCashoutTotal = roundMetric(
    facts.reduce((sum, fact) => sum + fact.cashoutUsd, 0)
  );
  const observedSinkSpendTotal = roundMetric(
    facts.reduce((sum, fact) => sum + fact.sinkSpendUsd, 0)
  );
  const observedIssuanceBasisTotal = roundMetric(
    facts.reduce((sum, fact) => {
      const pcBase = fact.pcVolume / baselineModel.conversionRules.pc_units_per_alpha;
      const spBase = fact.spRewardBasis / baselineModel.conversionRules.sp_units_per_alpha;
      const activityMultiplier = fact.activeMember
        ? baselineModel.conversionRules.active_member_multiplier
        : baselineModel.conversionRules.inactive_member_multiplier;

      return (
        sum +
        (pcBase * baselineModel.conversionRules.pc_alpha_weight * parameters.k_pc +
          spBase * baselineModel.conversionRules.sp_alpha_weight * parameters.k_sp) *
          activityMultiplier
      );
    }, 0)
  );
  const observedLiabilityTotal = roundMetric(
    facts.reduce((sum, fact) => {
      return (
        sum +
        fact.globalRewardUsd * parameters.reward_global_factor * baselineModel.rewardRules.global_reward_weight +
        fact.poolRewardUsd * parameters.reward_pool_factor * baselineModel.rewardRules.pool_reward_weight +
        (fact.cashoutUsd >= parameters.cashout_min_usd ? fact.cashoutUsd : 0)
      );
    }, 0)
  );
  const observedInflowSupportTotal = roundMetric(
    facts.reduce((sum, fact) => {
      return (
        sum +
        fact.pcVolume / baselineModel.conversionRules.pc_units_per_alpha +
        fact.sinkSpendUsd * baselineModel.treasuryRules.inflow_capture_rate
      );
    }, 0)
  );
  const observedPayoutInflowRatio = roundMetric(
    safeDivide(observedLiabilityTotal, observedInflowSupportTotal)
  );
  const observedSinkUtilizationRate = roundMetric(
    safeDivide(observedSinkSpendTotal, observedIssuanceBasisTotal) * 100
  );

  const report = {
    snapshot: {
      id: snapshot.id,
      name: snapshot.name,
      validationStatus: snapshot.validationStatus,
      factCount: facts.length,
      periods: periodSet.size,
      uniqueMembers: memberSet.size,
      activeMembers: activeMemberSet.size,
      groups: groupSet.size
    },
    calibrationContext: {
      mode: scenario ? "scenario" : "baseline-defaults",
      scenarioId: scenario?.id ?? null,
      scenarioName: scenario?.name ?? null,
      modelVersionId: modelVersion.id,
      modelVersionName: modelVersion.versionName
    },
    observed: {
      pc_volume_total: observedPcVolumeTotal,
      sp_reward_basis_total: observedSpRewardBasisTotal,
      reward_liability_total: roundMetric(observedGlobalRewardTotal + observedPoolRewardTotal),
      sink_spend_total: observedSinkSpendTotal,
      cashout_total: observedCashoutTotal,
      issuance_basis_total: observedIssuanceBasisTotal,
      payout_inflow_ratio: observedPayoutInflowRatio,
      sink_utilization_rate: observedSinkUtilizationRate
    },
    simulated: {
      ...simulated.summary_metrics,
      policy_status: simulated.recommendation_signals.policy_status,
      reasons: simulated.recommendation_signals.reasons
    },
    deltas: {
      issued_vs_basis_pct: percentDelta(
        simulated.summary_metrics.alpha_issued_total,
        observedIssuanceBasisTotal
      ),
      spent_vs_observed_sink_pct: percentDelta(
        simulated.summary_metrics.alpha_spent_total,
        observedSinkSpendTotal
      ),
      cashout_vs_observed_cashout_pct: percentDelta(
        simulated.summary_metrics.alpha_cashout_equivalent_total,
        observedCashoutTotal
      ),
      payout_inflow_vs_observed_pct: percentDelta(
        simulated.summary_metrics.payout_inflow_ratio,
        observedPayoutInflowRatio
      ),
      sink_utilization_vs_observed_pct: percentDelta(
        simulated.summary_metrics.sink_utilization_rate,
        observedSinkUtilizationRate
      )
    }
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`# Calibration Report: ${snapshot.name}`);
  console.log("");
  console.log(`- Snapshot: ${snapshot.id}`);
  console.log(`- Model: ${modelVersion.versionName} (${modelVersion.id})`);
  console.log(
    `- Mode: ${scenario ? `Scenario ${scenario.name} (${scenario.id})` : "Baseline defaults"}`
  );
  console.log(`- Facts: ${facts.length} rows across ${periodSet.size} periods`);
  console.log("");
  console.log("## Observed Snapshot Totals");
  console.log(`- PC volume total: ${observedPcVolumeTotal}`);
  console.log(`- SP reward basis total: ${observedSpRewardBasisTotal}`);
  console.log(`- Reward liability total: ${roundMetric(observedGlobalRewardTotal + observedPoolRewardTotal)}`);
  console.log(`- Sink spend total: ${observedSinkSpendTotal}`);
  console.log(`- Cash-out total: ${observedCashoutTotal}`);
  console.log(`- Issuance basis total: ${observedIssuanceBasisTotal}`);
  console.log(`- Observed payout/inflow ratio: ${observedPayoutInflowRatio}`);
  console.log(`- Observed sink utilization rate: ${observedSinkUtilizationRate}%`);
  console.log("");
  console.log("## Simulated Summary");
  console.log(`- ALPHA issued total: ${simulated.summary_metrics.alpha_issued_total}`);
  console.log(`- ALPHA spent total: ${simulated.summary_metrics.alpha_spent_total}`);
  console.log(
    `- ALPHA cash-out equivalent total: ${simulated.summary_metrics.alpha_cashout_equivalent_total}`
  );
  console.log(`- Sink utilization rate: ${simulated.summary_metrics.sink_utilization_rate}%`);
  console.log(`- Payout/inflow ratio: ${simulated.summary_metrics.payout_inflow_ratio}`);
  console.log(`- Reserve runway months: ${simulated.summary_metrics.reserve_runway_months}`);
  console.log(
    `- Reward concentration top 10%: ${simulated.summary_metrics.reward_concentration_top10_pct}%`
  );
  console.log(`- Policy status: ${simulated.recommendation_signals.policy_status}`);
  console.log("");
  console.log("## Calibration Deltas");
  console.log(`- Issued vs issuance basis: ${report.deltas.issued_vs_basis_pct ?? "n/a"}%`);
  console.log(`- Spent vs observed sink: ${report.deltas.spent_vs_observed_sink_pct ?? "n/a"}%`);
  console.log(
    `- Cash-out vs observed cash-out: ${report.deltas.cashout_vs_observed_cashout_pct ?? "n/a"}%`
  );
  console.log(
    `- Payout/inflow vs observed ratio: ${report.deltas.payout_inflow_vs_observed_pct ?? "n/a"}%`
  );
  console.log(
    `- Sink utilization vs observed: ${report.deltas.sink_utilization_vs_observed_pct ?? "n/a"}%`
  );
  console.log("");
  console.log("## Recommendation Reasons");
  for (const reason of simulated.recommendation_signals.reasons) {
    console.log(`- ${reason}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
