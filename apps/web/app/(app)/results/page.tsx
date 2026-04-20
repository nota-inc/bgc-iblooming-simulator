import { listRunReferences } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { PageHeader } from "@bgc-alpha/ui";

import { RunReferenceConsole } from "@/components/run-reference-console";
import { requirePageUser } from "@/lib/auth-session";

export default async function ResultsPage() {
  const user = await requirePageUser(["runs.read"]);
  const databaseConfigured = hasDatabaseUrl();
  const runs = databaseConfigured ? await listRunReferences({ includeArchived: true }) : [];

  return (
    <>
      <PageHeader
        step={{ current: 3, total: 4, label: "Result References" }}
        title="Result Ref"
        description="Browse every saved simulation Ref and open its Simulation Result page directly."
      />

      {!databaseConfigured ? (
        <section className="page-grid">
          <div className="card span-12">
            <h3>Database setup required</h3>
            <p className="muted">DATABASE_URL is required to load saved result references.</p>
          </div>
        </section>
      ) : null}

      {databaseConfigured && runs.length === 0 ? (
        <section className="page-grid">
          <div className="card span-12">
            <div className="empty-state">
              <div className="empty-state-icon">🧾</div>
              <h3>No result refs yet</h3>
              <p>Run a scenario first, then every Ref will appear here.</p>
            </div>
          </div>
        </section>
      ) : null}

      {databaseConfigured && runs.length > 0 ? (
        <RunReferenceConsole
          runs={runs.map((run) => ({
            ...run,
            archivedAt: run.archivedAt?.toISOString() ?? null,
            createdAt: run.createdAt.toISOString(),
            completedAt: run.completedAt?.toISOString() ?? null
          }))}
          user={user}
        />
      ) : null}
    </>
  );
}
