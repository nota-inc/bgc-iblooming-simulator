import type { Prisma } from "@prisma/client";

import { prisma } from "./client";

type WriteAuditEventInput = {
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditEvent({
  actorUserId,
  entityType,
  entityId,
  action,
  metadata = {}
}: WriteAuditEventInput) {
  return prisma.auditEvent.create({
    data: {
      actorUserId: actorUserId ?? null,
      entityType,
      entityId,
      action,
      metadataJson: metadata
    }
  });
}
