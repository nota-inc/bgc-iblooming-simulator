import type { Prisma } from "@prisma/client";

import { prisma } from "./client";

type ScenarioUpsertInput = {
  name: string;
  templateType: string;
  description?: string | null;
  snapshotIdDefault?: string | null;
  modelVersionId: string;
  parameterJson: Prisma.InputJsonValue;
  createdBy?: string | null;
};

export async function listScenarios() {
  return prisma.scenario.findMany({
    include: {
      modelVersion: true,
      snapshotDefault: {
        include: {
          _count: {
            select: {
              memberMonthFacts: true
            }
          }
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function getScenarioById(scenarioId: string) {
  return prisma.scenario.findUnique({
    where: {
      id: scenarioId
    },
    include: {
      modelVersion: true,
      snapshotDefault: {
        include: {
          _count: {
            select: {
              memberMonthFacts: true
            }
          }
        }
      }
    }
  });
}

export async function createScenario(input: ScenarioUpsertInput) {
  return prisma.scenario.create({
    data: {
      name: input.name,
      templateType: input.templateType,
      description: input.description ?? null,
      snapshotIdDefault: input.snapshotIdDefault ?? null,
      modelVersionId: input.modelVersionId,
      parameterJson: input.parameterJson,
      createdBy: input.createdBy ?? null
    },
    include: {
      modelVersion: true,
      snapshotDefault: {
        include: {
          _count: {
            select: {
              memberMonthFacts: true
            }
          }
        }
      }
    }
  });
}

export async function updateScenario(
  scenarioId: string,
  input: Omit<ScenarioUpsertInput, "createdBy">
) {
  return prisma.scenario.update({
    where: {
      id: scenarioId
    },
    data: {
      name: input.name,
      templateType: input.templateType,
      description: input.description ?? null,
      snapshotIdDefault: input.snapshotIdDefault ?? null,
      modelVersionId: input.modelVersionId,
      parameterJson: input.parameterJson
    },
    include: {
      modelVersion: true,
      snapshotDefault: {
        include: {
          _count: {
            select: {
              memberMonthFacts: true
            }
          }
        }
      }
    }
  });
}
