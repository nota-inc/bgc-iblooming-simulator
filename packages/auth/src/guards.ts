import type { AppCapability, AppRole } from "./roles";
import { getCapabilitiesForRoles } from "./roles";

export function hasRole(userRoles: AppRole[], expectedRole: AppRole) {
  return userRoles.includes(expectedRole);
}

export function canApproveSnapshots(userRoles: AppRole[]) {
  return hasRole(userRoles, "admin") || hasRole(userRoles, "founder");
}

export function hasCapability(userCapabilities: AppCapability[], expectedCapability: AppCapability) {
  return userCapabilities.includes(expectedCapability);
}

export function hasAnyCapability(
  userCapabilities: AppCapability[],
  expectedCapabilities: AppCapability[]
) {
  return expectedCapabilities.some((capability) => hasCapability(userCapabilities, capability));
}

export function getCapabilitiesFromRoles(userRoles: AppRole[]) {
  return getCapabilitiesForRoles(userRoles);
}
