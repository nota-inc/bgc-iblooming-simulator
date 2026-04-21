import { Prisma } from "@prisma/client";

import { prisma } from "./client";
import { snapshotDefaultRelationSelect } from "./snapshots";

type ScenarioUpsertInput = {
  name: string;
  templateType: string;
  description?: string | null;
  snapshotIdDefault?: string | null;
  modelVersionId: string;
  parameterJson: Prisma.InputJsonValue;
  createdBy?: string | null;
};

type ScenarioListOptions = {
  includeArchived?: boolean;
};

const scenarioSelect = {
  id: true,
  name: true,
  templateType: true,
  description: true,
  snapshotIdDefault: true,
  modelVersionId: true,
  parameterJson: true,
  createdBy: true,
  archivedAt: true,
  archivedByUserId: true,
  archiveReason: true,
  adoptedBaselineRunId: true,
  adoptedBaselineJson: true,
  adoptedBaselineAt: true,
  adoptedBaselineByUserId: true,
  adoptedBaselineNote: true,
  createdAt: true,
  updatedAt: true,
  modelVersion: true,
  snapshotDefault: {
    select: snapshotDefaultRelationSelect
  },
  runs: {
    take: 1,
    orderBy: {
      createdAt: "desc" as const
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      completedAt: true
    }
  },
  adoptedBaselineRun: {
    select: {
      id: true,
      status: true,
      completedAt: true
    }
  },
  _count: {
    select: {
      runs: true
    }
  }
} as const;

export async function listScenarios(options: ScenarioListOptions = {}) {
  return prisma.scenario.findMany({
    ...(options.includeArchived
      ? {}
      : {
          where: {
            archivedAt: null
          }
        }),
    select: scenarioSelect,
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
    select: scenarioSelect
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
    select: scenarioSelect
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
    select: scenarioSelect
  });
}

export async function archiveScenario(
  scenarioId: string,
  input: {
    archivedByUserId?: string | null;
    reason?: string | null;
  }
) {
  return prisma.scenario.update({
    where: {
      id: scenarioId
    },
    data: {
      archivedAt: new Date(),
      archivedByUserId: input.archivedByUserId ?? null,
      archiveReason: input.reason ?? null
    },
    select: scenarioSelect
  });
}

export async function unarchiveScenario(scenarioId: string) {
  return prisma.scenario.update({
    where: {
      id: scenarioId
    },
    data: {
      archivedAt: null,
      archivedByUserId: null,
      archiveReason: null
    },
    select: scenarioSelect
  });
}

export async function adoptScenarioBaseline(input: {
  scenarioId: string;
  runId: string;
  adoptedByUserId?: string | null;
  adoptedBaselineJson: Prisma.InputJsonValue;
  note?: string | null;
}) {
  return prisma.scenario.update({
    where: {
      id: input.scenarioId
    },
    data: {
      adoptedBaselineRunId: input.runId,
      adoptedBaselineJson: input.adoptedBaselineJson,
      adoptedBaselineAt: new Date(),
      adoptedBaselineByUserId: input.adoptedByUserId ?? null,
      adoptedBaselineNote: input.note ?? null
    },
    select: scenarioSelect
  });
}

export async function clearScenarioAdoptedBaseline(scenarioId: string) {
  return prisma.scenario.update({
    where: {
      id: scenarioId
    },
    data: {
      adoptedBaselineRunId: null,
      adoptedBaselineJson: Prisma.DbNull,
      adoptedBaselineAt: null,
      adoptedBaselineByUserId: null,
      adoptedBaselineNote: null
    },
    select: scenarioSelect
  });
}
