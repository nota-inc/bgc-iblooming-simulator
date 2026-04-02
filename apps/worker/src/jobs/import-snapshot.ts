import type PgBoss from "pg-boss";

import { processSnapshotImportRun } from "@bgc-alpha/db";
import { snapshotImportJobSchema } from "@bgc-alpha/schemas";

export async function registerSnapshotImportJob(boss: PgBoss) {
  await boss.createQueue("snapshot.import");
  await boss.work("snapshot.import", async (jobs) => {
    const job = jobs[0];

    if (!job) {
      return { ok: false, reason: "No job payload received." };
    }

    const payload = snapshotImportJobSchema.parse(job.data ?? {});
    const result = await processSnapshotImportRun(payload.importRunId);

    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }

    console.log("[worker] import snapshot", {
      snapshotId: payload.snapshotId,
      importRunId: result.importRun.id,
      rowCountImported: result.rowCountImported
    });

    return {
      ok: true,
      importRunId: result.importRun.id,
      rowCountImported: result.rowCountImported
    };
  });
}
