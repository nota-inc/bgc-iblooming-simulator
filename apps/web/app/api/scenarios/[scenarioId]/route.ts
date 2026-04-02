import { NextResponse } from "next/server";

import {
  getBaselineModelVersionById,
  getScenarioById,
  getSnapshotById,
  updateScenario,
  writeAuditEvent
} from "@bgc-alpha/db";
import { createScenarioSchema } from "@bgc-alpha/schemas";

import { authorizeApiRequest } from "@/lib/auth-session";
import { jsonError } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const authResult = await authorizeApiRequest(["scenarios.read"]);

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

  return NextResponse.json({
    scenario
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const authResult = await authorizeApiRequest(["scenarios.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const { scenarioId } = await params;
    const existingScenario = await getScenarioById(scenarioId);

    if (!existingScenario) {
      return NextResponse.json(
        {
          error: "scenario_not_found"
        },
        {
          status: 404
        }
      );
    }

    const payload = createScenarioSchema.parse(await request.json());
    const modelVersion = await getBaselineModelVersionById(payload.modelVersionId);

    if (!modelVersion) {
      return NextResponse.json(
        {
          error: "baseline_model_not_found"
        },
        {
          status: 400
        }
      );
    }

    if (payload.snapshotIdDefault) {
      const snapshot = await getSnapshotById(payload.snapshotIdDefault);

      if (!snapshot) {
        return NextResponse.json(
          {
            error: "snapshot_not_found"
          },
          {
            status: 400
          }
        );
      }
    }

    const scenario = await updateScenario(scenarioId, {
      ...payload,
      parameterJson: payload.parameters
    });

    await writeAuditEvent({
      actorUserId: authResult.user.id,
      entityType: "scenario",
      entityId: scenario.id,
      action: "scenario.updated",
      metadata: {
        name: scenario.name,
        templateType: scenario.templateType
      }
    });

    return NextResponse.json({
      scenario
    });
  } catch (error) {
    return jsonError(error);
  }
}
