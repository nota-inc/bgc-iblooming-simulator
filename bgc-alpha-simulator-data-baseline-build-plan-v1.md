# Data Ingestion + Baseline Model Build Plan v1

Status: Draft v1, Phase 1A implemented  
Date: 2026-03-17  
Depends on: `bgc-alpha-simulator-prd-founder-v1.md`, `bgc-alpha-simulator-prd.md`, `bgc-alpha-simulator-build-spec-v1.md`, `bgc-alpha-simulator-mvp-execution-plan-v1.md`

## 1. Purpose

This document defines the next implementation phase for the simulator:

- real snapshot ingestion
- executable baseline model encoding
- dataset-driven simulation inputs

This was the highest-value next step because the app shell and run workflow already existed while the engine was still scaffold math.

## 1.1 Implementation Update

The first slice of this plan is now implemented in the codebase.

Completed:

- canonical import tables for snapshot import runs, issues, and member-month facts
- CSV import worker flow for `SnapshotMemberMonthFact`
- snapshot UI support for import status and fact counts
- executable `model-v1` ruleset in code and seeded DB state
- dataset-driven simulation over imported member-month facts
- run and decision-pack flow using model thresholds instead of scaffold-only constants

Still remaining in this phase:

- richer fact validation and approval lifecycle alignment
- calibration fixtures and regression tests
- additional import formats or optional columns
- refinement of recommendation thresholds from real historical datasets

## 2. Current State

Today the repo already supports:

- internal auth and RBAC
- snapshot metadata registration
- snapshot validation and approval
- snapshot CSV import into canonical member-month facts
- scenario creation and editing
- queued run creation
- worker-based run processing
- executable baseline model rules
- dataset-driven simulation at member-month grain
- results pages
- comparison pages
- decision-pack generation and export

Today the repo does not yet support:

- raw event replay
- direct production data sync
- calibration fixtures and regression tests
- full founder-approved threshold tuning
- richer optional import columns beyond the canonical MVP contract

In practice, the current engine now produces deterministic outputs from imported canonical facts plus the active baseline ruleset and scenario parameters.

## 3. Goal Of This Phase

Turn the simulator from:

`a working decision-console shell with placeholder formulas`

into:

`a working internal simulator that reads canonical historical data and applies a versioned baseline reward model`

Current state after Phase 1A:

`a working internal simulator that imports canonical member-month facts and runs a baseline-model-driven deterministic engine`

## 4. Guiding Decisions

To keep this phase feasible, the build should use these constraints:

- use `canonical imported facts`, not direct production sync
- use `monthly fact grain` for MVP instead of full raw event replay
- keep the baseline model `versioned, typed, and explainable`
- treat `scenario parameters` as overrides on top of baseline defaults
- keep recommendations rule-based and traceable

## 5. Recommended MVP Shape For This Phase

### 5.1 Snapshot Ingestion Strategy

Support one ingestion format first:

- `CSV import into canonical monthly fact rows`

This is better for MVP than trying to ingest every raw BGC and iBLOOMING source format immediately.

### 5.2 Simulation Grain

Use:

- `member-month` as the primary fact grain

This is enough to support:

- issuance totals
- spend / hold / cash-out behavior
- segment concentration
- treasury pressure
- user and group cap simulation

### 5.3 Baseline Model Shape

Encode the baseline model as:

- a typed ruleset object
- stored in DB as versioned JSON
- mirrored by executable code in `packages/baseline-model`

## 6. Canonical Data Model

The ingestion pipeline should normalize imported data into a canonical schema that the engine can consume directly.

### 6.1 Canonical Fact Table: `SnapshotMemberMonthFact`

Recommended fields:

- `id`
- `snapshotId`
- `periodKey`
- `memberKey`
- `sourceSystem`
- `memberTier`
- `groupKey`
- `pcVolume`
- `spRewardBasis`
- `globalRewardUsd`
- `poolRewardUsd`
- `cashoutUsd`
- `sinkSpendUsd`
- `activeMember`
- `metadataJson`
- `createdAt`

