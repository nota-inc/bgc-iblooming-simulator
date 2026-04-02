import { NextResponse } from "next/server";

import { approveSnapshot, getSnapshotById, writeAuditEvent } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.approve"]);

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

  if (!["VALID", "APPROVED"].includes(snapshot.validationStatus)) {
    return NextResponse.json(
      {
        error: "snapshot_not_approvable"
      },
      {
        status: 400
      }
    );
  }

  const approvedSnapshot = await approveSnapshot(snapshotId, authResult.user.id);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshotId,
    action: "snapshot.approved",
    metadata: {
      validationStatus: approvedSnapshot.validationStatus
    }
  });

  return NextResponse.json({
    snapshot: approvedSnapshot
  });
}
