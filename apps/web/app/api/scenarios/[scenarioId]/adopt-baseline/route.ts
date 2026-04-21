import { NextResponse } from "next/server";
import { z } from "zod";

import {
  adoptScenarioBaseline,
  clearScenarioAdoptedBaseline,
  getRunById,
  getScenarioById,
  writeAuditEvent
} from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import { readRecommendedSetup } from "@/lib/strategic-objectives";

const adoptBaselineSchema = z.object({
  runId: z.string().min(1),
  note: z.string().max(2000).nullable().optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const authResult = await authorizeApiRequest(["scenarios.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { scenarioId } = await params;
  const scenario = await getScenarioById(scenarioId);

  if (!scenario) {
    return NextResponse.json({ error: "scenario_not_found" }, { status: 404 });
  }

  const payload = adoptBaselineSchema.parse(await request.json());
  const run = await getRunById(payload.runId);

  if (!run || run.scenarioId !== scenarioId) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }

  if (run.status !== "COMPLETED") {
    return NextResponse.json({ error: "run_not_adoptable" }, { status: 409 });
  }

  const recommendedSetup = readRecommendedSetup(run.decisionPacks[0]?.recommendationJson);

  if (!recommendedSetup) {
    return NextResponse.json({ error: "recommended_setup_not_found" }, { status: 409 });
  }

  const updatedScenario = await adoptScenarioBaseline({
    scenarioId,
    runId: run.id,
    adoptedByUserId: authResult.user.id,
    adoptedBaselineJson: recommendedSetup,
    note: payload.note ?? null
  });

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "scenario",
    entityId: scenarioId,
    action: "scenario.baseline_adopted",
    metadata: {
      runId: run.id,
      note: payload.note ?? null
    }
  });

  return NextResponse.json({ scenario: updatedScenario });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const authResult = await authorizeApiRequest(["scenarios.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { scenarioId } = await params;
  const scenario = await getScenarioById(scenarioId);

  if (!scenario) {
    return NextResponse.json({ error: "scenario_not_found" }, { status: 404 });
  }

  const updatedScenario = await clearScenarioAdoptedBaseline(scenarioId);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "scenario",
    entityId: scenarioId,
    action: "scenario.baseline_cleared",
    metadata: {
      previousRunId: scenario.adoptedBaselineRunId ?? null
    }
  });

  return NextResponse.json({ scenario: updatedScenario });
}
