import { NextResponse } from "next/server";

import { archiveRun, getRunById, unarchiveRun, writeAuditEvent } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function POST(
  request: Request,
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

  if (["QUEUED", "RUNNING"].includes(run.status)) {
    return NextResponse.json(
      {
        error: "run_not_archivable"
      },
      {
        status: 409
      }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { reason?: string | null };
  const archivedRun = await archiveRun(runId, {
    archivedBy: authResult.user.id,
    reason: payload.reason ?? null
  });

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "simulation_run",
    entityId: runId,
    action: "run.archived",
    metadata: {
      scenarioId: archivedRun.scenarioId,
      snapshotId: archivedRun.snapshotId,
      reason: payload.reason ?? null
    }
  });

  return NextResponse.json({
    run: archivedRun
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

  const unarchivedRun = await unarchiveRun(runId);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "simulation_run",
    entityId: runId,
    action: "run.unarchived",
    metadata: {
      scenarioId: unarchivedRun.scenarioId,
      snapshotId: unarchivedRun.snapshotId
    }
  });

  return NextResponse.json({
    run: unarchivedRun
  });
}
