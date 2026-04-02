import { prisma } from "@bgc-alpha/db";
import { hashPassword } from "@bgc-alpha/auth/passwords";
import { appRoles } from "@bgc-alpha/auth/roles";

const seedUsers = [
  {
    name: "Founder User",
    email: "founder@bgc.local",
    roleKeys: ["founder"] as const
  },
  {
    name: "Analyst User",
    email: "analyst@bgc.local",
    roleKeys: ["analyst"] as const
  },
  {
    name: "Product User",
    email: "product@bgc.local",
    roleKeys: ["product"] as const
  },
  {
    name: "Engineering User",
    email: "engineering@bgc.local",
    roleKeys: ["engineering"] as const
  },
  {
    name: "Admin User",
    email: "admin@bgc.local",
    roleKeys: ["admin"] as const
  }
];

async function main() {
  const password = process.env.SEED_USER_PASSWORD ?? "ChangeMe123!";

  for (const roleKey of appRoles) {
    await prisma.role.upsert({
      where: {
        key: roleKey
      },
      update: {
        label: roleKey[0].toUpperCase() + roleKey.slice(1)
      },
      create: {
        key: roleKey,
        label: roleKey[0].toUpperCase() + roleKey.slice(1)
      }
    });
  }

  for (const seedUser of seedUsers) {
    const user = await prisma.user.upsert({
      where: {
        email: seedUser.email
      },
      update: {
        name: seedUser.name,
        passwordHash: hashPassword(password),
        status: "ACTIVE"
      },
      create: {
        name: seedUser.name,
        email: seedUser.email,
        passwordHash: hashPassword(password),
        status: "ACTIVE"
      }
    });

    for (const roleKey of seedUser.roleKeys) {
      const role = await prisma.role.findUniqueOrThrow({
        where: {
          key: roleKey
        }
      });

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id
          }
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id
        }
      });
    }
  }

  console.log(`Seeded ${seedUsers.length} internal users with password "${password}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
