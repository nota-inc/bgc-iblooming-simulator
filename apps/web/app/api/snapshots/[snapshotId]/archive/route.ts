import { NextResponse } from "next/server";

import {
  archiveSnapshot,
  getSnapshotById,
  unarchiveSnapshot,
  writeAuditEvent
} from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { snapshotId } = await params;
  const snapshot = await getSnapshotById(snapshotId);

  if (!snapshot) {
    return NextResponse.json(
      {
        error: "snapshot_not_found"
      },
      {
        status: 404
      }
    );
  }

  const latestImportRun = snapshot.importRuns[0];

  if (latestImportRun && ["QUEUED", "RUNNING"].includes(latestImportRun.status)) {
    return NextResponse.json(
      {
        error: "snapshot_import_in_progress"
      },
      {
        status: 409
      }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { reason?: string | null };
  const archivedSnapshot = await archiveSnapshot(snapshotId, {
    archivedByUserId: authResult.user.id,
    reason: payload.reason ?? null
  });

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshotId,
    action: "snapshot.archived",
    metadata: {
      name: archivedSnapshot.name,
      reason: payload.reason ?? null,
      scenarioRefs: archivedSnapshot._count.scenarios,
      runRefs: archivedSnapshot._count.runs
    }
  });

  return NextResponse.json({
    snapshot: archivedSnapshot
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { snapshotId } = await params;
  const snapshot = await getSnapshotById(snapshotId);

  if (!snapshot) {
    return NextResponse.json(
      {
        error: "snapshot_not_found"
      },
      {
        status: 404
      }
    );
  }

  const unarchivedSnapshot = await unarchiveSnapshot(snapshotId);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshotId,
    action: "snapshot.unarchived",
    metadata: {
      name: unarchivedSnapshot.name
    }
  });

  return NextResponse.json({
    snapshot: unarchivedSnapshot
  });
}
