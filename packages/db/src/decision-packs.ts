import type { Prisma } from "@prisma/client";

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
