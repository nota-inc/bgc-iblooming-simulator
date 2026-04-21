import { Prisma } from "@prisma/client";
import { SnapshotImportStatus, SnapshotStatus } from "@prisma/client";
import type {
  CanonicalGapAudit,
  DecisionPackHistoricalTruthCoverage,
  SnapshotManifest
} from "@bgc-alpha/schemas";

import { prisma } from "./client";

export type SnapshotValidationIssueInput = {
  severity: "ERROR" | "WARNING";
  issueType: string;
  message: string;
  rowRef?: string | null;
};

export type SnapshotImportIssueInput = {
  severity: "ERROR" | "WARNING";
  issueType: string;
  message: string;
  rowRef?: string | null;
};

export type SnapshotMemberMonthFactInput = {
  periodKey: string;
  memberKey: string;
  sourceSystem: string;
  memberTier?: string | null;
  groupKey?: string | null;
  pcVolume: number;
  spRewardBasis: number;
  globalRewardUsd: number;
  poolRewardUsd: number;
  cashoutUsd: number;
  sinkSpendUsd: number;
  activeMember: boolean;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type SnapshotRewardSourcePeriodFactInput = {
  periodKey: string;
  sourceSystem: "BGC" | "IBLOOMING";
  rewardSourceCode: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  amount: number;
  obligationCount: number;
  beneficiaryCount: number;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type SnapshotPoolPeriodFactInput = {
  periodKey: string;
  poolCode: string;
  distributionCycle: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  fundingAmount: number;
  distributionAmount: number;
  recipientCount: number;
  shareCountTotal: number;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type SnapshotMemberMonthFactRecord = Awaited<
  ReturnType<typeof listSnapshotMemberMonthFacts>
>[number];

type CreateSnapshotInput = {
  name: string;
  sourceSystems: string[];
  sourceType?: "compatibility_csv" | "canonical_json" | "canonical_bundle" | "hybrid_verified";
  validatedVia?: "monthly_facts" | "canonical_events" | "hybrid_validation";
  truthNotes?: string | null;
  supersededBySnapshotId?: string | null;
  dateFrom: Date;
  dateTo: Date;
  fileUri: string;
  recordCount?: number | null;
  notes?: string | null;
  createdByUserId?: string | null;
};

type CreateSnapshotImportRunInput = {
  snapshotId: string;
  fileUri: string;
  requestedByUserId?: string | null;
};

type SnapshotListOptions = {
  includeArchived?: boolean;
};

const issueOrderBy = [
  {
    severity: "asc" as const
  },
  {
    createdAt: "asc" as const
  }
];

const snapshotValidationIssueSelect = {
  id: true,
  severity: true,
  issueType: true,
  message: true,
  rowRef: true,
  createdAt: true
} as const;

const snapshotImportIssueSelect = {
  id: true,
  severity: true,
  issueType: true,
  message: true,
  rowRef: true,
  createdAt: true
} as const;

export const snapshotBaseSelect = {
  id: true,
  name: true,
  sourceSystems: true,
  canonicalSourceSnapshotKey: true,
  sourceType: true,
  validatedVia: true,
  truthNotes: true,
  supersededBySnapshotId: true,
  dateFrom: true,
  dateTo: true,
  fileUri: true,
  recordCount: true,
  validationStatus: true,
  approvedByUserId: true,
  approvedAt: true,
  notes: true,
  createdByUserId: true,
  archivedAt: true,
  archivedByUserId: true,
  archiveReason: true,
  createdAt: true,
  updatedAt: true
} as const;

export const snapshotDefaultRelationSelect = {
  id: true,
  name: true,
  validationStatus: true,
  archivedAt: true,
  _count: {
    select: {
      memberMonthFacts: true
    }
  }
} as const;

export const runSnapshotSelect = {
  id: true,
  name: true,
  archivedAt: true
} as const;

const snapshotImportRunWithIssuesSelect = {
  id: true,
  snapshotId: true,
  fileUri: true,
  requestedByUserId: true,
  status: true,
  rowCountRaw: true,
  rowCountImported: true,
  startedAt: true,
  completedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  issues: {
    select: snapshotImportIssueSelect,
    orderBy: issueOrderBy
  }
} as const;

const snapshotSelect = {
  ...snapshotBaseSelect,
  supersededBySnapshot: {
    select: {
      id: true,
      name: true
    }
  },
  validationIssues: {
    select: snapshotValidationIssueSelect,
    orderBy: issueOrderBy
  },
  importRuns: {
    take: 1,
    orderBy: {
      createdAt: "desc" as const
    },
    select: snapshotImportRunWithIssuesSelect
  },
  _count: {
    select: {
      memberMonthFacts: true,
      importRuns: true,
      scenarios: true,
      runs: true
    }
  }
} as const;

const snapshotValidationSelect = {
  ...snapshotBaseSelect,
  validationIssues: {
    select: snapshotValidationIssueSelect,
    orderBy: issueOrderBy
  }
} as const;

export function isMissingDatasetSnapshotCanonicalSourceSnapshotKeyColumn(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2022") {
    return false;
  }

  const columnName =
    typeof error.meta === "object" &&
    error.meta !== null &&
    "column" in error.meta
      ? String((error.meta as { column?: unknown }).column ?? "")
      : "";

  return columnName.includes("DatasetSnapshot.canonicalSourceSnapshotKey");
}

export async function listSnapshots(options: SnapshotListOptions = {}) {
  return prisma.datasetSnapshot.findMany({
    ...(options.includeArchived
      ? {}
      : {
          where: {
            archivedAt: null
          }
        }),
    select: snapshotSelect,
    orderBy: [
      {
        createdAt: "desc"
      }
    ]
  });
}

export async function getSnapshotById(snapshotId: string) {
  return prisma.datasetSnapshot.findUnique({
    where: {
      id: snapshotId
    },
    select: snapshotSelect
  });
}

export async function createSnapshot(input: CreateSnapshotInput) {
  return prisma.datasetSnapshot.create({
    data: {
      name: input.name,
      sourceSystems: input.sourceSystems,
      sourceType: input.sourceType ?? "compatibility_csv",
      validatedVia: input.validatedVia ?? "monthly_facts",
      truthNotes: input.truthNotes ?? null,
      supersededBySnapshotId: input.supersededBySnapshotId ?? null,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      fileUri: input.fileUri,
      recordCount: input.recordCount ?? null,
      notes: input.notes ?? null,
      createdByUserId: input.createdByUserId ?? null
    },
    select: snapshotSelect
  });
}

export async function createSnapshotImportRun(input: CreateSnapshotImportRunInput) {
  return prisma.snapshotImportRun.create({
    data: {
      snapshotId: input.snapshotId,
      fileUri: input.fileUri,
      requestedByUserId: input.requestedByUserId ?? null,
      status: SnapshotImportStatus.QUEUED
    },
    include: {
      issues: true
    }
  });
}

export async function getSnapshotImportRunById(importRunId: string) {
  return prisma.snapshotImportRun.findUnique({
    where: {
      id: importRunId
    },
    select: {
      id: true,
      snapshotId: true,
      fileUri: true,
      requestedByUserId: true,
      status: true,
      rowCountRaw: true,
      rowCountImported: true,
      startedAt: true,
      completedAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      snapshot: {
        select: {
          id: true,
          name: true,
          fileUri: true,
          dateFrom: true,
          dateTo: true,
          validationStatus: true
        }
      },
      issues: {
        select: snapshotImportIssueSelect,
        orderBy: [
          {
            severity: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    }
  });
}

export async function listSnapshotMemberMonthFacts(snapshotId: string) {
  return prisma.snapshotMemberMonthFact.findMany({
    where: {
      snapshotId
    },
    orderBy: [
      {
        periodKey: "asc"
      },
      {
        memberKey: "asc"
      },
      {
        sourceSystem: "asc"
      }
    ]
  });
}

export async function listSnapshotRewardSourcePeriodFacts(snapshotId: string) {
  return prisma.snapshotRewardSourcePeriodFact.findMany({
    where: {
      snapshotId
    },
    orderBy: [{ periodKey: "asc" }, { sourceSystem: "asc" }, { rewardSourceCode: "asc" }]
  });
}

export async function listSnapshotPoolPeriodFacts(snapshotId: string) {
  return prisma.snapshotPoolPeriodFact.findMany({
    where: {
      snapshotId
    },
    orderBy: [{ periodKey: "asc" }, { poolCode: "asc" }, { distributionCycle: "asc" }]
  });
}

export async function markSnapshotImportRunning(importRunId: string) {
  return prisma.snapshotImportRun.update({
    where: {
      id: importRunId
    },
    data: {
      status: SnapshotImportStatus.RUNNING,
      startedAt: new Date(),
      completedAt: null,
      notes: null
    }
  });
}

export async function replaceSnapshotFactsAndCompleteImport(
  importRunId: string,
  snapshotId: string,
  facts: SnapshotMemberMonthFactInput[],
  input: {
    rowCountRaw: number;
    rowCountImported: number;
    notes?: string | null;
    issues?: SnapshotImportIssueInput[];
    rewardSourcePeriodFacts?: SnapshotRewardSourcePeriodFactInput[];
    poolPeriodFacts?: SnapshotPoolPeriodFactInput[];
    canonicalSourceSnapshotKey?: string | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    await tx.snapshotImportIssue.deleteMany({
      where: {
        importRunId
      }
    });

    if (input.issues && input.issues.length > 0) {
      await tx.snapshotImportIssue.createMany({
        data: input.issues.map((issue) => ({
          importRunId,
          severity: issue.severity,
          issueType: issue.issueType,
          message: issue.message,
          rowRef: issue.rowRef ?? null
        }))
      });
    }

    await tx.snapshotMemberMonthFact.deleteMany({
      where: {
        snapshotId
      }
    });

    await tx.snapshotRewardSourcePeriodFact.deleteMany({
      where: {
        snapshotId
      }
    });

    await tx.snapshotPoolPeriodFact.deleteMany({
      where: {
        snapshotId
      }
    });

    await tx.snapshotValidationIssue.deleteMany({
      where: {
        snapshotId
      }
    });

    if (facts.length > 0) {
      await tx.snapshotMemberMonthFact.createMany({
        data: facts.map((fact) => ({
          snapshotId,
          importRunId,
          periodKey: fact.periodKey,
          memberKey: fact.memberKey,
          sourceSystem: fact.sourceSystem,
          memberTier: fact.memberTier ?? null,
          groupKey: fact.groupKey ?? null,
          pcVolume: fact.pcVolume,
          spRewardBasis: fact.spRewardBasis,
          globalRewardUsd: fact.globalRewardUsd,
          poolRewardUsd: fact.poolRewardUsd,
          cashoutUsd: fact.cashoutUsd,
          sinkSpendUsd: fact.sinkSpendUsd,
          activeMember: fact.activeMember,
          metadataJson:
            typeof fact.metadataJson === "undefined"
              ? undefined
              : fact.metadataJson === null
                ? Prisma.JsonNull
                : fact.metadataJson
        }))
      });
    }

    if (input.rewardSourcePeriodFacts && input.rewardSourcePeriodFacts.length > 0) {
      await tx.snapshotRewardSourcePeriodFact.createMany({
        data: input.rewardSourcePeriodFacts.map((fact) => ({
          snapshotId,
          importRunId,
          periodKey: fact.periodKey,
          sourceSystem: fact.sourceSystem,
          rewardSourceCode: fact.rewardSourceCode as never,
          unit: fact.unit,
          amount: fact.amount,
          obligationCount: fact.obligationCount,
          beneficiaryCount: fact.beneficiaryCount,
          metadataJson:
            typeof fact.metadataJson === "undefined"
              ? undefined
              : fact.metadataJson === null
                ? Prisma.JsonNull
                : fact.metadataJson
        }))
      });
    }

    if (input.poolPeriodFacts && input.poolPeriodFacts.length > 0) {
      await tx.snapshotPoolPeriodFact.createMany({
        data: input.poolPeriodFacts.map((fact) => ({
          snapshotId,
          importRunId,
          periodKey: fact.periodKey,
          poolCode: fact.poolCode as never,
          distributionCycle: fact.distributionCycle as never,
          unit: fact.unit,
          fundingAmount: fact.fundingAmount,
          distributionAmount: fact.distributionAmount,
          recipientCount: fact.recipientCount,
          shareCountTotal: fact.shareCountTotal,
          metadataJson:
            typeof fact.metadataJson === "undefined"
              ? undefined
              : fact.metadataJson === null
                ? Prisma.JsonNull
                : fact.metadataJson
        }))
      });
    }

    try {
      await tx.datasetSnapshot.update({
        where: {
          id: snapshotId
        },
        data: {
          validationStatus: SnapshotStatus.DRAFT,
          approvedAt: null,
          approvedByUserId: null,
          canonicalSourceSnapshotKey: input.canonicalSourceSnapshotKey ?? null
        },
        select: {
          id: true
        }
      });
    } catch (error) {
      if (!isMissingDatasetSnapshotCanonicalSourceSnapshotKeyColumn(error)) {
        throw error;
      }

      await tx.datasetSnapshot.update({
        where: {
          id: snapshotId
        },
        data: {
          validationStatus: SnapshotStatus.DRAFT,
          approvedAt: null,
          approvedByUserId: null
        },
        select: {
          id: true
        }
      });
    }

    return tx.snapshotImportRun.update({
      where: {
        id: importRunId
      },
      data: {
        status: SnapshotImportStatus.COMPLETED,
        rowCountRaw: input.rowCountRaw,
        rowCountImported: input.rowCountImported,
        completedAt: new Date(),
        notes: input.notes ?? null
      },
      include: {
        issues: {
          orderBy: [
            {
              severity: "asc"
            },
            {
              createdAt: "asc"
            }
          ]
        }
      }
    });
  });
}

export async function failSnapshotImportRun(
  importRunId: string,
  input: {
    message: string;
    rowCountRaw?: number | null;
    rowCountImported?: number | null;
    issues?: SnapshotImportIssueInput[];
  }
) {
  return prisma.$transaction(async (tx) => {
    await tx.snapshotImportIssue.deleteMany({
      where: {
        importRunId
      }
    });

    if (input.issues && input.issues.length > 0) {
      await tx.snapshotImportIssue.createMany({
        data: input.issues.map((issue) => ({
          importRunId,
          severity: issue.severity,
          issueType: issue.issueType,
          message: issue.message,
          rowRef: issue.rowRef ?? null
        }))
      });
    }

    return tx.snapshotImportRun.update({
      where: {
        id: importRunId
      },
      data: {
        status: SnapshotImportStatus.FAILED,
        rowCountRaw: input.rowCountRaw ?? null,
        rowCountImported: input.rowCountImported ?? null,
        completedAt: new Date(),
        notes: input.message
      },
      include: {
        issues: {
          orderBy: [
            {
              severity: "asc"
            },
            {
              createdAt: "asc"
            }
          ]
        }
      }
    });
  });
}

export async function setSnapshotValidationResult(
  snapshotId: string,
  issues: SnapshotValidationIssueInput[]
) {
  const status = issues.some((issue) => issue.severity === "ERROR")
    ? SnapshotStatus.INVALID
    : SnapshotStatus.VALID;

  return prisma.$transaction(async (tx) => {
    await tx.snapshotValidationIssue.deleteMany({
      where: {
        snapshotId
      }
    });

    if (issues.length > 0) {
      await tx.snapshotValidationIssue.createMany({
        data: issues.map((issue) => ({
          snapshotId,
          severity: issue.severity,
          issueType: issue.issueType,
          message: issue.message,
          rowRef: issue.rowRef ?? null
        }))
      });
    }

    return tx.datasetSnapshot.update({
      where: {
        id: snapshotId
      },
      data: {
        validationStatus: status
      },
      select: snapshotValidationSelect
    });
  });
}

export async function markSnapshotValidating(snapshotId: string) {
  return prisma.datasetSnapshot.update({
    where: {
      id: snapshotId
    },
    data: {
      validationStatus: SnapshotStatus.VALIDATING
    },
    select: {
      id: true,
      validationStatus: true
    }
  });
}

export async function approveSnapshot(snapshotId: string, approvedByUserId: string) {
  return prisma.datasetSnapshot.update({
    where: {
      id: snapshotId
    },
    data: {
      validationStatus: SnapshotStatus.APPROVED,
      approvedByUserId,
      approvedAt: new Date()
    },
    select: snapshotValidationSelect
  });
}

export async function archiveSnapshot(
  snapshotId: string,
  input: {
    archivedByUserId?: string | null;
    reason?: string | null;
  }
) {
  return prisma.datasetSnapshot.update({
    where: {
      id: snapshotId
    },
    data: {
      archivedAt: new Date(),
      archivedByUserId: input.archivedByUserId ?? null,
      archiveReason: input.reason ?? null
    },
    select: snapshotSelect
  });
}

export async function unarchiveSnapshot(snapshotId: string) {
  return prisma.datasetSnapshot.update({
    where: {
      id: snapshotId
    },
    data: {
      archivedAt: null,
      archivedByUserId: null,
      archiveReason: null
    },
    select: snapshotSelect
  });
}

export async function getSnapshotStorageCleanupReport() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [snapshots, failedImportRuns, failedImportCandidateCount] = await Promise.all([
    prisma.datasetSnapshot.findMany({
      select: {
        id: true,
        name: true,
        canonicalSourceSnapshotKey: true,
        fileUri: true,
        archivedAt: true,
        createdAt: true,
        _count: {
          select: {
            scenarios: true,
            runs: true,
            importRuns: true,
            memberMonthFacts: true,
            canonicalMembers: true,
            canonicalBusinessEvents: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.snapshotImportRun.findMany({
      where: {
        status: SnapshotImportStatus.FAILED,
        completedAt: {
          lt: thirtyDaysAgo
        }
      },
      select: {
        id: true,
        snapshotId: true,
        createdAt: true,
        completedAt: true,
        snapshot: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        completedAt: "asc"
      },
      take: 10
    }),
    prisma.snapshotImportRun.count({
      where: {
        status: SnapshotImportStatus.FAILED,
        completedAt: {
          lt: thirtyDaysAgo
        }
      }
    })
  ]);

  const archivedSnapshots = snapshots.filter((snapshot) => Boolean(snapshot.archivedAt));
  const lockedSnapshots = snapshots.filter(
    (snapshot) => snapshot._count.scenarios > 0 || snapshot._count.runs > 0
  );
  const unreferencedArchivedSnapshots = archivedSnapshots.filter(
    (snapshot) => snapshot._count.scenarios === 0 && snapshot._count.runs === 0
  );
  const rawFileCleanupCandidates = unreferencedArchivedSnapshots.filter((snapshot) =>
    Boolean(snapshot.fileUri)
  );

  type CleanupSnapshotRecord = (typeof snapshots)[number];
  const duplicateGroups = new Map<string, CleanupSnapshotRecord[]>();
  for (const snapshot of snapshots) {
    if (!snapshot.canonicalSourceSnapshotKey) {
      continue;
    }

    const group = duplicateGroups.get(snapshot.canonicalSourceSnapshotKey) ?? [];
    group.push(snapshot);
    duplicateGroups.set(snapshot.canonicalSourceSnapshotKey, group);
  }

  const supersedeCandidates = [...duplicateGroups.values()].flatMap((group) => {
    if (group.length < 2) {
      return [];
    }

    const ordered = [...group].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    );
    return ordered.slice(1);
  });

  return {
    totals: {
      archivedSnapshots: archivedSnapshots.length,
      lockedSnapshots: lockedSnapshots.length,
      unreferencedArchivedSnapshots: unreferencedArchivedSnapshots.length,
      rawFileCleanupCandidates: rawFileCleanupCandidates.length,
      failedImportCandidates: failedImportCandidateCount,
      supersedeCandidates: supersedeCandidates.length
    },
    rawFileCleanupCandidates: rawFileCleanupCandidates.slice(0, 10).map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      archivedAt: snapshot.archivedAt?.toISOString() ?? null,
      scenarioRefs: snapshot._count.scenarios,
      runRefs: snapshot._count.runs
    })),
    failedImportCandidates: failedImportRuns.map((run) => ({
      id: run.id,
      snapshotId: run.snapshotId,
      snapshotName: run.snapshot.name,
      completedAt: run.completedAt?.toISOString() ?? null
    })),
    supersedeCandidates: supersedeCandidates.slice(0, 10).map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      canonicalSourceSnapshotKey: snapshot.canonicalSourceSnapshotKey,
      createdAt: snapshot.createdAt.toISOString(),
      scenarioRefs: snapshot._count.scenarios,
      runRefs: snapshot._count.runs
    }))
  };
}

export async function getSnapshotTruthCoverage(
  snapshotId: string
): Promise<DecisionPackHistoricalTruthCoverage | null> {
  const snapshot = await prisma.datasetSnapshot.findUnique({
    where: {
      id: snapshotId
    },
    select: {
      name: true,
      validationStatus: true,
      _count: {
        select: {
          memberMonthFacts: true,
          rewardSourcePeriodFacts: true,
          poolPeriodFacts: true,
          canonicalMembers: true,
          canonicalMemberAliases: true,
          canonicalPcEntries: true,
          canonicalSpEntries: true,
          canonicalBusinessEvents: true,
          canonicalRewardObligations: true,
          canonicalPoolEntries: true,
          canonicalCashoutEvents: true,
          canonicalQualificationWindows: true,
          canonicalQualificationStatusHistory: true
        }
      }
    }
  });

  if (!snapshot) {
    return null;
  }

  const rows: DecisionPackHistoricalTruthCoverage["rows"] = [
    {
      key: "snapshot_approval",
      label: "Snapshot approval state",
      status:
        snapshot.validationStatus === "APPROVED"
          ? "available"
          : snapshot.validationStatus === "VALID"
            ? "partial"
            : "missing",
      detail:
        snapshot.validationStatus === "APPROVED"
          ? `${snapshot.name} is approved for simulation truth.`
          : snapshot.validationStatus === "VALID"
            ? `${snapshot.name} is validated but not yet approved.`
            : `${snapshot.name} is not yet fully approved for stable truth claims.`
    },
    {
      key: "derived_member_period_facts",
      label: "Derived member-period facts",
      status: snapshot._count.memberMonthFacts > 0 ? "available" : "missing",
      detail:
        snapshot._count.memberMonthFacts > 0
          ? `${snapshot._count.memberMonthFacts} member-period fact rows are available for simulation input.`
          : "No derived member-period facts are stored for this snapshot."
    },
    {
      key: "canonical_member_registry",
      label: "Canonical member registry",
      status:
        snapshot._count.canonicalMembers > 0 && snapshot._count.canonicalMemberAliases > 0
          ? "available"
          : snapshot._count.canonicalMembers > 0
            ? "partial"
            : "missing",
      detail:
        snapshot._count.canonicalMembers > 0
          ? `${snapshot._count.canonicalMembers} canonical members and ${snapshot._count.canonicalMemberAliases} aliases are stored.`
          : "No canonical member registry is stored for this snapshot."
    },
    {
      key: "canonical_business_events",
      label: "Canonical business events",
      status: snapshot._count.canonicalBusinessEvents > 0 ? "available" : "missing",
      detail:
        snapshot._count.canonicalBusinessEvents > 0
          ? `${snapshot._count.canonicalBusinessEvents} canonical business events are stored.`
          : "No canonical business events are stored for this snapshot."
    },
    {
      key: "canonical_reward_ledgers",
      label: "Canonical reward / pool / cashout ledgers",
      status:
        snapshot._count.canonicalRewardObligations > 0 &&
        snapshot._count.canonicalPoolEntries > 0 &&
        snapshot._count.canonicalCashoutEvents > 0
          ? "available"
          : snapshot._count.canonicalRewardObligations > 0 ||
              snapshot._count.canonicalPoolEntries > 0 ||
              snapshot._count.canonicalCashoutEvents > 0
            ? "partial"
            : "missing",
      detail:
        snapshot._count.canonicalRewardObligations > 0 ||
        snapshot._count.canonicalPoolEntries > 0 ||
        snapshot._count.canonicalCashoutEvents > 0
          ? `${snapshot._count.canonicalRewardObligations} reward obligations, ${snapshot._count.canonicalPoolEntries} pool entries, and ${snapshot._count.canonicalCashoutEvents} cashout events are stored.`
          : "No canonical reward, pool, or cashout ledger rows are stored for this snapshot."
    },
    {
      key: "period_fact_coverage",
      label: "Reward-source and pool period facts",
      status:
        snapshot._count.rewardSourcePeriodFacts > 0 && snapshot._count.poolPeriodFacts > 0
          ? "available"
          : snapshot._count.rewardSourcePeriodFacts > 0 || snapshot._count.poolPeriodFacts > 0
            ? "partial"
            : "missing",
      detail:
        snapshot._count.rewardSourcePeriodFacts > 0 || snapshot._count.poolPeriodFacts > 0
          ? `${snapshot._count.rewardSourcePeriodFacts} reward-source period facts and ${snapshot._count.poolPeriodFacts} pool period facts are stored.`
          : "No reward-source or pool period facts are stored for this snapshot."
    },
    {
      key: "qualification_history",
      label: "Qualification history",
      status: snapshot._count.canonicalQualificationStatusHistory > 0 ? "available" : "missing",
      detail:
        snapshot._count.canonicalQualificationStatusHistory > 0
          ? `${snapshot._count.canonicalQualificationStatusHistory} qualification history rows are stored.`
          : "No canonical qualification history is stored for this snapshot."
    }
  ];

  const availableCount = rows.filter((row) => row.status === "available").length;
  const missingCriticalTruth =
    snapshot.validationStatus !== "APPROVED" ||
    snapshot._count.memberMonthFacts === 0 ||
    snapshot._count.canonicalBusinessEvents === 0;
  const status: DecisionPackHistoricalTruthCoverage["status"] = missingCriticalTruth
    ? availableCount >= 3
      ? "partial"
      : "weak"
    : availableCount >= 5
      ? "strong"
      : "partial";

  const summary =
    status === "strong"
      ? "Approved snapshot truth is backed by canonical ledgers and derived simulation facts, so recommendation claims can trace back to stored business evidence."
      : status === "partial"
        ? "Snapshot truth is usable, but some canonical layers are still incomplete or not fully approved, so founder claims should stay calibrated."
        : "Snapshot truth coverage is weak. Simulation outputs may still be useful for discussion, but they should not be treated as fully faithful final evidence.";

  return {
    status,
    summary,
    rows
  };
}

export function buildSnapshotManifest(
  snapshot: {
    sourceType: string;
    validatedVia: string;
    truthNotes: string | null;
    supersededBySnapshotId: string | null;
  },
  truthCoverage: DecisionPackHistoricalTruthCoverage | null
): SnapshotManifest {
  const truthLevel = truthCoverage?.status ?? "weak";
  const founderReadiness: SnapshotManifest["founderReadiness"] =
    truthLevel === "strong" ? "founder_safe" : "needs_canonical_closure";

  return {
    sourceType:
      snapshot.sourceType === "canonical_json" ||
      snapshot.sourceType === "canonical_bundle" ||
      snapshot.sourceType === "hybrid_verified"
        ? snapshot.sourceType
        : "compatibility_csv",
    validatedVia:
      snapshot.validatedVia === "canonical_events" ||
      snapshot.validatedVia === "hybrid_validation"
        ? snapshot.validatedVia
        : "monthly_facts",
    truthLevel,
    founderReadiness,
    summary:
      founderReadiness === "founder_safe"
        ? "This snapshot is strong enough to support founder-facing simulation claims."
        : "This snapshot is usable, but canonical closure is still needed before treating it as the strongest founder-facing truth source.",
    truthNotes: snapshot.truthNotes ?? null,
    supersededBySnapshotId: snapshot.supersededBySnapshotId ?? null
  };
}

export async function getSnapshotCanonicalGapAudit(
  snapshotId: string
): Promise<CanonicalGapAudit | null> {
  const snapshot = await prisma.datasetSnapshot.findUnique({
    where: {
      id: snapshotId
    },
    select: {
      validationStatus: true,
      _count: {
        select: {
          memberMonthFacts: true,
          canonicalMembers: true,
          canonicalMemberAliases: true,
          canonicalRoleHistory: true,
          canonicalBusinessEvents: true,
          canonicalPcEntries: true,
          canonicalSpEntries: true,
          canonicalRewardObligations: true,
          canonicalPoolEntries: true,
          canonicalCashoutEvents: true,
          canonicalQualificationWindows: true,
          canonicalQualificationStatusHistory: true
        }
      }
    }
  });

  if (!snapshot) {
    return null;
  }

  const rows: CanonicalGapAudit["rows"] = [
    {
      key: "member_provenance",
      label: "Member provenance",
      status:
        snapshot._count.canonicalMembers > 0 &&
        snapshot._count.canonicalMemberAliases > 0 &&
        snapshot._count.canonicalRoleHistory > 0
          ? "covered"
          : snapshot._count.canonicalMembers > 0 ||
              snapshot._count.canonicalMemberAliases > 0 ||
              snapshot._count.canonicalRoleHistory > 0
            ? "partial"
            : "missing",
      detail:
        snapshot._count.canonicalMembers > 0 ||
        snapshot._count.canonicalMemberAliases > 0 ||
        snapshot._count.canonicalRoleHistory > 0
          ? `${snapshot._count.canonicalMembers} members, ${snapshot._count.canonicalMemberAliases} aliases, ${snapshot._count.canonicalRoleHistory} role history rows.`
          : "No canonical member provenance is stored."
    },
    {
      key: "event_lineage",
      label: "Business-event lineage",
      status: snapshot._count.canonicalBusinessEvents > 0 ? "covered" : "missing",
      detail:
        snapshot._count.canonicalBusinessEvents > 0
          ? `${snapshot._count.canonicalBusinessEvents} canonical business events are stored.`
          : "No canonical business-event lineage is stored."
    },
    {
      key: "reward_lineage",
      label: "Reward lineage",
      status:
        snapshot._count.canonicalRewardObligations > 0 &&
        snapshot._count.canonicalPcEntries > 0 &&
        snapshot._count.canonicalSpEntries > 0
          ? "covered"
          : snapshot._count.canonicalRewardObligations > 0 ||
              snapshot._count.canonicalPcEntries > 0 ||
              snapshot._count.canonicalSpEntries > 0
            ? "partial"
            : "missing",
      detail:
        snapshot._count.canonicalRewardObligations > 0 ||
        snapshot._count.canonicalPcEntries > 0 ||
        snapshot._count.canonicalSpEntries > 0
          ? `${snapshot._count.canonicalRewardObligations} reward obligations, ${snapshot._count.canonicalPcEntries} PC entries, ${snapshot._count.canonicalSpEntries} SP entries.`
          : "No canonical reward lineage is stored."
    },
    {
      key: "pool_lineage",
      label: "Pool lineage",
      status: snapshot._count.canonicalPoolEntries > 0 ? "covered" : "missing",
      detail:
        snapshot._count.canonicalPoolEntries > 0
          ? `${snapshot._count.canonicalPoolEntries} canonical pool ledger rows are stored.`
          : "No canonical pool lineage is stored."
    },
    {
      key: "cashout_lineage",
      label: "Cash-out lineage",
      status: snapshot._count.canonicalCashoutEvents > 0 ? "covered" : "missing",
      detail:
        snapshot._count.canonicalCashoutEvents > 0
          ? `${snapshot._count.canonicalCashoutEvents} canonical cash-out events are stored.`
          : "No canonical cash-out lineage is stored."
    },
    {
      key: "qualification_windows",
      label: "Qualification windows",
      status:
        snapshot._count.canonicalQualificationWindows > 0 &&
        snapshot._count.canonicalQualificationStatusHistory > 0
          ? "covered"
          : snapshot._count.canonicalQualificationWindows > 0 ||
              snapshot._count.canonicalQualificationStatusHistory > 0
            ? "partial"
            : "missing",
      detail:
        snapshot._count.canonicalQualificationWindows > 0 ||
        snapshot._count.canonicalQualificationStatusHistory > 0
          ? `${snapshot._count.canonicalQualificationWindows} qualification windows and ${snapshot._count.canonicalQualificationStatusHistory} status history rows.`
          : "No canonical qualification lineage is stored."
    },
    {
      key: "compatibility_bridge",
      label: "Compatibility monthly bridge",
      status: snapshot._count.memberMonthFacts > 0 ? "covered" : "missing",
      detail:
        snapshot._count.memberMonthFacts > 0
          ? `${snapshot._count.memberMonthFacts} compatibility monthly fact rows are stored.`
          : "No compatibility monthly bridge is stored."
    }
  ];

  const coveredCount = rows.filter((row) => row.status === "covered").length;
  const missingCritical =
    snapshot.validationStatus !== "APPROVED" ||
    rows.some(
      (row) =>
        ["member_provenance", "event_lineage", "reward_lineage"].includes(row.key) &&
        row.status === "missing"
    );
  const readiness: CanonicalGapAudit["readiness"] = missingCritical
    ? coveredCount >= 4
      ? "partial"
      : "weak"
    : coveredCount >= 6
      ? "strong"
      : "partial";

  return {
    readiness,
    summary:
      readiness === "strong"
        ? "Canonical lineage is broadly closed across member provenance, events, rewards, pools, cash-out, and qualification tracking."
        : readiness === "partial"
          ? "Canonical lineage is partially available. The simulator can support decisions, but some rule families still rely on incomplete event-native closure."
          : "Canonical lineage is still weak. The simulator remains useful for discussion, but final claims should stay calibrated until deeper canonical closure is complete.",
    rows
  };
}
