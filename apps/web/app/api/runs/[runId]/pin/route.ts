import { NextResponse } from "next/server";

import { getRunById, setRunPinned, writeAuditEvent } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await authorizeApiRequest(["runs.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { runId } = await params;
  const run = await getRunById(runId);

  if (!run) {
    return NextResponse.json(
      {
        error: "run_not_found"
      },
      {
        status: 404
      }
    );
  }

  if (run.status !== "COMPLETED") {
    return NextResponse.json(
      {
        error: "run_not_pinnable"
      },
      {
        status: 409
      }
    );
  }

  const pinnedRun = await setRunPinned(runId, true);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "simulation_run",
    entityId: runId,
    action: "run.pinned",
    metadata: {
      scenarioId: pinnedRun.scenarioId,
      snapshotId: pinnedRun.snapshotId
    }
  });

  return NextResponse.json({
    run: pinnedRun
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await authorizeApiRequest(["runs.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { runId } = await params;
  const run = await getRunById(runId);

  if (!run) {
    return NextResponse.json(
      {
        error: "run_not_found"
      },
      {
        status: 404
      }
    );
  }

  const unpinnedRun = await setRunPinned(runId, false);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "simulation_run",
    entityId: runId,
    action: "run.unpinned",
    metadata: {
      scenarioId: unpinnedRun.scenarioId,
      snapshotId: unpinnedRun.snapshotId
    }
  });

  return NextResponse.json({
    run: unpinnedRun
  });
}
