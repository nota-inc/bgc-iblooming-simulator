import { NextResponse } from "next/server";

import { getSnapshotById, listSnapshotMemberMonthFacts } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

const CSV_HEADERS = [
  "periodKey",
  "memberKey",
  "sourceSystem",
  "memberTier",
  "groupKey",
  "pcVolume",
  "spRewardBasis",
  "globalRewardUsd",
  "poolRewardUsd",
  "cashoutUsd",
  "sinkSpendUsd",
  "activeMember",
] as const;

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { snapshotId } = await params;
  const snapshot = await getSnapshotById(snapshotId);

  if (!snapshot) {
    return NextResponse.json(
      { error: "snapshot_not_found" },
      { status: 404 }
    );
  }

  const facts = await listSnapshotMemberMonthFacts(snapshotId);

  if (facts.length === 0) {
    return NextResponse.json(
      { error: "no_data_to_export", message: "This snapshot has no imported data to export." },
      { status: 404 }
    );
  }

  const headerRow = CSV_HEADERS.join(",");
  const dataRows = facts.map((fact) =>
    CSV_HEADERS.map((key) => escapeCsvField(fact[key])).join(",")
  );

  const csvContent = [headerRow, ...dataRows].join("\n");

  const safeName = snapshot.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const filename = `${safeName}_export.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
