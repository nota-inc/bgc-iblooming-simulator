import type PgBoss from "pg-boss";

import { registerDecisionPackJob } from "./generate-decision-pack";
import { registerExportJob } from "./generate-export";
import { registerSnapshotImportJob } from "./import-snapshot";
import { registerSimulationJob } from "./run-simulation";
import { registerSnapshotValidationJob } from "./validate-snapshot";

export async function registerJobs(boss: PgBoss) {
  await registerSnapshotImportJob(boss);
  await registerSnapshotValidationJob(boss);
  await registerSimulationJob(boss);
  await registerDecisionPackJob(boss);
  await registerExportJob(boss);
}
