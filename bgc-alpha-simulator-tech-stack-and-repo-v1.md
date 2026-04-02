# Tech Stack and Repo Proposal v1: BGC Alpha Simulator

Status: Draft v1  
Date: 2026-03-16  
Depends on: `bgc-alpha-simulator-prd-founder-v1.md`, `bgc-alpha-simulator-prd.md`, `bgc-alpha-simulator-build-spec-v1.md`, `bgc-alpha-simulator-mvp-execution-plan-v1.md`

## 1. Recommendation

I recommend building the MVP with a `TypeScript-first monorepo`.

This is the best fit for the current product because:

- the product is an internal web app, not a consumer product,
- the simulation logic is deterministic business-policy logic, not ML or quant research,
- frontend, backend, validation, scenario schemas, and simulation contracts all benefit from shared types,
- it reduces coordination cost between product, engineering, and simulation logic.

## 2. Recommended Stack

### Frontend and App Server

- `Next.js 15`
- `React 19`
- `TypeScript`
- `App Router`

Why:

- strong fit for internal dashboards and decision tools,
- server-first rendering for read-heavy pages,
- route handlers and server actions can keep MVP architecture simple,
- good deployment and DX for a multi-page internal console.

### UI Layer

- `Tailwind CSS`
- `shadcn/ui`
- `TanStack Table`
- `ECharts` for charts

Why:

- fast internal-tool UI development,
- table-heavy pages are first-class in this product,
- charting needs are substantial enough that ECharts is more flexible than lightweight chart libs,
- internal tools benefit more from speed and consistency than custom design systems.

### Forms and Validation

- `React Hook Form`
- `Zod`

Why:

- scenario builder will have many parameters and validation rules,
- Zod can be shared between frontend and backend,
- reduces drift between UI validation and API validation.

### Backend API

- `Next.js Route Handlers`
- `TypeScript`
- `Zod` request and response schemas

Why:

- keeps MVP architecture simpler than splitting a separate API app too early,
- enough for internal auth, snapshot lifecycle, scenario CRUD, run orchestration, and exports,
- can be extracted later if traffic or team structure requires it.

### Database

- `PostgreSQL`
- `Prisma ORM`

Why:

- best fit for structured metadata: users, roles, snapshots, scenarios, runs, metrics, exports, audit logs,
- Prisma is fast for MVP delivery and good enough for internal tools,
- Postgres is reliable and aligns with future analytics needs.

### Background Jobs

- `pg-boss`

Why:

- background work is required for snapshot validation, simulation runs, and exports,
- using Postgres-backed jobs avoids adding Redis for MVP,
- simpler infrastructure than BullMQ for the first version.

### Object/File Storage

- `S3-compatible object storage`

Use for:

- uploaded snapshot files,
- generated exports,
- optional archived run artifacts.

Why:

- dataset snapshots and exports should not live in Postgres blobs,
- clean separation between structured metadata and file artifacts.

### Simulation Engine

- `TypeScript`
- pure domain package inside the monorepo

Why:

- deterministic business rules are easier to keep aligned when types are shared,
- no need to introduce Python unless the project later becomes a true data-science platform,
- easier to version scenario input and output contracts.

### Charts and Analytics Presentation

- `Apache ECharts`

Use for:

- time-series metrics,
- segment comparisons,
- treasury and runway graphs,
- risk and threshold visualizations.

### Authentication

- `Auth.js`

Preferred auth mode:

- Google Workspace or Microsoft Entra OIDC if the team has internal SSO.

Fallback:

- credentials-based auth with admin-seeded users.

Why:

- internal tools should prefer organization identity if available,
- role mapping is straightforward,
- avoids custom auth work for MVP.

### Logging and Error Monitoring

- structured app logs
- `Sentry` optional but recommended for staging and production

### Testing

- `Vitest` for unit and integration logic
- `Playwright` for end-to-end UI flows

Why:

- deterministic simulation engine needs unit-level repeatability,
- critical app flows need browser-level coverage.

## 3. Stack Summary

Recommended concrete stack:

