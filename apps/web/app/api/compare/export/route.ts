import { NextResponse } from "next/server";

import { listCompletedRunsByIds } from "@bgc-alpha/db";
import {
  renderCompareReportPdf,
  type CompareReportExport,
  type CompareReportTone
} from "@bgc-alpha/exports";

import { authorizeApiRequest } from "@/lib/auth-session";
import {
  compareMetricKeys,
  compareMetricOptimization,
  compareRadarDimensions,
  compareSeriesColors
} from "@/lib/compare-config";
import {
  formatCommonMetricValue,
  formatMonthCountLabel,
  getCommonMetricLabel,
  getPolicyStatusLabel,
  getRunReference,
  getRunStatusLabel
} from "@/lib/common-language";
import {
  readMilestoneEvaluations,
  readStrategicObjectives,
  strategicObjectiveLabels,
  strategicObjectiveOrder
} from "@/lib/strategic-objectives";

type CompareRunRecord = Awaited<ReturnType<typeof listCompletedRunsByIds>>[number];

function buildFilename(source: string) {
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getTone(status: string): CompareReportTone {
  const normalized = status.toLowerCase();

  if (["candidate", "approved", "completed", "ready"].some((token) => normalized.includes(token))) {
    return "accent";
  }

  if (["risky", "caution", "warning", "review"].some((token) => normalized.includes(token))) {
    return "warning";
  }

  if (["rejected", "failed", "error"].some((token) => normalized.includes(token))) {
    return "danger";
  }

  if (["queued", "running", "pending"].some((token) => normalized.includes(token))) {
    return "info";
  }

  return "neutral";
}

function buildRunDisplayLabels(runs: CompareRunRecord[]) {
  const counts = new Map<string, number>();

  runs.forEach((run) => {
    counts.set(run.scenario.name, (counts.get(run.scenario.name) ?? 0) + 1);
  });

  return new Map(
    runs.map((run) => [
      run.id,
      (counts.get(run.scenario.name) ?? 0) > 1
        ? `${run.scenario.name} · ${getRunReference(run.id)}`
        : run.scenario.name
    ])
  );
}

function buildRadar(runs: CompareRunRecord[], labels: Map<string, string>) {
  if (runs.length === 0) {
    return {
      dimensions: [],
      series: []
    };
  }

  const maxIssued = Math.max(
    1,
    ...runs.map((run) => run.summaryMetrics.find((metric) => metric.metricKey === "alpha_issued_total")?.metricValue ?? 0)
  );

  return {
    dimensions: compareRadarDimensions.map((dimension) => ({
      name: dimension.name,
      max: dimension.max === 0 ? maxIssued * 1.2 : dimension.max
    })),
    series: runs.map((run, index) => {
      const metrics = Object.fromEntries(
        run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const)
      ) as Record<string, number>;

      return {
        name: labels.get(run.id) ?? run.scenario.name,
        color: compareSeriesColors[index % compareSeriesColors.length],
        values: compareRadarDimensions.map((dimension) => {
          const raw = metrics[dimension.key] ?? 0;

          if (dimension.invert) {
            const max = dimension.max === 0 ? maxIssued * 1.2 : dimension.max;
            return Math.max(0, max - raw);
          }

          return raw;
        })
      };
    })
  };
}

