import { prisma } from "@bgc-alpha/db";
import { modelV1 } from "@bgc-alpha/baseline-model";

async function main() {
  const record = await prisma.baselineModelVersion.upsert({
    where: {
      versionName: modelV1.version
    },
    update: {
      description: modelV1.summary,
      status: "ACTIVE",
      rulesetJson: modelV1
    },
    create: {
      versionName: modelV1.version,
      description: modelV1.summary,
      status: "ACTIVE",
      rulesetJson: modelV1
    }
  });

  console.log(`Seeded baseline model ${record.versionName}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