Why this table:

- it captures the minimum economic facts needed for simulation
- it can be derived from multiple source systems
- it supports segmentation and cap logic

### 6.2 Optional Derived Table: `SnapshotGroupMonthFact`

Recommended only if performance requires pre-aggregation.

For MVP, this can be derived from `SnapshotMemberMonthFact`.

### 6.3 Import Tracking Tables

Add:

- `SnapshotImportRun`
- `SnapshotImportIssue`

Recommended fields for `SnapshotImportRun`:

- `id`
- `snapshotId`
- `status`
- `fileUri`
- `rowCountRaw`
- `rowCountImported`
- `startedAt`
- `completedAt`
- `notes`

Recommended fields for `SnapshotImportIssue`:

- `id`
- `importRunId`
- `severity`
- `issueType`
- `rowRef`
- `message`

### 6.4 Suggested Import Statuses

- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`

## 7. File Contract For MVP

The first supported import file should be a CSV with explicit headers.

Recommended required columns:

- `period_key`
- `member_key`
- `source_system`
- `member_tier`
- `group_key`
- `pc_volume`
- `sp_reward_basis`
- `global_reward_usd`
- `pool_reward_usd`
- `cashout_usd`
- `sink_spend_usd`
- `active_member`

Recommended optional columns:

- `country_code`
- `affiliate_level`
- `notes`
- `extra_json`

## 8. Snapshot Ingestion Flow

The target flow should be:

1. user registers a snapshot
2. user attaches or references a CSV file
3. app creates `SnapshotImportRun`
4. worker parses the CSV
5. worker writes canonical facts into `SnapshotMemberMonthFact`
6. worker persists import issues
7. validation runs on both metadata and imported facts
8. snapshot becomes `VALID` or `INVALID`
9. approved snapshots become eligible for run launch

## 9. Validation Rules For Imported Facts

In addition to current metadata checks, add fact-level validation:

- required columns must exist
- numeric columns must parse cleanly
- `periodKey` must match expected month format
- no duplicate `snapshotId + periodKey + memberKey + sourceSystem` rows
- no negative values in fields that must be non-negative
- at least one month of imported facts must exist
- at least one active member must exist
- total imported row count must match or be explainably close to declared count

Recommended warning checks:

- unusually sparse months
- unusually high concentration in one member or group
- abrupt zero periods

## 10. Baseline Model Encoding Plan

The current `model-v1` is only descriptive metadata. This phase should turn it into an executable ruleset.

### 10.1 Baseline Model Structure

Recommended typed structure:

- `version`
- `summary`
- `lockedAssumptions`
- `defaults`
- `conversionRules`
- `rewardRules`
- `capRules`
- `sinkRules`
- `cashoutRules`
- `recommendationThresholds`
- `segmentationRules`

### 10.2 Baseline Defaults

Example categories:

- default `k_pc`
- default `k_sp`
- default reward factors
- default caps
- default sink target
- default cash-out policy

### 10.3 Recommendation Thresholds

Move threshold values out of ad hoc engine constants and into the model version.

Recommended thresholds:

- payout warning threshold
- payout rejection threshold
- reserve runway warning threshold
- reserve runway rejection threshold
- concentration warning threshold
- concentration rejection threshold

### 10.4 Override Model

The run engine should compute:

- `effective parameters = baseline defaults + scenario overrides`

This keeps the baseline model authoritative while allowing scenario testing.

## 11. Simulation Engine Refactor

Refactor `packages/simulation-core` from simple formula output into a staged pipeline.

### 11.1 Proposed Engine Stages

1. `load facts`
2. `load baseline model`
3. `apply scenario overrides`
4. `compute effective monthly issuance`
5. `apply caps`
6. `apply sink and cash-out behavior`
7. `aggregate summary metrics`
8. `compute segment metrics`
9. `evaluate flags`
10. `generate recommendation`

### 11.2 First Real Engine Scope

For MVP, the engine should use imported facts to compute:

- issued ALPHA from `pcVolume` and `spRewardBasis`
- spend / hold / cash-out based on imported and configured values
- user concentration
- group concentration
- payout / inflow pressure
- reserve runway estimate

### 11.3 Parameters That Must Become Active In This Phase

These currently stored parameters should start affecting the engine:

- `cap_user_monthly`
- `cap_group_monthly`
- `cashout_fee_bps`
- `cashout_windows_per_year`
- `cashout_window_days`

## 12. Recommended Code Changes

### 12.1 Prisma / DB

Add models for:

- `SnapshotImportRun`
- `SnapshotImportIssue`
- `SnapshotMemberMonthFact`

Extend query helpers in:

- `packages/db/src/snapshots.ts`
- `packages/db/src/baseline-models.ts`
- `packages/db/src/runs.ts`

### 12.2 Schemas

Add schema contracts for:

- snapshot CSV row
- canonical member-month fact
- import-run result
- executable baseline ruleset

Files likely affected:

- `packages/schemas/src/snapshot.ts`
- new `packages/schemas/src/import.ts`
- new `packages/schemas/src/baseline-model.ts`

### 12.3 Baseline Model Package

Refactor `packages/baseline-model` to export:

- typed model schemas
- `model-v1` ruleset
- helpers to resolve defaults and thresholds

Likely files:

- `packages/baseline-model/src/index.ts`
- `packages/baseline-model/src/versions/model-v1.ts`
- new `packages/baseline-model/src/resolve-effective-parameters.ts`

### 12.4 Simulation Core

Add modules for:

- fact loading input adapters
- issuance calculators
- cap calculators
- sink and cash-out calculators
- aggregation pipeline

Likely files:

- new `packages/simulation-core/src/engine/*`
- new `packages/simulation-core/src/calculators/*`
- new `packages/simulation-core/src/adapters/*`

### 12.5 Worker

Add jobs for:

- `snapshot.import`
- `snapshot.validate-facts`

Update run worker to:

- load facts for the selected snapshot
- load baseline model ruleset
- build effective run input from facts + baseline + scenario

### 12.6 Web App

Add snapshot UX for:

- import status
- import issue review
- imported row count summary
- fact validation summary

Add scenario UX for:

- clearer indication of which parameters are baseline defaults vs overrides

## 13. Implementation Milestones

## Phase 1: Canonical Import Foundation

Goal:

- make snapshots import real data rows

Deliverables:

- Prisma models for import tracking and canonical facts
- CSV row schema
- worker job to parse and persist rows
- snapshot import status visible in UI

Acceptance criteria:

- one CSV file can be imported into canonical facts
- import failures are captured as import issues
- imported row count is visible per snapshot

## Phase 2: Fact Validation

Goal:

- ensure imported data is trustworthy enough for simulation

Deliverables:

- fact-level validation pipeline
- persisted validation issues
- updated snapshot approval gating

Acceptance criteria:

- invalid fact imports block approval
- warnings are reviewable in UI
- snapshot status reflects both metadata and fact checks

## Phase 3: Executable Baseline Model v1

Goal:

- turn the baseline model into real rule configuration

Deliverables:

- typed baseline ruleset schema
- executable `model-v1`
- threshold configuration moved into model rules

Acceptance criteria:

- a run can resolve its effective parameters from model + scenario
- recommendation thresholds come from the model, not hardcoded engine constants

## Phase 4: Dataset-Driven Simulation

Goal:

- compute results from imported facts instead of placeholder issuance formulas

Deliverables:

- refactored engine pipeline
- activated cap and cash-out parameters
- dataset-driven segment metrics

Acceptance criteria:

- same snapshot + same model + same scenario remains deterministic
- changing imported facts changes run outputs
- changing cap and cash-out settings changes outputs in expected directions

## Phase 5: Calibration And Hardening

Goal:

- make the decision engine credible for founder review

Deliverables:

- calibration fixtures
- regression tests
- decision-pack text aligned with new outputs

Acceptance criteria:

- example scenarios reliably produce `candidate`, `risky`, and `rejected`
- key output metrics are covered by tests
- run outputs are explainable from the imported facts

## 14. Ticket-Level Breakdown

### EP-DI-01 Import Foundation

- `DI-100` Add Prisma models for import runs, import issues, and member-month facts. Completed.
- `DI-101` Add canonical CSV row schema and parser contract. Completed.
- `DI-102` Implement `snapshot.import` worker job. Completed.
- `DI-103` Persist imported fact rows and import statistics. Completed.
- `DI-104` Add snapshot import status and import issue UI. Completed.

### EP-DI-02 Fact Validation

- `DI-200` Implement fact-level validation rules
- `DI-201` Persist fact validation issues
- `DI-202` Merge metadata validation and fact validation into one approval gate
- `DI-203` Show validation summaries in snapshot detail UI

### EP-BM-01 Baseline Encoding

- `BM-100` Define typed baseline ruleset schema. Completed.
- `BM-101` Convert `model-v1` from placeholder metadata into executable defaults and thresholds. Completed.
- `BM-102` Add helpers to resolve effective parameters from baseline + scenario. Completed.
- `BM-103` Add baseline model fixtures and tests

### EP-SE-01 Engine Refactor

- `SE-100` Add fact-loading adapter for canonical snapshot facts. Completed.
- `SE-101` Implement issuance calculation from imported facts. Completed.
- `SE-102` Implement user and group cap application. Completed.
- `SE-103` Implement sink and cash-out calculation using active parameters. Completed.
- `SE-104` Implement real segment aggregation. Completed.
- `SE-105` Move flag and recommendation thresholds to baseline ruleset. Completed.

### EP-SE-02 Result Hardening

- `SE-200` Add regression tests for candidate / risky / rejected outcomes
- `SE-201` Update run notes and decision-pack generation to reflect new engine outputs
- `SE-202` Add calibration fixtures from sample imported datasets

## 15. Completed First Coding Slice

The first implementation slice is complete:

1. add Prisma models for `SnapshotImportRun`, `SnapshotImportIssue`, and `SnapshotMemberMonthFact`
2. add schema contracts for canonical import rows
3. implement a worker job that imports one CSV into canonical facts
4. expose import status on the snapshot screen

Delivered outcome:

- the simulator now has a real input layer
- the dataset contract exists in code and the DB
- the engine refactor can now operate on imported canonical facts instead of placeholder-only inputs

## 15.1 Recommended Next Coding Slice

The next implementation slice should be:

1. add regression fixtures for sample imported datasets
2. tighten fact-level validation and import-to-approval rules
3. tune recommendation thresholds against real historical totals
4. add a lightweight run verification harness for local deterministic checks

Reason:

- the data path and engine path now exist
- the biggest remaining risk is credibility and calibration, not plumbing
- the next iteration should improve confidence before expanding scope

## 16. Open Questions To Resolve Early

- What is the exact authoritative CSV contract for the first import?
- Will BGC and iBLOOMING export one unified file or separate files?
- What is the required period grain: monthly only, or daily then aggregated to month?
- Which member segmentation fields are mandatory for MVP fairness analysis?
- Should group caps be derived from `groupKey`, affiliate level, or another hierarchy?

## 17. Recommendation

Approve this phase as:

`real snapshot ingestion + executable baseline model encoding`

Then implement in this order:

1. calibration fixtures and deterministic test coverage
2. richer fact validation and import lifecycle hardening
3. threshold tuning from real historical datasets
4. optional import enrichment and model refinement

The biggest PRD gap around real inputs and executable baseline behavior is now closed. The next work should focus on trustworthiness, calibration, and hardening.
