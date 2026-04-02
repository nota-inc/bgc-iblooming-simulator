import { NextResponse } from "next/server";

import { getSnapshotById } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.read"]);

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

  return NextResponse.json({
    snapshot
  });
}