- `pnpm` workspaces
- `Turborepo`
- `Next.js`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui`
- `TanStack Table`
- `ECharts`
- `React Hook Form`
- `Zod`
- `PostgreSQL`
- `Prisma`
- `pg-boss`
- `Auth.js`
- `S3-compatible storage`
- `Vitest`
- `Playwright`

## 4. Why This Is Better Than The Alternatives

### Better than split frontend plus separate backend plus Python engine for MVP

- fewer moving parts,
- shared types across scenario forms, API, and simulation engine,
- faster to build,
- easier to audit and maintain early on.

### Better than dashboard-only stack

- the system needs background runs, validation, and exports,
- not just charts and reads.

### Better than serverless-only everything

- simulation runs and exports are background-oriented,
- a worker process gives more control and clearer operational behavior.

## 5. Where To Be Careful

- Do not put heavy simulation logic directly in the Next.js request path.
- Do not hard-code unsettled founder choices into the baseline model.
- Do not couple raw uploaded files to production runtime assumptions.
- Do not overuse client components in Next.js pages that can be server-rendered.

## 6. Recommended Repo Shape

Use a monorepo:

```text
bgc-alpha-simulator/
  apps/
    web/
    worker/
  packages/
    ui/
    db/
    auth/
    schemas/
    simulation-core/
    baseline-model/
    exports/
    config/
  docs/
  scripts/
  infra/
```

## 7. Detailed Repo Structure

```text
bgc-alpha-simulator/
  apps/
    web/
      app/
        (auth)/
        overview/
        snapshots/
        scenarios/
        runs/[runId]/
        compare/
        distribution/[runId]/
        treasury/[runId]/
        decision-pack/[runId]/
        api/
      components/
      lib/
      styles/
      middleware.ts
      next.config.ts
      package.json

    worker/
      src/
        jobs/
          validate-snapshot.ts
          run-simulation.ts
          generate-decision-pack.ts
          generate-export.ts
        queues/
        lib/
        index.ts
      package.json

  packages/
    ui/
      src/
        components/
        charts/
        tables/
        forms/
      package.json

    db/
      prisma/
        schema.prisma
        migrations/
      src/
        client.ts
        queries/
        mutations/
      package.json

    auth/
      src/
        auth.ts
        roles.ts
        guards.ts
      package.json

    schemas/
      src/
        snapshot.ts
        scenario.ts
        run.ts
        decision-pack.ts
        metrics.ts
      package.json

    simulation-core/
      src/
        engine/
        domain/
        metrics/
        scenarios/
        flags/
        recommendation/
        index.ts
      package.json

    baseline-model/
      src/
        versions/
        loaders/
        rules/
        index.ts
      package.json

    exports/
      src/
        markdown/
        pdf/
        csv/
      package.json

    config/
      eslint/
      typescript/
      tailwind/
      package.json

  docs/
    product/
    architecture/
    operations/

  scripts/
    seed-users.ts
    seed-baseline-model.ts
    import-snapshot.ts

  infra/
    docker/
    terraform/ or pulumi/
    sql/

  turbo.json
  package.json
  pnpm-workspace.yaml
  README.md
