import type PgBoss from "pg-boss";

import {
  getRunById,
  listSnapshotMemberMonthFacts,
  markRunFailed,
  markRunStarted,
  persistCompletedRun,
  writeAuditEvent
} from "@bgc-alpha/db";
import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import {
  scenarioParametersSchema,
  type MilestoneEvaluation,
  type SimulationRunRequest,
  type StrategicObjectiveScorecard
} from "@bgc-alpha/schemas";
import { simulateScenario } from "@bgc-alpha/simulation-core";

type SimulationJobData = {
  runId?: string;
};

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

export async function registerSimulationJob(boss: PgBoss) {
  await boss.createQueue("simulation.run");
  await boss.work<SimulationJobData>("simulation.run", async (jobs) => {
    const job = jobs[0];

    if (!job) {
      return { ok: false, reason: "No job payload received." };
    }

    const jobData = job.data ?? {};
    const runId = String(jobData.runId ?? "");

    if (!runId) {
      return { ok: false, reason: "runId is required." };
    }

    const run = await getRunById(runId);

    if (!run) {
      return { ok: false, reason: `Run ${runId} was not found.` };
    }

    const input: SimulationRunRequest = {
      snapshotId: run.snapshotId,
      baselineModelVersionId: run.modelVersionId,
      scenario: {
        id: run.scenario.id,
        name: run.scenario.name,
        template: run.scenario.templateType as "Baseline" | "Conservative" | "Growth" | "Stress",
        parameters: scenarioParametersSchema.parse(run.scenario.parameterJson)
      }
    };

    try {
      await markRunStarted(runId);

      const facts = await listSnapshotMemberMonthFacts(run.snapshotId);
      const baselineModel = resolveBaselineModelRuleset(
        run.modelVersion.rulesetJson,
        run.modelVersion.versionName
      );

      const result = simulateScenario({
        request: input,
        facts: facts.map((fact) => ({
          ...(readMetadataRecord(fact.metadataJson)
            ? {
                recognizedRevenueUsd: readOptionalNumber(
                  readMetadataRecord(fact.metadataJson)?.recognizedRevenueUsd
                ),
                grossMarginUsd: readOptionalNumber(
                  readMetadataRecord(fact.metadataJson)?.grossMarginUsd
                ),
                memberJoinPeriod: readOptionalString(
                  readMetadataRecord(fact.metadataJson)?.memberJoinPeriod
                ),
                isAffiliate: readOptionalBoolean(readMetadataRecord(fact.metadataJson)?.isAffiliate),
                crossAppActive: readOptionalBoolean(
                  readMetadataRecord(fact.metadataJson)?.crossAppActive
                )
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

      await boss.send("decision-pack.generate", {
        runId,
        strategicObjectives: result.strategic_objectives as StrategicObjectiveScorecard[],
        milestoneEvaluations: result.milestone_evaluations as MilestoneEvaluation[]
      });

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

      console.log("[worker] run simulation", {
        runId,
        status: persistedRun.status
      });

      return persistedRun;
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
  });
}
