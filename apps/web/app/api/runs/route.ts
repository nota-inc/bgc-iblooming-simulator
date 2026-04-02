import { NextResponse } from "next/server";

import { listRuns } from "@bgc-alpha/db";
import { simulationRunCreateSchema } from "@bgc-alpha/schemas";

import { authorizeApiRequest } from "@/lib/auth-session";
import { launchSimulationRun } from "@/lib/run-launch";

export async function GET() {
  const authResult = await authorizeApiRequest(["runs.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const runs = await listRuns();

  return NextResponse.json({
    runs
  });
}

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(["runs.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const body = simulationRunCreateSchema.parse(await request.json().catch(() => ({})));

  return launchSimulationRun({
    scenarioId: body.scenarioId,
    snapshotId: body.snapshotId,
    userId: authResult.user.id
  });
}
