import type PgBoss from "pg-boss";

export async function registerExportJob(boss: PgBoss) {
  await boss.createQueue("export.generate");
  await boss.work("export.generate", async (jobs) => {
    const job = jobs[0];

    if (!job) {
      return { ok: false, reason: "No job payload received." };
    }

    console.log("[worker] generate export", job.data);
    return { ok: true };
  });
}
