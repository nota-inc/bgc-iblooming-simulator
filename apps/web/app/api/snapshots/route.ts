import { NextResponse } from "next/server";

import { createSnapshot, listSnapshots, writeAuditEvent } from "@bgc-alpha/db";
import { createDatasetSnapshotSchema } from "@bgc-alpha/schemas";

import { authorizeApiRequest } from "@/lib/auth-session";
import { jsonError } from "@/lib/http";

export async function GET() {
  const authResult = await authorizeApiRequest(["snapshots.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const snapshots = await listSnapshots();

  return NextResponse.json({
    snapshots
  });
}

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(["snapshots.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const payload = createDatasetSnapshotSchema.parse(await request.json());
    const snapshot = await createSnapshot({
      ...payload,
      dateFrom: new Date(payload.dateFrom),
      dateTo: new Date(payload.dateTo),
      createdByUserId: authResult.user.id
    });

    await writeAuditEvent({
      actorUserId: authResult.user.id,
      entityType: "dataset_snapshot",
      entityId: snapshot.id,
      action: "snapshot.created",
      metadata: {
        name: snapshot.name,
        validationStatus: snapshot.validationStatus
      }
    });

    return NextResponse.json(
      {
        snapshot
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return jsonError(error);
  }
}
