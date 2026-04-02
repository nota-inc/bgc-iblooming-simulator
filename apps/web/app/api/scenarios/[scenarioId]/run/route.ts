import { simulationRunLaunchSchema } from "@bgc-alpha/schemas";

import { authorizeApiRequest } from "@/lib/auth-session";
import { launchSimulationRun } from "@/lib/run-launch";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const authResult = await authorizeApiRequest(["runs.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { scenarioId } = await params;
  const body = simulationRunLaunchSchema.parse(await request.json().catch(() => ({})));

  return launchSimulationRun({
    scenarioId,
    snapshotId: body.snapshotId,
    userId: authResult.user.id
  });
}
