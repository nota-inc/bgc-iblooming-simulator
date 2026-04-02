import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

export const maxSnapshotUploadBytes = 10 * 1024 * 1024;

function resolveWorkspaceRoot() {
  const cwd = process.cwd();

  if (existsSync(path.join(cwd, "pnpm-workspace.yaml"))) {
    return cwd;
  }

  const repoCandidate = path.resolve(cwd, "..", "..");

  if (existsSync(path.join(repoCandidate, "pnpm-workspace.yaml"))) {
    return repoCandidate;
  }

  return cwd;
}

function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "snapshot.csv";
}

export function getSnapshotUploadDirectory() {
  return path.join(resolveWorkspaceRoot(), "storage", "uploads", "snapshots");
}

export async function saveUploadedSnapshotCsv(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv files are supported.");
  }

  if (file.size <= 0) {
    throw new Error("Upload a non-empty CSV file.");
  }

  if (file.size > maxSnapshotUploadBytes) {
    throw new Error("CSV upload exceeds the 10 MB limit.");
  }

  const uploadDirectory = getSnapshotUploadDirectory();
  await mkdir(uploadDirectory, { recursive: true });

  const savedFilename = `${Date.now()}-${randomUUID()}-${sanitizeFilename(file.name)}`;
  const absolutePath = path.join(uploadDirectory, savedFilename);
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, bytes);

  return {
    absolutePath,
    fileUri: pathToFileURL(absolutePath).href,
    savedFilename,
    size: file.size
  };
}
