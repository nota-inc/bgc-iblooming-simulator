import { prisma } from "./client";

export async function listBaselineModelVersions() {
  return prisma.baselineModelVersion.findMany({
    orderBy: [
      {
        status: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });
}

export async function getBaselineModelVersionById(modelVersionId: string) {
  return prisma.baselineModelVersion.findUnique({
    where: {
      id: modelVersionId
    }
  });
}

export async function getActiveBaselineModelVersion() {
  return prisma.baselineModelVersion.findFirst({
    where: {
      status: "ACTIVE"
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}
