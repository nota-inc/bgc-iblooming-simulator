import PgBoss from "pg-boss";

export async function createBoss() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the worker");
  }

  const boss = new PgBoss({
    connectionString
  });

  await boss.start();
  return boss;
}

