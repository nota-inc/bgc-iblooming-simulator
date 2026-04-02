import { Prisma } from "@prisma/client";

import { prisma } from "./client";

const userRoleInclude = Prisma.validator<Prisma.UserInclude>()({
  userRoles: {
    include: {
      role: true
    }
  }
});

export type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof userRoleInclude;
}>;

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email: email.toLowerCase()
    },
    include: userRoleInclude
  });
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId
    },
    include: userRoleInclude
  });
}

export function mapUserRoles(user: Pick<UserWithRoles, "userRoles">) {
  return user.userRoles.map((entry) => entry.role.key);
}

export async function recordUserLogin(userId: string) {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      lastLoginAt: new Date()
    }
  });
}
