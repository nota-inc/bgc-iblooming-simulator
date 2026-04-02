import {
  createSnapshotImportRun,
  getSnapshotById,
  getSnapshotImportRunById,
  prisma,
  writeAuditEvent
} from "@bgc-alpha/db";

import { getQueueClient } from "../apps/web/lib/queue";

function parseArgs(argv: string[]) {
  const [snapshotId, ...rest] = argv;

  if (!snapshotId) {
    throw new Error("Pass the snapshot ID as the first argument.");
  }

  return {
    snapshotId,
    wait: rest.includes("--wait")
  };
}

async function waitForImport(importRunId: string) {
  while (true) {
    const importRun = await getSnapshotImportRunById(importRunId);

    if (!importRun) {
      throw new Error(`Import run ${importRunId} was not found.`);
    }

    if (importRun.status === "COMPLETED" || importRun.status === "FAILED") {
      return importRun;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }
}

async function main() {
  const { snapshotId, wait } = parseArgs(process.argv.slice(2));
  const snapshot = await getSnapshotById(snapshotId);

  if (!snapshot) {
    throw new Error(`Snapshot ${snapshotId} was not found.`);
  }

  const importRun = await createSnapshotImportRun({
    snapshotId: snapshot.id,
    fileUri: snapshot.fileUri,
    requestedByUserId: snapshot.createdByUserId ?? null
  });

  const boss = await getQueueClient();
  try {
    await boss.createQueue("snapshot.import");
    await boss.send("snapshot.import", {
      snapshotId: snapshot.id,
      importRunId: importRun.id
    });

    await writeAuditEvent({
      actorUserId: snapshot.createdByUserId ?? null,
      entityType: "dataset_snapshot",
      entityId: snapshot.id,
      action: "snapshot.import_queued",
      metadata: {
        importRunId: importRun.id,
        fileUri: snapshot.fileUri,
        source: "cli"
      }
    });

    console.log(
      `Queued snapshot import ${importRun.id} for snapshot ${snapshot.id} (${snapshot.name}).`
    );

    if (wait) {
      const completedRun = await waitForImport(importRun.id);

      console.log(
        JSON.stringify(
          {
            importRunId: completedRun.id,
            status: completedRun.status,
            rowCountRaw: completedRun.rowCountRaw,
            rowCountImported: completedRun.rowCountImported,
            notes: completedRun.notes,
            issues: completedRun.issues.map((issue) => ({
              severity: issue.severity,
              issueType: issue.issueType,
              rowRef: issue.rowRef,
              message: issue.message
            }))
          },
          null,
          2
        )
      );
    }
  } finally {
    await boss.stop();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
