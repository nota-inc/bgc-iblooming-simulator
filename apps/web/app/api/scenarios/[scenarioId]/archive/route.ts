import { NextResponse } from "next/server";

import {
  archiveScenario,
  getScenarioById,
  unarchiveScenario,
  writeAuditEvent
} from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

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
    return NextResponse.json(
      {
        error: "scenario_not_found"
      },
      {
        status: 404
      }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { reason?: string | null };
  const archivedScenario = await archiveScenario(scenarioId, {
    archivedByUserId: authResult.user.id,
    reason: payload.reason ?? null
  });

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "scenario",
    entityId: scenarioId,
    action: "scenario.archived",
    metadata: {
      name: archivedScenario.name,
      reason: payload.reason ?? null
    }
  });

  return NextResponse.json({
    scenario: archivedScenario
  });
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
    return NextResponse.json(
      {
        error: "scenario_not_found"
      },
      {
        status: 404
      }
    );
  }

  const unarchivedScenario = await unarchiveScenario(scenarioId);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "scenario",
    entityId: scenarioId,
    action: "scenario.unarchived",
    metadata: {
      name: unarchivedScenario.name
    }
  });

  return NextResponse.json({
    scenario: unarchivedScenario
  });
}
