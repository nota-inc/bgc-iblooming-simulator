import type { Prisma } from "@prisma/client";
import { DecisionResolutionStatus } from "@prisma/client";

import { prisma } from "./client";

type UpsertRunDecisionPackInput = {
  runId: string;
  title: string;
  recommendationJson: Prisma.InputJsonValue;
  createdBy?: string | null;
};

export async function getLatestDecisionPackForRun(runId: string) {
  return prisma.decisionPack.findFirst({
    where: {
      runId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function upsertRunDecisionPack(input: UpsertRunDecisionPackInput) {
  const existing = await getLatestDecisionPackForRun(input.runId);

  if (existing) {
    return prisma.decisionPack.update({
      where: {
        id: existing.id
      },
      data: {
        title: input.title,
        recommendationJson: input.recommendationJson,
        createdBy: input.createdBy ?? existing.createdBy,
        exportStatus: "READY"
      }
    });
  }

  return prisma.decisionPack.create({
    data: {
      runId: input.runId,
      title: input.title,
      recommendationJson: input.recommendationJson,
      createdBy: input.createdBy ?? null,
      exportStatus: "READY"
    }
  });
}

export async function listDecisionLogResolutionsForRun(runId: string) {
  return prisma.runDecisionLogResolution.findMany({
    where: {
      runId
    },
    orderBy: [
      {
        updatedAt: "desc"
      }
    ]
  });
}

export async function upsertDecisionLogResolution(input: {
  runId: string;
  decisionKey: string;
  status: DecisionResolutionStatus;
  owner?: string | null;
  reviewedByUserId?: string | null;
  resolutionNote?: string | null;
}) {
  return prisma.runDecisionLogResolution.upsert({
    where: {
      runId_decisionKey: {
        runId: input.runId,
        decisionKey: input.decisionKey
      }
    },
    update: {
      status: input.status,
      owner: input.owner ?? undefined,
      reviewedByUserId: input.reviewedByUserId ?? null,
      reviewedAt: new Date(),
      resolutionNote: input.resolutionNote ?? null
    },
    create: {
      runId: input.runId,
      decisionKey: input.decisionKey,
      status: input.status,
      owner: input.owner ?? null,
      reviewedByUserId: input.reviewedByUserId ?? null,
      reviewedAt: new Date(),
      resolutionNote: input.resolutionNote ?? null
    }
  });
}
