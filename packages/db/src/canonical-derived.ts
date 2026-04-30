import { Prisma } from "@prisma/client";
import type {
  CanonicalBusinessEvent,
  CanonicalQualificationStatusHistory,
  CanonicalSnapshotPayload,
  CanonicalSourceSystem
} from "@bgc-alpha/schemas";

import type {
  SnapshotMemberMonthFactInput,
  SnapshotPoolPeriodFactInput,
  SnapshotRewardSourcePeriodFactInput
} from "./snapshots";

type BuildDerivedSnapshotDataOptions = {
  snapshotDateFrom: Date;
  snapshotDateTo: Date;
};

type WorkingRow = SnapshotMemberMonthFactInput & {
  metadata: Record<string, unknown>;
};

type RewardSourceAccumulator = {
  periodKey: string;
  sourceSystem: "BGC" | "IBLOOMING";
  rewardSourceCode: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  amount: number;
  obligationCount: number;
  beneficiaryKeys: Set<string>;
};

type PoolAccumulator = {
  periodKey: string;
  poolCode: string;
  distributionCycle: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  fundingAmount: number;
  distributionAmount: number;
  recipientKeys: Set<string>;
  shareCountTotal: number;
  fundingEntryCount: number;
  distributionEntryCount: number;
};

type DerivedRewardEntry = {
  periodKey: string;
  memberKey: string;
  sourceSystem: "BGC" | "IBLOOMING";
  rewardSourceCode: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  amount: number;
};

type DerivedPoolEntry = {
  periodKey: string;
  poolCode: string;
  distributionCycle: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  fundingAmount: number;
  distributionAmount: number;
  recipientKey: string | null;
  shareCount: number;
};

type DerivedSnapshotData = {
  memberMonthFacts: SnapshotMemberMonthFactInput[];
  rewardSourcePeriodFacts: SnapshotRewardSourcePeriodFactInput[];
  poolPeriodFacts: SnapshotPoolPeriodFactInput[];
};

const DIRECT_REWARD_SOURCES = new Set([
  "BGC_RR",
  "BGC_GR",
  "BGC_MIRACLE_CASH",
  "IB_LR",
  "IB_MIRACLE_CASH",
  "IB_CPR",
  "IB_GRR",
  "IB_IRR"
]);

const POOL_DISTRIBUTION_ENTRY_TYPES = new Set(["DISTRIBUTION", "ALLOCATION"]);
const REVENUE_EVENT_TYPES = new Set([
  "AFFILIATE_JOINED",
  "AFFILIATE_UPGRADED",
  "PHYSICAL_PRODUCT_PURCHASED",
  "CP_PRODUCT_SOLD",
  "GIM_SIGNUP_COMPLETED",
  "IMATRIX_PURCHASE_COMPLETED"
]);
const SINK_DEFAULT_EVENT_TYPES = new Set([
  "PHYSICAL_PRODUCT_PURCHASED",
  "CP_PRODUCT_SOLD",
  "GIM_SIGNUP_COMPLETED",
  "IMATRIX_PURCHASE_COMPLETED"
]);

const BGC_TIER_RULES = {
  PATHFINDER: {
    entryFeeUsd: 100,
    pcVolume: 10_000,
    spRewardBasis: 70,
    rrTier1Pct: 0.1,
    grTier2Pct: 0,
    grTier3Pct: 0
  },
  VOYAGER: {
    entryFeeUsd: 500,
    pcVolume: 50_000,
    spRewardBasis: 350,
    rrTier1Pct: 0.1,
    grTier2Pct: 0.13,
    grTier3Pct: 0.16
  },
  EXPLORER: {
    entryFeeUsd: 1_725,
    pcVolume: 172_500,
    spRewardBasis: 1_207,
    rrTier1Pct: 0.12,
    grTier2Pct: 0.14,
    grTier3Pct: 0.17
  },
  PIONEER: {
    entryFeeUsd: 2_875,
    pcVolume: 287_500,
    spRewardBasis: 2_012,
    rrTier1Pct: 0.15,
    grTier2Pct: 0.15,
    grTier3Pct: 0.18
  },
  SPECIAL: {
    entryFeeUsd: 11_500,
    pcVolume: 1_150_000,
    spRewardBasis: 8_050,
    rrTier1Pct: 0.15,
    grTier2Pct: 0.15,
    grTier3Pct: 0.18
  }
} as const;

const BGC_TIER_BY_ENTRY_FEE: Map<number, keyof typeof BGC_TIER_RULES> = new Map(
  (Object.entries(BGC_TIER_RULES) as Array<[keyof typeof BGC_TIER_RULES, (typeof BGC_TIER_RULES)[keyof typeof BGC_TIER_RULES]]>).map(
    ([tierCode, rule]) => [rule.entryFeeUsd, tierCode] as const
  )
);

const IB_GRR_RATES = {
  1: 3,
  2: 0.8
} as const;

const IB_IRR_RATES: Record<string, Record<1 | 2, number>> = {
  FOUNDATION: { 1: 0.6, 2: 0.25 },
  PRO: { 1: 5, 2: 2.5 },
  EXPERT: { 1: 12, 2: 5 }
};

function toCompatibilityDirectRewardUsdEquivalent(
  rewardSourceCode: string,
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE",
  amount: number
) {
  if (!DIRECT_REWARD_SOURCES.has(rewardSourceCode)) {
    return null;
  }

  if (unit === "USD") {
    return amount;
  }

  // BGC direct rewards are natively SP-based in the understanding doc.
  // The compatibility member-month view keeps one flattened globalRewardUsd
  // column, so SP rewards are represented as USD-equivalent because
  // 1 SP = $1 for reward calculations.
  if (rewardSourceCode.startsWith("BGC_") && unit === "SP") {
    return amount;
  }

  return null;
}

function roundMetric(value: number) {
  return Number(value.toFixed(8));
}

