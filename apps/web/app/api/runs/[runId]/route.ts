import { NextResponse } from "next/server";

import { getRunById } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await authorizeApiRequest(["runs.read"]);

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

  return NextResponse.json({
    run
  });
}
