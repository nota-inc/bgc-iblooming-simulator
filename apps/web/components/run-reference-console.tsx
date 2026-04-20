"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AppSessionUser } from "@/lib/auth-session";
import { getRunReference, getRunStatusLabel } from "@/lib/common-language";

type RunReferenceRecord = {
  id: string;
  status: string;
  archivedAt: string | null;
  isPinned: boolean;
  createdAt: string;
  completedAt: string | null;
  scenario: {
    id: string;
    name: string;
  };
  snapshot: {
    id: string;
    name: string;
  };
  modelVersion: {
    id: string;
    versionName: string;
  };
};

type RunReferenceConsoleProps = {
  runs: RunReferenceRecord[];
  user: AppSessionUser;
};

type RunScope = "active" | "archived" | "all";

function formatRunArchiveError(error: string | undefined) {
  switch (error) {
    case "run_not_archivable":
      return "Queued or running refs cannot be archived yet.";
    case "run_not_pinnable":
      return "Only completed refs can be pinned.";
    default:
      return "Run update failed.";
  }
}

export function RunReferenceConsole({ runs, user }: RunReferenceConsoleProps) {
  const router = useRouter();
  const [scope, setScope] = useState<RunScope>("active");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = user.capabilities.includes("runs.write");
  const activeCount = runs.filter((run) => !run.archivedAt).length;
  const archivedCount = runs.filter((run) => Boolean(run.archivedAt)).length;
  const pinnedCount = runs.filter((run) => run.isPinned).length;

  const visibleRuns = useMemo(() => {
    const filteredRuns =
      scope === "archived"
        ? runs.filter((run) => Boolean(run.archivedAt))
        : scope === "all"
          ? runs
          : runs.filter((run) => !run.archivedAt);

    return [...filteredRuns].sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      const leftTime = new Date(left.completedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.completedAt ?? right.createdAt).getTime();

      return rightTime - leftTime;
    });
  }, [runs, scope]);

  async function toggleArchive(run: RunReferenceRecord) {
    setMessage(null);

    const response = await fetch(`/api/runs/${run.id}/archive`, {
      method: run.archivedAt ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reason: run.archivedAt ? null : "Archived from Result Ref"
      })
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(formatRunArchiveError(payload?.error));
      return;
    }

    setMessage(
      run.archivedAt
        ? `${getRunReference(run.id)} returned to active Result Ref.`
        : `${getRunReference(run.id)} archived from the default Result Ref view.`
    );
    router.refresh();
  }

  async function togglePinned(run: RunReferenceRecord) {
    setMessage(null);

    const response = await fetch(`/api/runs/${run.id}/pin`, {
      method: run.isPinned ? "DELETE" : "POST"
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(formatRunArchiveError(payload?.error));
      return;
    }

    setMessage(
      run.isPinned
        ? `${getRunReference(run.id)} unpinned.`
        : `${getRunReference(run.id)} pinned for long-term retention.`
    );
    router.refresh();
  }

  return (
    <section className="page-grid">
      <div className="card span-12">
        <div
          style={{
            alignItems: "flex-start",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.85rem",
            justifyContent: "space-between",
            marginBottom: "1rem"
          }}
        >
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button
                className="ghost-button"
                data-active={scope === "active"}
                onClick={() => setScope("active")}
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.7rem" }}
                type="button"
              >
                Active ({activeCount})
              </button>
              <button
                className="ghost-button"
                data-active={scope === "archived"}
                onClick={() => setScope("archived")}
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.7rem" }}
                type="button"
              >
                Archived ({archivedCount})
              </button>
              <button
                className="ghost-button"
                data-active={scope === "all"}
                onClick={() => setScope("all")}
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.7rem" }}
                type="button"
              >
                All ({runs.length})
              </button>
            </div>
            <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
              Archive cleans the default view. Pin marks refs that should be protected when storage cleanup starts.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="badge badge--neutral">{pinnedCount} pinned</span>
            <span className="badge badge--neutral">{archivedCount} archived</span>
          </div>
        </div>

        {message ? (
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.9rem" }}>
            {message}
          </p>
        ) : null}

        {visibleRuns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <h3>No refs in this view</h3>
            <p>Switch filters or launch a fresh run.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Scenario</th>
                  <th>Snapshot</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <Link href={`/runs/${run.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                          {getRunReference(run.id)}
                        </Link>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {run.isPinned ? <span className="badge badge--info">Pinned</span> : null}
                          {run.archivedAt ? <span className="badge badge--neutral">Archived</span> : null}
                        </div>
                      </div>
                    </td>
                    <td>{run.scenario.name}</td>
                    <td>{run.snapshot.name}</td>
                    <td>{run.modelVersion.versionName}</td>
                    <td>{getRunStatusLabel(run.status)}</td>
                    <td>{new Date(run.createdAt).toLocaleString("en-US")}</td>
                    <td>{run.completedAt ? new Date(run.completedAt).toLocaleString("en-US") : "Pending"}</td>
                    <td>
                      <div className="action-row">
                        <button
                          className="ghost-button"
                          disabled={!canWrite || isPending || run.status !== "COMPLETED"}
                          onClick={() => {
                            startTransition(async () => {
                              await togglePinned(run);
                            });
                          }}
                          style={{ fontSize: "0.74rem", padding: "0.3rem 0.6rem" }}
                          title={run.status !== "COMPLETED" ? "Only completed refs can be pinned." : undefined}
                          type="button"
                        >
                          {run.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          className="ghost-button"
                          disabled={!canWrite || isPending || ["QUEUED", "RUNNING"].includes(run.status)}
                          onClick={() => {
                            startTransition(async () => {
                              await toggleArchive(run);
                            });
                          }}
                          style={{ fontSize: "0.74rem", padding: "0.3rem 0.6rem" }}
                          title={["QUEUED", "RUNNING"].includes(run.status) ? "Queued or running refs cannot be archived." : undefined}
                          type="button"
                        >
                          {run.archivedAt ? "Unarchive" : "Archive"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
