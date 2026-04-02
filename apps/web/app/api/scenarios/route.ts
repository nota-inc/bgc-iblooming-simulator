import { NextResponse } from "next/server";

import {
  createScenario,
  getBaselineModelVersionById,
  getSnapshotById,
  listScenarios,
  writeAuditEvent
} from "@bgc-alpha/db";
import { createScenarioSchema } from "@bgc-alpha/schemas";

import { authorizeApiRequest } from "@/lib/auth-session";
import { jsonError } from "@/lib/http";

export async function GET() {
  const authResult = await authorizeApiRequest(["scenarios.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const scenarios = await listScenarios();

  return NextResponse.json({
    scenarios
  });
}

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(["scenarios.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
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

    const scenario = await createScenario({
      ...payload,
      createdBy: authResult.user.id,
      parameterJson: payload.parameters
    });

    await writeAuditEvent({
      actorUserId: authResult.user.id,
      entityType: "scenario",
      entityId: scenario.id,
      action: "scenario.created",
      metadata: {
        name: scenario.name,
        templateType: scenario.templateType
      }
    });

    return NextResponse.json(
      {
        scenario
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return jsonError(error);
  }
}
