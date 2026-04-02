import { readFile } from "node:fs/promises";
import path from "node:path";

import { snapshotImportCsvRowSchema } from "@bgc-alpha/schemas";

const DEFAULT_INPUT_PATH = "examples/bgc-source-bundle-canonical.csv";
const EXPECTED_SOURCE_FILES = [
  "2024 Global Profit Sharing from Turnover - Sheet1.csv",
  "2025 1st Half Global Profit Sharing from Turnover - Sheet1.csv",
  "BGC New & Upgrade Affiliates - Upgrade.csv",
  "Copy of BGC New & Upgrade Affiliates - Newly Joined.csv",
  "CP Videos Sold - Sheet1.csv",
  "WEP - World Executive Program Application Form (Responses) - Form Responses 1.csv",
  "iMatrix Records - Sheet1.csv",
  "Copy of SIMULATION SHEETS v0.1 - PARAMS.csv",
  "Copy of SIMULATION SHEETS v0.1 - DATA_AGG.csv"
] as const;
const EXPECTED_SOURCE_CATEGORIES = [
  "global_profit_2024_summary",
  "global_profit_2025_first_half_distribution",
  "affiliate_upgrade",
  "affiliate_newly_joined",
  "cp_video_sale",
  "wep_application",
  "imatrix_product_aggregate",
  "params_monthly_topup",
  "data_agg_monthly_override"
] as const;

function parseArgs(argv: string[]) {
  const [inputArg] = argv;

  return {
    inputPath: path.isAbsolute(inputArg ?? "")
      ? (inputArg as string)
      : path.resolve(process.cwd(), inputArg ?? DEFAULT_INPUT_PATH)
  };
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  const source = text.replace(/^\uFEFF/, "");
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        continue;
      }

      currentCell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      currentCell = "";
      rows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.filter((row) => row.some((value) => value.trim().length > 0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = await readFile(args.inputPath, "utf8");
  const rows = parseCsvRows(text);
  const header = rows[0] ?? [];
  const records = rows.slice(1).map((row) =>
    Object.fromEntries(header.map((column, index) => [column.trim(), row[index] ?? ""]))
  );
  const sourceFilesFound = new Set<string>();
  const sourceCategoriesFound = new Set<string>();

  for (const record of records) {
    const parsed = snapshotImportCsvRowSchema.parse(record);

    if (!parsed.extra_json.trim()) {
      continue;
    }

    const extraJson = JSON.parse(parsed.extra_json) as unknown;

    if (!isRecord(extraJson)) {
      throw new Error("extra_json must parse to an object for every populated row.");
    }

    const sourceFiles = Array.isArray(extraJson.source_files) ? extraJson.source_files : [];
    const sourceCategories = Array.isArray(extraJson.source_categories)
      ? extraJson.source_categories
      : [];

    for (const sourceFile of sourceFiles) {
      if (typeof sourceFile === "string") {
        sourceFilesFound.add(sourceFile);
      }
    }

    for (const sourceCategory of sourceCategories) {
      if (typeof sourceCategory === "string") {
        sourceCategoriesFound.add(sourceCategory);
      }
    }
  }

  const missingFiles = EXPECTED_SOURCE_FILES.filter((value) => !sourceFilesFound.has(value));
  const missingCategories = EXPECTED_SOURCE_CATEGORIES.filter(
    (value) => !sourceCategoriesFound.has(value)
  );

  if (missingFiles.length > 0 || missingCategories.length > 0) {
    throw new Error(
      [
        missingFiles.length > 0 ? `Missing source files: ${missingFiles.join(", ")}` : null,
        missingCategories.length > 0
          ? `Missing source categories: ${missingCategories.join(", ")}`
          : null
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }

  console.log(`Verified ${records.length} canonical rows in ${args.inputPath}`);
  console.log(`Source files covered: ${EXPECTED_SOURCE_FILES.length}`);
  console.log(`Source categories covered: ${EXPECTED_SOURCE_CATEGORIES.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
