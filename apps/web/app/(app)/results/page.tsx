import Link from "next/link";

import { listRunReferences } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { PageHeader } from "@bgc-alpha/ui";

import { requirePageUser } from "@/lib/auth-session";
import { getRunReference, getRunStatusLabel } from "@/lib/common-language";

export default async function ResultsPage() {
  await requirePageUser(["runs.read"]);
  const databaseConfigured = hasDatabaseUrl();
  const runs = databaseConfigured ? await listRunReferences() : [];

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
        <section className="page-grid">
          <div className="card span-12">
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
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <Link href={`/runs/${run.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                          {getRunReference(run.id)}
                        </Link>
                      </td>
                      <td>{run.scenario.name}</td>
                      <td>{run.snapshot.name}</td>
                      <td>{run.modelVersion.versionName}</td>
                      <td>{getRunStatusLabel(run.status)}</td>
                      <td>{run.createdAt.toLocaleString("en-US")}</td>
                      <td>{run.completedAt?.toLocaleString("en-US") ?? "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