function toInputJsonValue(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | null {
  return (value ?? null) as Prisma.InputJsonValue | null;
}

function formatPeriodKey(year: number, month: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function parsePeriodKey(periodKey: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);

  if (!match) {
    throw new Error(`Invalid canonical period key: ${periodKey}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2])
  };
}

function buildPeriodStart(periodKey: string) {
  const parsed = parsePeriodKey(periodKey);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
}

function buildPeriodEnd(periodKey: string) {
  const parsed = parsePeriodKey(periodKey);
  return new Date(Date.UTC(parsed.year, parsed.month, 0, 23, 59, 59, 999));
}

function normalizeDateToPeriodKey(value: Date) {
  return formatPeriodKey(value.getUTCFullYear(), value.getUTCMonth() + 1);
}

function listPeriodKeysBetween(start: Date, end: Date) {
  const periods: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= endCursor) {
    periods.push(normalizeDateToPeriodKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }

  return periods;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMetadataRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function readMetadataString(metadata: unknown, ...keys: string[]) {
  const record = readMetadataRecord(metadata);

  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readMetadataNumber(metadata: unknown, ...keys: string[]) {
  const record = readMetadataRecord(metadata);

  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function readNestedMetadataNumber(metadata: unknown, recordKey: string, ...keys: string[]) {
  return readMetadataNumber(readMetadataRecord(metadata)?.[recordKey], ...keys);
}

function resolveBcgTierFromEvent(event: CanonicalBusinessEvent) {
  const metadataTier = readMetadataString(event.metadata, "member_tier", "memberTier", "origin_join_level");
  const normalizedTier = metadataTier?.toUpperCase();

  if (normalizedTier && normalizedTier in BGC_TIER_RULES) {
    return normalizedTier as keyof typeof BGC_TIER_RULES;
  }

  const entryFeeUsd =
    readNestedMetadataNumber(event.metadata, "recognized_revenue_basis", "entry_fee_usd", "entryFeeUsd") ??
    readMetadataNumber(event.metadata, "entry_fee_usd", "entryFeeUsd");

  return entryFeeUsd !== null
    ? (BGC_TIER_BY_ENTRY_FEE.get(entryFeeUsd) as keyof typeof BGC_TIER_RULES | undefined) ?? null
    : null;
}

function hasExplicitSourceEntry(sourceEventRef: string, sourceRefs: Set<string>) {
  return sourceRefs.has(sourceEventRef);
}

function lowerFactSourceSystem(sourceSystem: CanonicalSourceSystem) {
  return sourceSystem.toLowerCase();
}

function readMetadataSourceSystem(metadata: unknown) {
  const sourceSystem = readMetadataString(metadata, "source_system", "sourceSystem");

  if (!sourceSystem) {
    return null;
  }

  const normalized = sourceSystem.toUpperCase();

  if (normalized === "BGC" || normalized === "IBLOOMING") {
    return normalized as CanonicalSourceSystem;
  }

  return null;
}

function rewardSourceSystem(rewardSourceCode: string): "BGC" | "IBLOOMING" {
  return rewardSourceCode.startsWith("IB_") ? "IBLOOMING" : "BGC";
}

function poolSourceSystem(poolCode: string): "BGC" | "IBLOOMING" {
  return poolCode.startsWith("IB_") ? "IBLOOMING" : "BGC";
}

function defaultSystemsForRole(roleType: string): CanonicalSourceSystem[] {
  switch (roleType) {
    case "AFFILIATE_LEVEL":
    case "WEC_STATUS":
      return ["BGC"];
    case "CP_STATUS":
    case "EXECUTIVE_CP_STATUS":
      return ["IBLOOMING"];
    case "CROSS_APP_STATUS":
      return ["BGC", "IBLOOMING"];
    default:
      return [];
  }
}

function buildRowKey(periodKey: string, memberKey: string, sourceSystem: string) {
  return `${periodKey}::${memberKey}::${sourceSystem}`;
}

function buildMemberSystemKey(memberKey: string, sourceSystem: CanonicalSourceSystem) {
  return `${memberKey}::${sourceSystem}`;
}

function addBreakdownValue(
  metadata: Record<string, unknown>,
  fieldKey: string,
  breakdownKey: string,
  value: number
) {
  if (!Number.isFinite(value) || value === 0) {
    return;
  }

  const existing = readMetadataRecord(metadata[fieldKey]) ?? {};
  const current = typeof existing[breakdownKey] === "number" ? Number(existing[breakdownKey]) : 0;

  metadata[fieldKey] = {
    ...existing,
    [breakdownKey]: roundMetric(current + value)
  };
}

function addCounterValue(
  metadata: Record<string, unknown>,
  fieldKey: string,
  counterKey: string,
  value = 1
) {
  if (!Number.isFinite(value) || value === 0) {
    return;
  }

  const existing = readMetadataRecord(metadata[fieldKey]) ?? {};
  const current = typeof existing[counterKey] === "number" ? Number(existing[counterKey]) : 0;

  metadata[fieldKey] = {
    ...existing,
    [counterKey]: roundMetric(current + value)
  };
}

function upsertMetadataObject(
  metadata: Record<string, unknown>,
  fieldKey: string,
  objectKey: string,
  value: Record<string, unknown>
) {
  const existing = readMetadataRecord(metadata[fieldKey]) ?? {};
  const current = readMetadataRecord(existing[objectKey]) ?? {};

  metadata[fieldKey] = {
    ...existing,
    [objectKey]: {
      ...current,
      ...value
    }
  };
}

function addUniqueMetadataValue(
  metadata: Record<string, unknown>,
  fieldKey: string,
  value: string
) {
  const existing = Array.isArray(metadata[fieldKey])
    ? metadata[fieldKey].filter((item): item is string => typeof item === "string")
    : [];

  if (!existing.includes(value)) {
    metadata[fieldKey] = [...existing, value];
  }
}

function mergeCompatibilityMetadataValue(
  metadata: Record<string, unknown>,
  fieldKey: string,
  value: unknown
) {
  if (typeof value === "undefined" || value === null || value === "") {
    return;
  }

  const existing = metadata[fieldKey];

  if (isRecord(value) && isRecord(existing)) {
    metadata[fieldKey] = {
      ...existing,
      ...value
    };
    return;
  }

  if (Array.isArray(value) && Array.isArray(existing)) {
    const nextValues = value.filter((item): item is string => typeof item === "string");
    const existingValues = existing.filter((item): item is string => typeof item === "string");
    metadata[fieldKey] = [...new Set([...existingValues, ...nextValues])];
    return;
  }

  metadata[fieldKey] = value;
}

function copyCompatibilityMetadataFields(
  metadata: Record<string, unknown>,
  sourceMetadata: unknown
) {
  const source = readMetadataRecord(sourceMetadata);

  if (!source) {
    return;
  }

  const fieldAliases = [
    ["aggregate_row", "aggregateRow"],
    ["source_categories", "sourceCategories"],
    ["row_semantics", "rowSemantics"],
    ["source_of_truth_reference", "sourceOfTruthReference"],
    ["recognized_revenue_basis", "recognizedRevenueBasis"],
    ["gross_margin_basis", "grossMarginBasis"],
    ["accountability_checks", "accountabilityChecks"],
    ["global_reward_breakdown_usd", "globalRewardBreakdownUsd"],
    ["pool_reward_breakdown_usd", "poolRewardBreakdownUsd"],
    ["sink_breakdown_usd", "sinkBreakdownUsd"],
    ["pool_funding_basis", "poolFundingBasis"],
    ["pool_share_snapshot", "poolShareSnapshot"],
    ["cash_in_usd", "cashInUsd"],
    ["internal_credit_spent_usd", "internalCreditSpentUsd"],
    ["payment_method", "paymentMethod"],
    ["product_fulfillment_out_usd", "productFulfillmentOutUsd"]
  ] as const;

  for (const [fieldKey, aliasKey] of fieldAliases) {
    const value = source[fieldKey] ?? source[aliasKey];
    mergeCompatibilityMetadataValue(metadata, fieldKey, value);
  }
}

function applyRewardCountMetadata(
  metadata: Record<string, unknown>,
  rewardSourceCode: string,
  rewardMetadata: unknown
) {
  if (rewardSourceCode === "BGC_RR") {
    const joinLevel = readMetadataString(rewardMetadata, "origin_join_level", "join_level");

    if (joinLevel) {
      addCounterValue(metadata, "joinCountsByLevel", `RR_${joinLevel}`);
    }
  }

  if (rewardSourceCode === "BGC_GR") {
    const joinLevel = readMetadataString(rewardMetadata, "origin_join_level", "join_level");
    const tier = readMetadataNumber(rewardMetadata, "tier");

    if (joinLevel && (tier === 2 || tier === 3)) {
      addCounterValue(metadata, "joinCountsByLevel", `GR_TIER_${tier}_${joinLevel}`);
    }
  }

  if (rewardSourceCode === "IB_GRR") {
    const tier = readMetadataNumber(rewardMetadata, "tier");

    if (tier === 1 || tier === 2) {
      addCounterValue(metadata, "eventCounts", `GIM_SIGNUP_TIER_${tier}`);
    }
  }

  if (rewardSourceCode === "IB_IRR") {
    const tier = readMetadataNumber(rewardMetadata, "tier");
    const planCode = readMetadataString(rewardMetadata, "imatrix_plan");

    if ((tier === 1 || tier === 2) && planCode) {
      addCounterValue(metadata, "planCounts", `${planCode.toUpperCase()}_TIER_${tier}`);
    }
  }

  if (rewardSourceCode === "BGC_MIRACLE_CASH") {
    addCounterValue(metadata, "eventCounts", "BGC_MIRACLE_CASH_EVENTS");
  }

  if (rewardSourceCode === "IB_MIRACLE_CASH") {
    addCounterValue(metadata, "eventCounts", "IB_MIRACLE_CASH_EVENTS");
  }
}

function applyPoolDistributionMetadata(
  metadata: Record<string, unknown>,
  poolCode: string,
  poolMetadata: unknown,
  distributionCycle: string,
  unit: string,
  shareCount: number | null,
  eligibilitySnapshotKey: string | null
) {
  const recipientCount = readMetadataNumber(poolMetadata, "recipient_count");
  const shareTotal = readMetadataNumber(poolMetadata, "share_total");

  upsertMetadataObject(metadata, "poolShareSnapshot", poolCode, {
    distribution_cycle: distributionCycle,
    unit,
    distribution_mode:
      poolCode === "IB_GPS_SEMIANNUAL_POOL" ? "WEIGHTED_SHARE" : "EQUAL_SHARE",
    recipient_count: recipientCount,
    share_count_total: shareTotal ?? (typeof shareCount === "number" ? shareCount : null),
    recipient_share_count: typeof shareCount === "number" ? shareCount : 0,
    eligibility_snapshot_key: eligibilitySnapshotKey
  });
}

function applyCashoutMetadata(
  metadata: Record<string, unknown>,
  cashoutMetadata: unknown,
  amountUsd: number
) {
  const breakdownKey =
    readMetadataString(cashoutMetadata, "breakdown_key", "scenario_code", "cashout_type") ??
    "CASHOUT";

  addBreakdownValue(metadata, "cashoutBreakdownUsd", breakdownKey, amountUsd);

  const scenarioCode = readMetadataString(cashoutMetadata, "scenario_code");
  if (scenarioCode) {
    addUniqueMetadataValue(metadata, "cashoutScenarioCodes", scenarioCode);
  }

  const policyGroup = readMetadataString(cashoutMetadata, "policy_group");
  if (policyGroup) {
    addUniqueMetadataValue(metadata, "cashoutPolicyGroups", policyGroup);
  }

  const cashoutMetadataRecord = readMetadataRecord(cashoutMetadata);
  const scenarioRecord = readMetadataRecord(cashoutMetadataRecord?.cashout_scenario);
  if (scenarioRecord) {
    metadata.cashoutScenario = {
      ...(readMetadataRecord(metadata.cashoutScenario) ?? {}),
      ...scenarioRecord
    };
  }

  const basisRecord = readMetadataRecord(cashoutMetadataRecord?.cashout_basis);
  if (basisRecord) {
    metadata.cashoutBasis = {
      ...(readMetadataRecord(metadata.cashoutBasis) ?? {}),
      ...basisRecord
    };
  }
}

function resolveEventOfferCodeSet(payload: CanonicalSnapshotPayload) {
  return new Set(
    payload.pc_entries
      .map((entry) => entry.source_event_ref)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
}

function resolveEventSourceSystem(
  sourceEventRef: string | null | undefined,
  eventMap: Map<string, CanonicalBusinessEvent>,
  fallbackSystem: CanonicalSourceSystem | null
) {
  if (sourceEventRef) {
    const sourceEvent = eventMap.get(sourceEventRef);

    if (sourceEvent) {
      return sourceEvent.source_system;
    }
  }

  return fallbackSystem;
}

function resolveCashoutSourceSystem(
  cashoutMetadata: unknown,
  sourceEventRef: string | null | undefined,
  eventMap: Map<string, CanonicalBusinessEvent>,
  fallbackSystem: CanonicalSourceSystem | null
) {
  return (
    readMetadataSourceSystem(cashoutMetadata) ??
    resolveEventSourceSystem(sourceEventRef, eventMap, fallbackSystem)
  );
}

function resolveMemberSystems(payload: CanonicalSnapshotPayload) {
  const memberSystems = new Map<string, Set<CanonicalSourceSystem>>();
  const remember = (memberKey: string | null | undefined, sourceSystem: CanonicalSourceSystem | null) => {
    if (!memberKey || !sourceSystem) {
      return;
    }

    const current = memberSystems.get(memberKey) ?? new Set<CanonicalSourceSystem>();
    current.add(sourceSystem);
    memberSystems.set(memberKey, current);
  };

  for (const alias of payload.member_aliases) {
    remember(alias.member_stable_key, alias.source_system);
  }

  for (const role of payload.role_history) {
    const roleSystems =
      role.source_system != null ? [role.source_system] : defaultSystemsForRole(role.role_type);

    for (const sourceSystem of roleSystems) {
      remember(role.member_stable_key, sourceSystem);
    }
  }

  for (const event of payload.business_events) {
    remember(event.actor_member_stable_key, event.source_system);
    remember(event.beneficiary_member_stable_key, event.source_system);
    remember(event.related_member_stable_key, event.source_system);
  }

  for (const reward of payload.reward_obligations) {
    remember(reward.member_stable_key, rewardSourceSystem(reward.reward_source_code));
  }

  for (const pool of payload.pool_entries) {
    remember(pool.recipient_member_stable_key, poolSourceSystem(pool.pool_code));
  }

  return memberSystems;
}

function ensureWorkingRow(
  rows: Map<string, WorkingRow>,
  periodKey: string,
  memberKey: string,
  sourceSystem: CanonicalSourceSystem,
  groupKey: string | null
) {
  const factSourceSystem = lowerFactSourceSystem(sourceSystem);
  const rowKey = buildRowKey(periodKey, memberKey, factSourceSystem);

  if (!rows.has(rowKey)) {
    rows.set(rowKey, {
      periodKey,
      memberKey,
      sourceSystem: factSourceSystem,
      memberTier: null,
      groupKey,
      pcVolume: 0,
      spRewardBasis: 0,
      globalRewardUsd: 0,
      poolRewardUsd: 0,
      cashoutUsd: 0,
      sinkSpendUsd: 0,
      activeMember: false,
      metadataJson: null,
      metadata: {}
    });
  }

  return rows.get(rowKey)!;
}

function resolveGroupKey(memberMetadata: unknown) {
  return readMetadataString(memberMetadata, "group_key", "groupKey");
}

function resolveJoinPeriod(
  memberKey: string,
  sourceSystem: CanonicalSourceSystem,
  payload: CanonicalSnapshotPayload
) {
  const periods: string[] = [];

  for (const role of payload.role_history) {
    const roleSystems =
      role.source_system != null ? [role.source_system] : defaultSystemsForRole(role.role_type);

    if (role.member_stable_key === memberKey && roleSystems.includes(sourceSystem)) {
      periods.push(normalizeDateToPeriodKey(new Date(role.effective_from)));
    }
  }

  for (const event of payload.business_events) {
    if (
      event.source_system === sourceSystem &&
      [
        event.actor_member_stable_key,
        event.beneficiary_member_stable_key,
        event.related_member_stable_key
      ].includes(memberKey)
    ) {
      periods.push(event.effective_period);
    }
  }

  return periods.sort()[0] ?? null;
}

function resolveActiveRolesForPeriod(
  payload: CanonicalSnapshotPayload,
  memberKey: string,
  sourceSystem: CanonicalSourceSystem,
  periodKey: string
) {
  const periodStart = buildPeriodStart(periodKey);
  const periodEnd = buildPeriodEnd(periodKey);

  return payload.role_history.filter((role) => {
    if (role.member_stable_key !== memberKey) {
      return false;
    }

    const roleSystems =
      role.source_system != null ? [role.source_system] : defaultSystemsForRole(role.role_type);

    if (!roleSystems.includes(sourceSystem)) {
      return false;
    }

    const effectiveFrom = new Date(role.effective_from);
    const effectiveTo = role.effective_to ? new Date(role.effective_to) : null;

    return effectiveFrom <= periodEnd && (effectiveTo === null || effectiveTo >= periodStart);
  });
}

function resolveMemberTier(activeRoles: ReturnType<typeof resolveActiveRolesForPeriod>) {
  const prioritizedRoleTypes = [
    "AFFILIATE_LEVEL",
    "CP_STATUS",
    "EXECUTIVE_CP_STATUS",
    "WEC_STATUS",
    "CROSS_APP_STATUS"
  ];

  const sorted = [...activeRoles].sort((left, right) => {
    const leftPriority = prioritizedRoleTypes.indexOf(left.role_type);
    const rightPriority = prioritizedRoleTypes.indexOf(right.role_type);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return new Date(right.effective_from).getTime() - new Date(left.effective_from).getTime();
  });

  return sorted[0]?.role_value ?? null;
}

function resolveActiveQualificationsForPeriod(
  qualificationStatusHistory: CanonicalQualificationStatusHistory[],
  memberKey: string,
  periodKey: string
) {
  const periodStart = buildPeriodStart(periodKey);
  const periodEnd = buildPeriodEnd(periodKey);

  return qualificationStatusHistory
    .filter((status) => {
      if (status.member_stable_key !== memberKey) {
        return false;
      }

      const effectiveFrom = new Date(status.effective_from);
      const effectiveTo = status.effective_to ? new Date(status.effective_to) : null;

      return effectiveFrom <= periodEnd && (effectiveTo === null || effectiveTo >= periodStart);
    })
    .map((status) => `${status.qualification_type}:${status.status}`);
}

function addActivityPeriodsFromRoleHistories(
  payload: CanonicalSnapshotPayload,
  rowKeys: Set<string>,
  memberMetadata: Map<string, unknown>,
  rows: Map<string, WorkingRow>,
  options: BuildDerivedSnapshotDataOptions
) {
  for (const role of payload.role_history) {
    const roleSystems =
      role.source_system != null ? [role.source_system] : defaultSystemsForRole(role.role_type);
    const roleStart = new Date(role.effective_from);
    const roleEnd = role.effective_to ? new Date(role.effective_to) : options.snapshotDateTo;
    const boundedStart = roleStart > options.snapshotDateFrom ? roleStart : options.snapshotDateFrom;
    const boundedEnd = roleEnd < options.snapshotDateTo ? roleEnd : options.snapshotDateTo;

    if (boundedStart > boundedEnd) {
      continue;
    }

    for (const periodKey of listPeriodKeysBetween(boundedStart, boundedEnd)) {
      for (const sourceSystem of roleSystems) {
        const groupKey = resolveGroupKey(memberMetadata.get(role.member_stable_key));
        const row = ensureWorkingRow(rows, periodKey, role.member_stable_key, sourceSystem, groupKey);
        row.activeMember = true;
        rowKeys.add(buildMemberSystemKey(role.member_stable_key, sourceSystem));
      }
    }
  }
}

export function buildDerivedSnapshotDataFromCanonical(
  payload: CanonicalSnapshotPayload,
  options: BuildDerivedSnapshotDataOptions
): DerivedSnapshotData {
  const memberSystems = resolveMemberSystems(payload);
  const eventMap = new Map(payload.business_events.map((event) => [event.event_ref, event]));
  const memberMetadata = new Map(payload.members.map((member) => [member.stable_key, member.metadata]));
  const rows = new Map<string, WorkingRow>();
  const memberSystemKeys = new Set<string>();
  const eventRefsWithPcSpend = resolveEventOfferCodeSet(payload);
  const eventRefsWithSpEntry = new Set(
    payload.sp_entries
      .map((entry) => entry.source_event_ref)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const explicitRewardKeys = new Set(
    payload.reward_obligations
      .filter((entry) => entry.source_event_ref)
      .map((entry) => `${entry.source_event_ref}::${entry.reward_source_code}`)
  );
  const explicitPoolFundingKeys = new Set(
    payload.pool_entries
      .filter((entry) => entry.source_event_ref && entry.entry_type === "FUNDING")
      .map((entry) => `${entry.source_event_ref}::${entry.pool_code}`)
  );
  const derivedRewardEntries: DerivedRewardEntry[] = [];
  const derivedPoolEntries: DerivedPoolEntry[] = [];
  const paidCashoutKeys = new Set<string>();

  addActivityPeriodsFromRoleHistories(payload, memberSystemKeys, memberMetadata, rows, options);

  for (const event of payload.business_events) {
    const actorKey =
      event.actor_member_stable_key ??
      event.beneficiary_member_stable_key ??
      event.related_member_stable_key ??
      null;

    if (!actorKey) {
      continue;
    }

    const row = ensureWorkingRow(
      rows,
      event.effective_period,
      actorKey,
      event.source_system,
      resolveGroupKey(memberMetadata.get(actorKey))
    );
    row.activeMember = true;
    memberSystemKeys.add(buildMemberSystemKey(actorKey, event.source_system));
    copyCompatibilityMetadataFields(row.metadata, event.metadata);

    if (REVENUE_EVENT_TYPES.has(event.event_type)) {
      const recognizedRevenueUsd =
        readMetadataNumber(event.metadata, "recognized_revenue_usd", "recognizedRevenueUsd") ??
        (event.unit === "USD" && typeof event.amount === "number" ? event.amount : 0);
      const grossMarginUsd =
        readMetadataNumber(event.metadata, "gross_margin_usd", "grossMarginUsd") ?? 0;

      if (recognizedRevenueUsd > 0) {
        row.metadata.recognizedRevenueUsd = roundMetric(
          (typeof row.metadata.recognizedRevenueUsd === "number"
            ? row.metadata.recognizedRevenueUsd
            : 0) + recognizedRevenueUsd
        );
      }

      if (grossMarginUsd > 0) {
        row.metadata.grossMarginUsd = roundMetric(
          (typeof row.metadata.grossMarginUsd === "number" ? row.metadata.grossMarginUsd : 0) +
            grossMarginUsd
        );
      }
    }

    const explicitSinkSpendUsd =
      readMetadataNumber(event.metadata, "sink_spend_usd", "sinkSpendUsd") ?? null;
    const explicitInternalCreditSpentUsd =
      readMetadataNumber(event.metadata, "internal_credit_spent_usd", "internalCreditSpentUsd") ?? null;
    const defaultSinkSpendUsd =
      explicitSinkSpendUsd ??
      explicitInternalCreditSpentUsd ??
      (SINK_DEFAULT_EVENT_TYPES.has(event.event_type) &&
      event.unit === "USD" &&
      typeof event.amount === "number" &&
      !eventRefsWithPcSpend.has(event.event_ref)
        ? event.amount
        : 0);

    if (defaultSinkSpendUsd > 0) {
      row.sinkSpendUsd = roundMetric(row.sinkSpendUsd + defaultSinkSpendUsd);
      addBreakdownValue(row.metadata, "sinkBreakdownUsd", event.event_type, defaultSinkSpendUsd);
    }

    const addDerivedReward = (
      rewardSourceCode: string,
      rewardMemberKey: string | null | undefined,
      amount: number,
      metadata: Record<string, unknown> = {}
    ) => {
      if (!rewardMemberKey || !(amount > 0)) {
        return;
      }

      if (explicitRewardKeys.has(`${event.event_ref}::${rewardSourceCode}`)) {
        return;
      }

      const rewardSource = rewardSourceSystem(rewardSourceCode);
      const rewardRow = ensureWorkingRow(
        rows,
        event.effective_period,
        rewardMemberKey,
        rewardSource,
        resolveGroupKey(memberMetadata.get(rewardMemberKey))
      );
      rewardRow.activeMember = true;
      memberSystemKeys.add(buildMemberSystemKey(rewardMemberKey, rewardSource));
      rewardRow.globalRewardUsd = roundMetric(rewardRow.globalRewardUsd + amount);
      addBreakdownValue(rewardRow.metadata, "globalRewardBreakdownUsd", rewardSourceCode, amount);
      applyRewardCountMetadata(rewardRow.metadata, rewardSourceCode, metadata);
      derivedRewardEntries.push({
        periodKey: event.effective_period,
        memberKey: rewardMemberKey,
        sourceSystem: rewardSource,
        rewardSourceCode,
        unit: "USD",
        amount: roundMetric(amount)
      });
    };

    const addDerivedPoolFunding = (
      poolCode: string,
      amount: number,
      distributionCycle = "MONTHLY",
      distributionAmount = 0
    ) => {
      if (!(amount > 0) || explicitPoolFundingKeys.has(`${event.event_ref}::${poolCode}`)) {
        return;
      }

      derivedPoolEntries.push({
        periodKey: event.effective_period,
        poolCode,
        distributionCycle,
        unit: "USD",
        fundingAmount: roundMetric(amount),
        distributionAmount: roundMetric(distributionAmount),
        recipientKey: null,
        shareCount: 0
      });
    };

    if (event.source_system === "BGC" && ["AFFILIATE_JOINED", "AFFILIATE_UPGRADED"].includes(event.event_type)) {
      const tier = resolveBcgTierFromEvent(event);

      if (tier) {
        const rule = BGC_TIER_RULES[tier];

        if (!hasExplicitSourceEntry(event.event_ref, eventRefsWithPcSpend)) {
          row.pcVolume = roundMetric(row.pcVolume + rule.pcVolume);
          addBreakdownValue(row.metadata, "pcBreakdown", "CALCULATED_BGC_ENTRY", rule.pcVolume);
        }

        if (!hasExplicitSourceEntry(event.event_ref, eventRefsWithSpEntry)) {
          row.spRewardBasis = roundMetric(row.spRewardBasis + rule.spRewardBasis);
          addBreakdownValue(row.metadata, "spBreakdown", "CALCULATED_BGC_LTS", rule.spRewardBasis);
        }

        const rewardRecipient =
          event.beneficiary_member_stable_key ??
          event.related_member_stable_key ??
          event.actor_member_stable_key;
        addDerivedReward("BGC_RR", rewardRecipient, rule.spRewardBasis * rule.rrTier1Pct, {
          origin_join_level: tier
        });

        const bgcMiracleCashUsd = readMetadataNumber(
          event.metadata,
          "bgc_miracle_cash_usd",
          "miracle_cash_usd",
          "miracleCashUsd"
        );
        if (bgcMiracleCashUsd !== null) {
          addDerivedReward("BGC_MIRACLE_CASH", rewardRecipient, bgcMiracleCashUsd);
        }

        addDerivedPoolFunding("BGC_GPSP_MONTHLY_POOL", rule.spRewardBasis * 0.15, "MONTHLY");
        addDerivedPoolFunding("BGC_WEC_QUARTERLY_POOL", rule.spRewardBasis * 0.03, "QUARTERLY");
      }
    }

    if (
      event.source_system === "IBLOOMING" &&
      ["CP_PRODUCT_SOLD", "GIM_SIGNUP_COMPLETED", "IMATRIX_PURCHASE_COMPLETED"].includes(event.event_type)
    ) {
      const recognizedRevenueBasis = readMetadataRecord(
        readMetadataRecord(event.metadata)?.recognized_revenue_basis ??
          readMetadataRecord(event.metadata)?.recognizedRevenueBasis
      );
      const platformRevenueUsd =
        readMetadataNumber(recognizedRevenueBasis, "ib_platform_revenue_usd", "ibPlatformRevenueUsd") ??
        readMetadataNumber(event.metadata, "ib_platform_revenue_usd", "ibPlatformRevenueUsd") ??
        0;
      const rewardRecipient =
        event.beneficiary_member_stable_key ??
        event.related_member_stable_key ??
        event.actor_member_stable_key;

      if (event.event_type === "CP_PRODUCT_SOLD") {
        addDerivedReward("IB_LR", rewardRecipient, platformRevenueUsd * 0.1);
      }

      addDerivedReward("IB_MIRACLE_CASH", rewardRecipient, platformRevenueUsd * 0.01);

      const cprYear = readMetadataNumber(event.metadata, "cpr_year", "cprYear");
      if (cprYear === 1 || cprYear === 2) {
        addDerivedReward("IB_CPR", rewardRecipient, platformRevenueUsd * (cprYear === 1 ? 0.05 : 0.025), {
          cpr_year: cprYear
        });
      }

      const tier = readMetadataNumber(event.metadata, "tier", "reward_tier", "rewardTier");
      const quantity = typeof event.quantity === "number" && event.quantity > 0 ? event.quantity : 1;

      if (event.event_type === "GIM_SIGNUP_COMPLETED" && (tier === 1 || tier === 2)) {
        addDerivedReward("IB_GRR", rewardRecipient, quantity * IB_GRR_RATES[tier], { tier });
      }

      if (event.event_type === "IMATRIX_PURCHASE_COMPLETED" && (tier === 1 || tier === 2)) {
        const plan = readMetadataString(event.metadata, "imatrix_plan", "plan")?.toUpperCase();
        const rate = plan ? IB_IRR_RATES[plan]?.[tier] : null;

        if (rate) {
          addDerivedReward("IB_IRR", rewardRecipient, quantity * rate, {
            tier,
            imatrix_plan: plan
          });
        }
      }
    }

    const poolFundingBasis = readMetadataRecord(
      readMetadataRecord(event.metadata)?.pool_funding_basis ??
        readMetadataRecord(event.metadata)?.poolFundingBasis
    );

    if (poolFundingBasis) {
      for (const [poolCode, poolValue] of Object.entries(poolFundingBasis)) {
        const poolRecord = readMetadataRecord(poolValue);

        if (!poolRecord) {
          continue;
        }

        const fundingAmount = readMetadataNumber(poolRecord, "funding_amount", "fundingAmount") ?? 0;
        const distributionAmount =
          readMetadataNumber(poolRecord, "distribution_amount", "distributionAmount") ?? 0;
        const distributionCycle =
          readMetadataString(poolRecord, "distribution_cycle", "distributionCycle") ?? "MONTHLY";

        addDerivedPoolFunding(poolCode, fundingAmount, distributionCycle, distributionAmount);
      }
    }
  }

  for (const entry of payload.pc_entries) {
    const sourceSystem =
      resolveEventSourceSystem(entry.source_event_ref, eventMap, "BGC") ?? "BGC";
    const row = ensureWorkingRow(
      rows,
      entry.effective_period,
      entry.member_stable_key,
      sourceSystem,
      resolveGroupKey(memberMetadata.get(entry.member_stable_key))
    );
    row.activeMember = true;
    memberSystemKeys.add(buildMemberSystemKey(entry.member_stable_key, sourceSystem));
    copyCompatibilityMetadataFields(row.metadata, entry.metadata);

    if (entry.entry_type === "GRANT" || entry.entry_type === "ADJUSTMENT") {
      row.pcVolume = roundMetric(row.pcVolume + entry.amount_pc);
      addBreakdownValue(row.metadata, "pcBreakdown", entry.entry_type, entry.amount_pc);
    }

    if (entry.entry_type === "SPEND") {
      const sinkSpendUsd =
        readMetadataNumber(entry.metadata, "sink_spend_usd", "sinkSpendUsd") ?? entry.amount_pc / 100;
      row.sinkSpendUsd = roundMetric(row.sinkSpendUsd + sinkSpendUsd);
      addBreakdownValue(row.metadata, "sinkBreakdownUsd", "PC_SPEND", sinkSpendUsd);
    }
  }

  for (const entry of payload.sp_entries) {
    const sourceSystem =
      resolveEventSourceSystem(entry.source_event_ref, eventMap, "BGC") ?? "BGC";
    const row = ensureWorkingRow(
      rows,
      entry.effective_period,
      entry.member_stable_key,
      sourceSystem,
      resolveGroupKey(memberMetadata.get(entry.member_stable_key))
    );
    row.activeMember = true;
    memberSystemKeys.add(buildMemberSystemKey(entry.member_stable_key, sourceSystem));
    copyCompatibilityMetadataFields(row.metadata, entry.metadata);

    if (entry.entry_type === "ACCRUAL" || entry.entry_type === "ADJUSTMENT") {
      const breakdownKey =
        sourceSystem === "IBLOOMING"
          ? entry.entry_type === "ADJUSTMENT"
            ? "IB_SALES_POINT_ADJUSTMENT"
            : "IB_SALES_POINT"
          : entry.entry_type;
      row.spRewardBasis = roundMetric(row.spRewardBasis + entry.amount_sp);
      addBreakdownValue(row.metadata, "spBreakdown", breakdownKey, entry.amount_sp);
    }
  }

  for (const reward of payload.reward_obligations) {
    if (reward.obligation_status === "CANCELLED") {
      continue;
    }

    const sourceSystem = rewardSourceSystem(reward.reward_source_code);
    const row = ensureWorkingRow(
      rows,
      reward.effective_period,
      reward.member_stable_key,
      sourceSystem,
      resolveGroupKey(memberMetadata.get(reward.member_stable_key))
    );
    row.activeMember = true;
    memberSystemKeys.add(buildMemberSystemKey(reward.member_stable_key, sourceSystem));
    copyCompatibilityMetadataFields(row.metadata, reward.metadata);

    const compatibilityRewardUsd = toCompatibilityDirectRewardUsdEquivalent(
      reward.reward_source_code,
      reward.unit,
      reward.amount
    );

    if (compatibilityRewardUsd !== null) {
      row.globalRewardUsd = roundMetric(row.globalRewardUsd + compatibilityRewardUsd);
      addBreakdownValue(
        row.metadata,
        "globalRewardBreakdownUsd",
        reward.reward_source_code,
        compatibilityRewardUsd
      );
      applyRewardCountMetadata(row.metadata, reward.reward_source_code, reward.metadata);
    }
  }

  for (const pool of payload.pool_entries) {
    if (!pool.recipient_member_stable_key || !POOL_DISTRIBUTION_ENTRY_TYPES.has(pool.entry_type)) {
      continue;
    }

    const sourceSystem = poolSourceSystem(pool.pool_code);
    const row = ensureWorkingRow(
      rows,
      pool.effective_period,
      pool.recipient_member_stable_key,
      sourceSystem,
      resolveGroupKey(memberMetadata.get(pool.recipient_member_stable_key))
    );
    row.activeMember = true;
    memberSystemKeys.add(buildMemberSystemKey(pool.recipient_member_stable_key, sourceSystem));
    copyCompatibilityMetadataFields(row.metadata, pool.metadata);

    if (pool.unit === "USD") {
      row.poolRewardUsd = roundMetric(row.poolRewardUsd + pool.amount);
      addBreakdownValue(row.metadata, "poolRewardBreakdownUsd", pool.pool_code, pool.amount);
      applyPoolDistributionMetadata(
        row.metadata,
        pool.pool_code,
        pool.metadata,
        pool.distribution_cycle,
        pool.unit,
        typeof pool.share_count === "number" ? pool.share_count : null,
        pool.eligibility_snapshot_key ?? null
      );
    }
  }

  for (const cashout of payload.cashout_events) {
    const sourceSystem =
      resolveCashoutSourceSystem(
        cashout.metadata,
        cashout.source_event_ref,
        eventMap,
        memberSystems.get(cashout.member_stable_key)?.size === 1
          ? [...(memberSystems.get(cashout.member_stable_key) ?? [])][0]
          : null
      ) ?? "BGC";
    const row = ensureWorkingRow(
      rows,
      cashout.effective_period,
      cashout.member_stable_key,
      sourceSystem,
      resolveGroupKey(memberMetadata.get(cashout.member_stable_key))
    );
    row.activeMember = true;
    memberSystemKeys.add(buildMemberSystemKey(cashout.member_stable_key, sourceSystem));
    copyCompatibilityMetadataFields(row.metadata, cashout.metadata);

    const cashoutKey = `${cashout.member_stable_key}::${cashout.effective_period}::${
      cashout.source_event_ref ?? cashout.amount_usd
    }`;

    if (cashout.event_type === "PAID") {
      paidCashoutKeys.add(cashoutKey);
      applyCashoutMetadata(row.metadata, cashout.metadata, cashout.amount_usd);
      row.cashoutUsd = roundMetric(row.cashoutUsd + cashout.amount_usd);
    }
  }

  for (const cashout of payload.cashout_events) {
    if (cashout.event_type !== "APPROVED") {
      continue;
    }

    const cashoutKey = `${cashout.member_stable_key}::${cashout.effective_period}::${
      cashout.source_event_ref ?? cashout.amount_usd
    }`;

    if (paidCashoutKeys.has(cashoutKey)) {
      continue;
    }

    const sourceSystem =
      resolveCashoutSourceSystem(
        cashout.metadata,
        cashout.source_event_ref,
        eventMap,
        memberSystems.get(cashout.member_stable_key)?.size === 1
          ? [...(memberSystems.get(cashout.member_stable_key) ?? [])][0]
          : null
      ) ?? "BGC";
    const row = ensureWorkingRow(
      rows,
      cashout.effective_period,
      cashout.member_stable_key,
      sourceSystem,
      resolveGroupKey(memberMetadata.get(cashout.member_stable_key))
    );
    row.activeMember = true;
    memberSystemKeys.add(buildMemberSystemKey(cashout.member_stable_key, sourceSystem));
    copyCompatibilityMetadataFields(row.metadata, cashout.metadata);
    applyCashoutMetadata(row.metadata, cashout.metadata, cashout.amount_usd);
    row.cashoutUsd = roundMetric(row.cashoutUsd + cashout.amount_usd);
  }

  const memberFacts = [...rows.values()]
    .map((row) => {
      const canonicalSourceSystem = row.sourceSystem === "iblooming" ? "IBLOOMING" : "BGC";
      const activeRoles = resolveActiveRolesForPeriod(
        payload,
        row.memberKey,
        canonicalSourceSystem,
        row.periodKey
      );
      const qualifications = resolveActiveQualificationsForPeriod(
        payload.qualification_status_history,
        row.memberKey,
        row.periodKey
      );
      const memberObservedSystems = memberSystems.get(row.memberKey) ?? new Set<CanonicalSourceSystem>();
      const joinPeriod = resolveJoinPeriod(row.memberKey, canonicalSourceSystem, payload);

      row.memberTier = resolveMemberTier(activeRoles);
      row.groupKey = row.groupKey ?? resolveGroupKey(memberMetadata.get(row.memberKey));
      row.metadata.memberJoinPeriod = joinPeriod;
      row.metadata.isAffiliate = activeRoles.some((role) => role.role_type === "AFFILIATE_LEVEL");
      row.metadata.crossAppActive = memberObservedSystems.size > 1;

      for (const qualification of qualifications) {
        addUniqueMetadataValue(row.metadata, "activeQualifications", qualification);
      }

      for (const role of activeRoles) {
        addUniqueMetadataValue(row.metadata, "activeRoles", `${role.role_type}:${role.role_value}`);
      }

      return {
        ...row,
        metadataJson: toInputJsonValue(Object.keys(row.metadata).length > 0 ? row.metadata : null)
      };
    })
    .sort((left, right) => {
      return (
        left.periodKey.localeCompare(right.periodKey) ||
        left.memberKey.localeCompare(right.memberKey) ||
        left.sourceSystem.localeCompare(right.sourceSystem)
      );
    });

  const rewardSourcePeriodFactsMap = new Map<string, RewardSourceAccumulator>();

  for (const reward of payload.reward_obligations) {
    if (reward.obligation_status === "CANCELLED") {
      continue;
    }

    const sourceSystem = rewardSourceSystem(reward.reward_source_code);
    const accumulatorKey = [
      reward.effective_period,
      sourceSystem,
      reward.reward_source_code,
      reward.unit
    ].join("::");
    const current =
      rewardSourcePeriodFactsMap.get(accumulatorKey) ??
      ({
        periodKey: reward.effective_period,
        sourceSystem,
        rewardSourceCode: reward.reward_source_code,
        unit: reward.unit,
        amount: 0,
        obligationCount: 0,
        beneficiaryKeys: new Set<string>()
      } satisfies RewardSourceAccumulator);

    current.amount += reward.amount;
    current.obligationCount += 1;
    current.beneficiaryKeys.add(reward.member_stable_key);
    rewardSourcePeriodFactsMap.set(accumulatorKey, current);
  }

  for (const reward of derivedRewardEntries) {
    const accumulatorKey = [
      reward.periodKey,
      reward.sourceSystem,
      reward.rewardSourceCode,
      reward.unit
    ].join("::");
    const current =
      rewardSourcePeriodFactsMap.get(accumulatorKey) ??
      ({
        periodKey: reward.periodKey,
        sourceSystem: reward.sourceSystem,
        rewardSourceCode: reward.rewardSourceCode,
        unit: reward.unit,
        amount: 0,
        obligationCount: 0,
        beneficiaryKeys: new Set<string>()
      } satisfies RewardSourceAccumulator);

    current.amount += reward.amount;
    current.obligationCount += 1;
    current.beneficiaryKeys.add(reward.memberKey);
    rewardSourcePeriodFactsMap.set(accumulatorKey, current);
  }

  const rewardSourcePeriodFacts: SnapshotRewardSourcePeriodFactInput[] = [
    ...rewardSourcePeriodFactsMap.values()
  ]
    .map((entry) => ({
      periodKey: entry.periodKey,
      sourceSystem: entry.sourceSystem,
      rewardSourceCode: entry.rewardSourceCode,
      unit: entry.unit,
      amount: roundMetric(entry.amount),
      obligationCount: entry.obligationCount,
      beneficiaryCount: entry.beneficiaryKeys.size,
      metadataJson: null
    }))
    .sort((left, right) => {
      return (
        left.periodKey.localeCompare(right.periodKey) ||
        left.sourceSystem.localeCompare(right.sourceSystem) ||
        left.rewardSourceCode.localeCompare(right.rewardSourceCode)
      );
    });

  const poolPeriodFactsMap = new Map<string, PoolAccumulator>();

  for (const entry of payload.pool_entries) {
    const accumulatorKey = [
      entry.effective_period,
      entry.pool_code,
      entry.distribution_cycle,
      entry.unit
    ].join("::");
    const current =
      poolPeriodFactsMap.get(accumulatorKey) ??
      ({
        periodKey: entry.effective_period,
        poolCode: entry.pool_code,
        distributionCycle: entry.distribution_cycle,
        unit: entry.unit,
        fundingAmount: 0,
        distributionAmount: 0,
        recipientKeys: new Set<string>(),
        shareCountTotal: 0,
        fundingEntryCount: 0,
        distributionEntryCount: 0
      } satisfies PoolAccumulator);

    if (entry.entry_type === "FUNDING") {
      current.fundingAmount += entry.amount;
      current.fundingEntryCount += 1;
    }

    if (POOL_DISTRIBUTION_ENTRY_TYPES.has(entry.entry_type)) {
      current.distributionAmount += entry.amount;
      current.distributionEntryCount += 1;

      if (entry.recipient_member_stable_key) {
        current.recipientKeys.add(entry.recipient_member_stable_key);
      }

      if (typeof entry.share_count === "number") {
        current.shareCountTotal += entry.share_count;
      }
    }

    if (entry.entry_type === "ADJUSTMENT") {
      current.fundingAmount += entry.amount;
      current.fundingEntryCount += 1;
    }

    poolPeriodFactsMap.set(accumulatorKey, current);
  }

  for (const entry of derivedPoolEntries) {
    const accumulatorKey = [
      entry.periodKey,
      entry.poolCode,
      entry.distributionCycle,
      entry.unit
    ].join("::");
    const current =
      poolPeriodFactsMap.get(accumulatorKey) ??
      ({
        periodKey: entry.periodKey,
        poolCode: entry.poolCode,
        distributionCycle: entry.distributionCycle,
        unit: entry.unit,
        fundingAmount: 0,
        distributionAmount: 0,
        recipientKeys: new Set<string>(),
        shareCountTotal: 0,
        fundingEntryCount: 0,
        distributionEntryCount: 0
      } satisfies PoolAccumulator);

    current.fundingAmount += entry.fundingAmount;
    current.fundingEntryCount += 1;
    current.distributionAmount += entry.distributionAmount;

    if (entry.recipientKey) {
      current.recipientKeys.add(entry.recipientKey);
    }

    current.shareCountTotal += entry.shareCount;
    poolPeriodFactsMap.set(accumulatorKey, current);
  }

  const poolPeriodFacts: SnapshotPoolPeriodFactInput[] = [...poolPeriodFactsMap.values()]
    .map((entry) => ({
      periodKey: entry.periodKey,
      poolCode: entry.poolCode,
      distributionCycle: entry.distributionCycle,
      unit: entry.unit,
      fundingAmount: roundMetric(entry.fundingAmount),
      distributionAmount: roundMetric(entry.distributionAmount),
      recipientCount: entry.recipientKeys.size,
      shareCountTotal: roundMetric(entry.shareCountTotal),
      metadataJson: toInputJsonValue({
        fundingEntryCount: entry.fundingEntryCount,
        distributionEntryCount: entry.distributionEntryCount
      })
    }))
    .sort((left, right) => {
      return (
        left.periodKey.localeCompare(right.periodKey) ||
        left.poolCode.localeCompare(right.poolCode) ||
        left.distributionCycle.localeCompare(right.distributionCycle)
      );
    });

  return {
    memberMonthFacts: memberFacts,
    rewardSourcePeriodFacts,
    poolPeriodFacts
  };
}
