import type { SnapshotValidationIssueInput } from "@bgc-alpha/db";

const MIN_RECOMMENDED_WINDOW_DAYS = 365;
const MAX_RECOMMENDED_WINDOW_DAYS = 1100;

type SnapshotForValidation = {
  name: string;
  dateFrom: Date;
  dateTo: Date;
  recordCount: number | null;
  fileUri: string;
  sourceSystems: string[];
};

export function validateSnapshot(snapshot: SnapshotForValidation) {
  const issues: SnapshotValidationIssueInput[] = [];
  const coverageDays = Math.ceil(
    (snapshot.dateTo.getTime() - snapshot.dateFrom.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (snapshot.dateTo < snapshot.dateFrom) {
    issues.push({
      severity: "ERROR",
      issueType: "date_range_invalid",
      message: "Snapshot end date must be on or after the start date."
    });
  }

  if (!snapshot.recordCount || snapshot.recordCount <= 0) {
    issues.push({
      severity: "ERROR",
      issueType: "record_count_missing",
      message: "Snapshot record count must be greater than zero before validation can pass."
    });
  }

  if (snapshot.sourceSystems.length === 0) {
    issues.push({
      severity: "ERROR",
      issueType: "source_system_missing",
      message: "At least one source system must be attached to the snapshot."
    });
  }

  if (new Set(snapshot.sourceSystems).size !== snapshot.sourceSystems.length) {
    issues.push({
      severity: "WARNING",
      issueType: "duplicate_source_system",
      message: "Duplicate source system keys were provided and should be cleaned before approval."
    });
  }

  if (!/^(s3|https?|file):/i.test(snapshot.fileUri)) {
    issues.push({
      severity: "WARNING",
      issueType: "file_uri_scheme",
      message: "Snapshot file URI should use an explicit storage scheme such as https:// or file://."
    });
  }

  if (coverageDays < MIN_RECOMMENDED_WINDOW_DAYS) {
    issues.push({
      severity: "WARNING",
      issueType: "coverage_window_short",
      message: "Snapshot covers less than one year of history and may underfit seasonality."
    });
  }

  if (coverageDays > MAX_RECOMMENDED_WINDOW_DAYS) {
    issues.push({
      severity: "WARNING",
      issueType: "coverage_window_large",
      message: "Snapshot covers an unusually large time window and may blend incompatible business states."
    });
  }

  return issues;
}
