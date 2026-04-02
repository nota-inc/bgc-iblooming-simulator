import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LOCAL_SNAPSHOT_UPLOAD_PREFIX = path.join("storage", "uploads", "snapshots");

export type SnapshotUploadSource = {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export const maxSnapshotUploadBytes = 10 * 1024 * 1024;

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || typeof process.env.VERCEL_ENV === "string";
}

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
  return (
    filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "snapshot.csv"
  );
}

function createSavedFilename(originalName: string) {
  return `${Date.now()}-${randomUUID()}-${sanitizeFilename(originalName)}`;
}

export function hasBlobReadWriteToken() {
  return Boolean(normalizeEnvValue(process.env.BLOB_READ_WRITE_TOKEN));
}

export function getSnapshotUploadDirectory() {
  return path.join(resolveWorkspaceRoot(), LOCAL_SNAPSHOT_UPLOAD_PREFIX);
}

export async function saveUploadedSnapshotCsv(file: SnapshotUploadSource) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv files are supported.");
  }

  if (file.size <= 0) {
    throw new Error("Upload a non-empty CSV file.");
  }

  if (file.size > maxSnapshotUploadBytes) {
    throw new Error("CSV upload exceeds the 10 MB limit.");
  }

  const savedFilename = createSavedFilename(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isVercelRuntime()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required for browser snapshot uploads on Vercel. Connect Vercel Blob or provide a manual https:// file URI instead."
    );
  }

  const uploadDirectory = getSnapshotUploadDirectory();
  await mkdir(uploadDirectory, { recursive: true });

  const absolutePath = path.join(uploadDirectory, savedFilename);

  await writeFile(absolutePath, bytes);

  return {
    absolutePath,
    fileUri: pathToFileURL(absolutePath).href,
    savedFilename,
    size: file.size
  };
}

export async function readSnapshotCsvText(fileUri: string) {
  if (fileUri.startsWith("file://")) {
    return readFile(fileURLToPath(fileUri), "utf8");
  }

  if (/^https?:\/\//i.test(fileUri)) {
    const response = await fetch(fileUri, { method: "GET", cache: "no-store" });

    if (!response.ok) {
      throw new Error(
        `Snapshot import could not download ${fileUri} (${response.status} ${response.statusText}).`
      );
    }

    return response.text();
  }

  if (/^[a-z]+:\/\//i.test(fileUri)) {
    throw new Error(`Snapshot import does not support the URI scheme for ${fileUri}.`);
  }

  const resolvedPath = path.isAbsolute(fileUri) ? fileUri : path.resolve(process.cwd(), fileUri);
  return readFile(resolvedPath, "utf8");
}
