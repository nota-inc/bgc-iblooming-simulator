import type PgBoss from "pg-boss";

export async function registerSnapshotValidationJob(boss: PgBoss) {
  await boss.createQueue("snapshot.validate");
  await boss.work("snapshot.validate", async (jobs) => {
    const job = jobs[0];

    if (!job) {
      return { ok: false, reason: "No job payload received." };
    }

    console.log("[worker] validate snapshot", job.data);
    return { ok: true };
  });
}
