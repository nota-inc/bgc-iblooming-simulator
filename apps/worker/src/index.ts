import { createBoss } from "./lib/boss";
import { registerJobs } from "./jobs";

async function main() {
  const boss = await createBoss();
  await registerJobs(boss);
  console.log("[worker] ready");
}

main().catch((error) => {
  console.error("[worker] failed to start", error);
  process.exit(1);
});