function buildCompareReport(runs: CompareRunRecord[]) {
  const runDisplayLabels = buildRunDisplayLabels(runs);
  const extrasByRunId = new Map(
    runs.map((run) => {
      const recommendationJson = run.decisionPacks[0]?.recommendationJson;
      const strategicObjectives = readStrategicObjectives(recommendationJson);
      const milestoneEvaluations = readMilestoneEvaluations(recommendationJson);
      const verdictStatus = recommendationJson
        ? ((recommendationJson as Record<string, unknown>).policy_status as string | undefined) ?? "pending"
        : "pending";

      return [
        run.id,
        {
          verdictStatus,
          verdictLabel: getPolicyStatusLabel(verdictStatus),
          strategicObjectives,
          milestoneEvaluations
        }
      ] as const;
    })
  );

  const keyResultRows: CompareReportExport["keyResults"]["rows"] = compareMetricKeys.map((metricKey) => {
    const values = runs.map((run) => run.summaryMetrics.find((metric) => metric.metricKey === metricKey)?.metricValue ?? 0);
    const optimization = compareMetricOptimization[metricKey] ?? "higher";
    const bestValue = optimization === "higher" ? Math.max(...values) : Math.min(...values);
    const worstValue = optimization === "higher" ? Math.min(...values) : Math.max(...values);

    return {
      label: getCommonMetricLabel(metricKey),
      cells: runs.map((_, index) => {
        const value = values[index];
        const isBest = values.length > 1 && value === bestValue;
        const isWorst = values.length > 1 && value === worstValue;

        return {
          primary: formatCommonMetricValue(metricKey, value),
          emphasis: isBest ? "best" : isWorst ? "worst" : "default"
        } as const;
      })
    };
  });

  keyResultRows.push({
    label: "Verdict",
    cells: runs.map((run) => {
      const extra = extrasByRunId.get(run.id);
      return {
        primary: extra?.verdictLabel ?? "Pending",
        tone: getTone(extra?.verdictStatus ?? "pending")
      };
    })
  });

  const milestoneKeys = [
    ...new Set(
      runs.flatMap((run) =>
        (extrasByRunId.get(run.id)?.milestoneEvaluations ?? []).map((milestone) => `${milestone.milestone_key}::${milestone.label}`)
      )
    )
  ];

  return {
    title: `Compare Report · ${runs.length} Selected Scenario${runs.length === 1 ? "" : "s"}`,
    subtitle: "Scenario comparison exported with the same structure as the Compare tab: radar view, key results, goals, milestones, and run context.",
    generatedAt: new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date()),
    runs: runs.map((run, index) => {
      const extra = extrasByRunId.get(run.id);
      return {
        id: run.id,
        ref: getRunReference(run.id),
        label: runDisplayLabels.get(run.id) ?? run.scenario.name,
        color: compareSeriesColors[index % compareSeriesColors.length],
        scenarioName: run.scenario.name,
        snapshotName: run.snapshot.name,
        status: getRunStatusLabel(run.status),
        statusTone: getTone(run.status),
        verdict: extra?.verdictLabel ?? "Pending",
        verdictTone: getTone(extra?.verdictStatus ?? "pending"),
        completedAt: run.completedAt?.toLocaleString("en-US") ?? "Pending"
      };
    }),
    radar: buildRadar(runs, runDisplayLabels),
    keyResults: {
      title: "Key Results",
      subtitle: "Same metric order and winner/laggard highlighting used in the Compare tab.",
      rowLabel: "Metric",
      rows: keyResultRows
    },
    goalComparison: {
      title: "Goal Comparison",
      subtitle: "Strategic objective status and score for each selected scenario.",
      rowLabel: "Objective",
      rows: strategicObjectiveOrder.map((objectiveKey) => ({
        label: strategicObjectiveLabels[objectiveKey],
        cells: runs.map((run) => {
          const scorecard = extrasByRunId
            .get(run.id)
            ?.strategicObjectives.find((item) => item.objective_key === objectiveKey);

          if (!scorecard) {
            return {
              primary: "Pending",
              muted: true
            };
          }

          return {
            primary: getPolicyStatusLabel(scorecard.status),
            secondary: scorecard.score.toFixed(2),
            tone: getTone(scorecard.status)
          };
        })
      }))
    },
    milestoneComparison: {
      title: "Milestone Comparison",
      subtitle: "Milestone verdict, payout pressure, and reserve runway for the selected scenarios.",
      rowLabel: "Milestone",
      rows: milestoneKeys.length === 0
        ? [
            {
              label: "Milestone results",
              cells: runs.map(() => ({
                primary: "No milestone results yet.",
                muted: true
              }))
            }
          ]
        : milestoneKeys.map((milestoneKey) => {
            const [key, label] = milestoneKey.split("::");
            return {
              label,
              cells: runs.map((run) => {
                const milestone = extrasByRunId
                  .get(run.id)
                  ?.milestoneEvaluations.find((item) => item.milestone_key === key);

                if (!milestone) {
                  return {
                    primary: "N/A",
                    muted: true
                  };
                }

                return {
                  primary: getPolicyStatusLabel(milestone.policy_status),
                  secondary: `${milestone.summary_metrics.payout_inflow_ratio.toFixed(2)}x | ${formatMonthCountLabel(milestone.summary_metrics.reserve_runway_months)}`,
                  tone: getTone(milestone.policy_status)
                };
              })
            };
          })
    }
  } satisfies CompareReportExport;
}

export async function GET(request: Request) {
  const authResult = await authorizeApiRequest(["compare.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const searchParams = new URL(request.url).searchParams;
  const runIds = [...new Set(searchParams.getAll("runId").filter(Boolean))];

  if (runIds.length === 0) {
    return NextResponse.json(
      {
        error: "missing_run_ids"
      },
      {
        status: 400
      }
    );
  }

  const fetchedRuns = await listCompletedRunsByIds(runIds);
  const runsById = new Map(fetchedRuns.map((run) => [run.id, run] as const));
  const orderedRuns = runIds
    .map((runId) => runsById.get(runId))
    .filter((run): run is CompareRunRecord => Boolean(run));

  if (orderedRuns.length === 0) {
    return NextResponse.json(
      {
        error: "runs_not_found"
      },
      {
        status: 404
      }
    );
  }

  const report = buildCompareReport(orderedRuns);
  const filenameSeed = orderedRuns.length === 1
    ? `${orderedRuns[0].scenario.name}-${getRunReference(orderedRuns[0].id)}-compare-report`
    : `compare-${getRunReference(orderedRuns[0].id)}-plus-${orderedRuns.length - 1}`;

  return new NextResponse(renderCompareReportPdf(report), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildFilename(filenameSeed)}.pdf"`
    }
  });
}
