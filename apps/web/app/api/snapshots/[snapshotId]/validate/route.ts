import { NextResponse } from "next/server";

import {
  getSnapshotById,
  markSnapshotValidating,
  setSnapshotValidationResult,
  writeAuditEvent
} from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import { validateSnapshot } from "@/lib/snapshot-validation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.validate"]);

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

  await markSnapshotValidating(snapshotId);

  const issues = validateSnapshot({
    ...snapshot,
    sourceSystems: Array.isArray(snapshot.sourceSystems)
      ? snapshot.sourceSystems.map((value) => String(value))
      : []
  });
  const validatedSnapshot = await setSnapshotValidationResult(snapshotId, issues);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshotId,
    action: "snapshot.validated",
    metadata: {
      validationStatus: validatedSnapshot.validationStatus,
      issueCount: issues.length
    }
  });

  return NextResponse.json({
    snapshot: validatedSnapshot,
    issues
  });
}
