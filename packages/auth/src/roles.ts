export const appRoles = ["founder", "analyst", "product", "engineering", "admin"] as const;

export type AppRole = (typeof appRoles)[number];

export const appCapabilities = [
  "overview.read",
  "snapshots.read",
  "snapshots.write",
  "snapshots.validate",
  "snapshots.approve",
  "scenarios.read",
  "scenarios.write",
  "runs.read",
  "runs.write",
  "compare.read",
  "decision-pack.read",
  "decision-pack.write",
  "decision-pack.export",
  "model.read",
  "users.write",
  "roles.write",
  "audit.read"
] as const;

export type AppCapability = (typeof appCapabilities)[number];

export const roleCapabilities: Record<AppRole, readonly AppCapability[]> = {
  founder: [
    "overview.read",
    "snapshots.read",
    "snapshots.approve",
    "scenarios.read",
    "runs.read",
    "compare.read",
    "decision-pack.read",
    "decision-pack.export"
  ],
  analyst: [
    "overview.read",
    "snapshots.read",
    "snapshots.write",
    "snapshots.validate",
    "scenarios.read",
    "scenarios.write",
    "runs.read",
    "runs.write",
    "compare.read"
  ],
  product: [
    "overview.read",
    "snapshots.read",
    "scenarios.read",
    "scenarios.write",
    "compare.read",
    "decision-pack.read",
    "decision-pack.write"
  ],
  engineering: [
    "overview.read",
    "snapshots.read",
    "scenarios.read",
    "runs.read",
    "compare.read",
    "model.read"
  ],
  admin: appCapabilities
};

export function getCapabilitiesForRoles(roles: AppRole[]) {
  return [...new Set(roles.flatMap((role) => roleCapabilities[role]))];
}
