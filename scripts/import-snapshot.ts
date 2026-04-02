import { createSnapshot, prisma } from "@bgc-alpha/db";
import { createDatasetSnapshotSchema } from "@bgc-alpha/schemas";

async function main() {
  const [payloadArg] = process.argv.slice(2);

  if (!payloadArg) {
    throw new Error("Pass a JSON payload as the first argument.");
  }

  const payload = createDatasetSnapshotSchema.parse(JSON.parse(payloadArg));
  const snapshot = await createSnapshot({
    ...payload,
    dateFrom: new Date(payload.dateFrom),
    dateTo: new Date(payload.dateTo)
  });

  console.log(`Registered snapshot ${snapshot.id} (${snapshot.name}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
