import { NextResponse } from "next/server";

import { createSnapshotImportRun, getSnapshotById, writeAuditEvent } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import { enqueueJob } from "@/lib/queue";

export async function POST(
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

  const latestImportRun = snapshot.importRuns[0];

  if (latestImportRun && ["QUEUED", "RUNNING"].includes(latestImportRun.status)) {
    return NextResponse.json(
      {
        error: "snapshot_import_already_running"
      },
      {
        status: 409
      }
    );
  }

  const importRun = await createSnapshotImportRun({
    snapshotId: snapshot.id,
    fileUri: snapshot.fileUri,
    requestedByUserId: authResult.user.id
  });

  await enqueueJob("snapshot.import", {
    snapshotId: snapshot.id,
    importRunId: importRun.id
  });

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshot.id,
    action: "snapshot.import_queued",
    metadata: {
      importRunId: importRun.id,
      fileUri: snapshot.fileUri
    }
  });

  return NextResponse.json(
    {
      importRun
    },
    {
      status: 202
    }
  );
}
