import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRunById,
  upsertDecisionLogResolution,
  writeAuditEvent
} from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import { readDecisionLog } from "@/lib/strategic-objectives";

const updateDecisionLogResolutionSchema = z.object({
  decisionKey: z.string().min(1),
  status: z.enum(["draft", "proposed", "accepted", "rejected", "deferred"]),
  owner: z.string().min(1).optional(),
  resolutionNote: z.string().max(2000).nullable().optional()
});

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
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }

  const payload = updateDecisionLogResolutionSchema.parse(await request.json());
  const decisionLog = readDecisionLog(run.decisionPacks[0]?.recommendationJson);

  if (!decisionLog.some((entry) => entry.key === payload.decisionKey)) {
    return NextResponse.json({ error: "decision_log_item_not_found" }, { status: 404 });
  }

  const generatedEntry = decisionLog.find((entry) => entry.key === payload.decisionKey);
  const resolution = await upsertDecisionLogResolution({
    runId,
    decisionKey: payload.decisionKey,
    status: payload.status.toUpperCase() as
      | "DRAFT"
      | "PROPOSED"
      | "ACCEPTED"
      | "REJECTED"
      | "DEFERRED",
    owner: payload.owner ?? generatedEntry?.owner ?? null,
    reviewedByUserId: authResult.user.id,
    resolutionNote: payload.resolutionNote ?? null
  });

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "simulation_run",
    entityId: runId,
    action: "decision_log.resolved",
    metadata: {
      decisionKey: payload.decisionKey,
      status: payload.status
    }
  });

  return NextResponse.json({ resolution });
}