```

## 8. Package Responsibilities

### `apps/web`

Owns:

- internal UI,
- route handlers,
- page-level data fetching,
- auth session handling,
- user actions and navigation.

Should not own:

- heavy simulation logic,
- long-running jobs,
- snapshot validation engine internals.

### `apps/worker`

Owns:

- background job runners,
- snapshot validation jobs,
- simulation run execution,
- export generation.

Should not own:

- UI,
- direct page rendering.

### `packages/ui`

Owns:

- shared components,
- chart wrappers,
- table primitives,
- form primitives.

### `packages/db`

Owns:

- Prisma schema,
- database client,
- typed query helpers.

### `packages/auth`

Owns:

- auth configuration,
- role definitions,
- reusable guards.

### `packages/schemas`

Owns:

- Zod contracts for snapshot, scenario, run, metrics, and exports.

### `packages/simulation-core`

Owns:

- deterministic simulation engine,
- metric calculators,
- threshold flags,
- recommendation signal logic.

### `packages/baseline-model`

Owns:

- versioned baseline business logic definitions,
- model loading and normalization rules.

### `packages/exports`

Owns:

- decision pack rendering,
- markdown export,
- CSV export,
- PDF generation pipeline.

## 9. Database Recommendation

Use one Postgres database for MVP with these schema groups:

- `auth`
- `core`
- `simulation`
- `exports`
- `audit`

Suggested top-level tables:

- `users`
- `roles`
- `user_roles`
- `dataset_snapshots`
- `snapshot_validation_issues`
- `baseline_model_versions`
- `scenarios`
- `simulation_runs`
- `run_summary_metrics`
- `run_time_series`
- `run_segment_metrics`
- `run_flags`
- `decision_packs`
- `audit_events`
- `job_runs` if needed for job observability

## 10. Snapshot File Format Recommendation

For MVP:

- accept `CSV` upload if that is the fastest path,
- normalize internally to a stored artifact version.

Preferred medium-term format:

- `Parquet`

Reason:

- more compact,
- better typed,
- easier for repeated analytical workloads.

Recommendation:

- MVP supports CSV import,
- worker converts or normalizes to a stable internal format for simulation use.

## 11. Simulation Runtime Recommendation

Use the worker process to run simulation jobs.

Flow:

1. Web app creates run request.
2. API validates snapshot and scenario.
3. API enqueues simulation job in `pg-boss`.
4. Worker loads snapshot artifact and baseline model.
5. Worker runs `simulation-core`.
6. Worker stores outputs in Postgres.
7. Web app polls or refreshes run status.

This is better than running simulation inside API requests because:

- it avoids timeout pressure,
- it supports exports and validation jobs using the same queue pattern,
- it gives cleaner recovery and audit behavior.

## 12. Frontend Rendering Strategy

Use `server-first Next.js`.

### Server Components

Use for:

- overview page shell,
- snapshot list and detail reads,
- scenario list,
- run metadata,
- decision pack reads.

### Client Components

Use for:

- scenario parameter form,
- charts,
- compare interaction,
- polling states,
- advanced table filters.

### Specific Guidance

- keep forms and charts client-side,
- keep data loading and page assembly server-side where possible,
- avoid passing large raw datasets to client components,
- fetch aggregate run outputs, not raw event-level records, in UI routes.

## 13. Styling and UI Recommendation

Use:

- Tailwind for layout and utility styling,
- shadcn/ui for shared primitives,
- one internal admin visual language across the product.

Do not spend early cycles on a custom design system.

This is an internal decision tool. Clarity and speed matter more than brand-heavy UI work.

## 14. Charting Recommendation

Use `ECharts` through a thin wrapper in `packages/ui`.

Recommended chart types:

- line charts for runway and payout pressure,
- stacked bar charts for distribution splits,
- heatmaps or tables for compare views,
- threshold overlays for risk visualization.

## 15. Auth Recommendation

Preferred:

- `Auth.js` with Google or Microsoft SSO.

Fallback:

- credentials auth with admin-managed internal users.

Role model for MVP:

- `founder`
- `analyst`
- `product`
- `engineering`
- `admin`

## 16. Deployment Topology

Recommended MVP topology:

- `web app`
  deployed as one Next.js service
- `worker`
  deployed as one Node worker service
- `postgres`
  managed database
- `object storage`
  managed bucket

Optional:

- `Sentry`
- managed cron if periodic cleanup or nightly jobs are needed

## 17. Environment Variables

### Web

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GOOGLE_CLIENT_ID` or equivalent
- `AUTH_GOOGLE_CLIENT_SECRET` or equivalent
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `PG_BOSS_SCHEMA` if configured

### Worker

- `DATABASE_URL`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `WORKER_CONCURRENCY`
- `SIMULATION_ENGINE_VERSION`

## 18. Suggested Initial Repo Tasks

Before coding product features, create these:

- root monorepo config
- `apps/web`
- `apps/worker`
- `packages/db`
- `packages/schemas`
- `packages/simulation-core`
- `packages/ui`
- `packages/auth`
- `packages/baseline-model`
- `packages/exports`

## 19. Suggested Phase Mapping To This Stack

### First Build Phase

- repo bootstrap,
- auth,
- db schema,
- snapshot storage,
- scenario persistence.

### Second Build Phase

- worker jobs,
- simulation engine contract,
- run persistence,
- results pages.

### Third Build Phase

- compare,
- exports,
- QA hardening.

## 20. What I Do Not Recommend

I do not recommend for MVP:

- splitting into separate frontend, API, and Python services,
- introducing Redis before it is needed,
- introducing microservices,
- building around notebooks as the production runtime,
- putting simulation logic directly in client code,
- over-optimizing infra before the first end-to-end run works.

## 21. If Python Becomes Needed Later

If advanced modeling grows beyond deterministic policy simulation, add Python later as a separate research layer, not as the MVP core runtime.

Possible future addition:

- `apps/research`
  for notebooks, experiments, and advanced model validation.

That should remain separate from the production simulation engine until there is a proven need.

## 22. Final Recommendation

Build the BGC Alpha Simulator as a `pnpm + Turborepo monorepo` with:

- `Next.js` for the internal web app,
- `Postgres + Prisma` for structured data,
- `pg-boss` for background jobs,
- `S3-compatible storage` for snapshots and exports,
- a `TypeScript simulation-core package` for deterministic policy modeling,
- and a `worker app` for validation, runs, and export jobs.

This is the highest-leverage stack for the current stage because it keeps the architecture concrete, shared-type friendly, operationally simple, and fast enough to reach the first decision-ready MVP.
