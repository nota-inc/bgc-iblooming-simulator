import { NextResponse } from "next/server";

import { writeAuditEvent } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import { jsonError } from "@/lib/http";
import { saveUploadedSnapshotCsv } from "@/lib/snapshot-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(["snapshots.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const formData = await request.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      throw new Error("CSV file is required.");
    }

    const savedFile = await saveUploadedSnapshotCsv(upload);

    await writeAuditEvent({
      actorUserId: authResult.user.id,
      entityType: "snapshot_upload",
      entityId: savedFile.savedFilename,
      action: "snapshot.uploaded",
      metadata: {
        originalName: upload.name,
        fileUri: savedFile.fileUri,
        size: savedFile.size
      }
    });

    return NextResponse.json({
      fileUri: savedFile.fileUri,
      fileName: upload.name,
      size: savedFile.size
    });
  } catch (error) {
    return jsonError(error);
  }
}
