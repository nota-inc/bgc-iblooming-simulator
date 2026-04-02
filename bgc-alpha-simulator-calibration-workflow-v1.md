# Calibration Workflow v1: BGC Alpha Simulator

Status: Draft v1  
Date: 2026-03-17  
Depends on: `bgc-alpha-simulator-data-baseline-build-plan-v1.md`

## 1. Purpose

This document defines how to calibrate the dataset-driven simulator against imported snapshot facts.

The goal is not to add new features. The goal is to make the current engine credible enough for founder decision support.

## 2. Current Capability

The repo now includes a read-only calibration script:

```bash
pnpm calibrate:snapshot <snapshotId>
```

Optional inputs:

- `--scenario <scenarioId>`: calibrate against a saved scenario instead of baseline defaults
- `--model <modelVersionId>`: override the baseline model version
- `--json`: print the report as JSON

The script:

1. loads the imported canonical `SnapshotMemberMonthFact` rows for one snapshot
2. resolves the active baseline model ruleset
3. runs the dataset-driven simulation in memory
4. prints observed snapshot totals beside simulated totals
5. prints percentage deltas for key calibration dimensions

It does not create a `SimulationRun` row and does not mutate the DB beyond normal reads.

## 3. What The Calibration Report Shows

The report compares:

- observed input-side business totals from imported facts
- simulated output totals from the current baseline engine

Key comparisons:

- issuance basis vs simulated issuance
- observed sink spend vs simulated spend
- observed cash-out vs simulated cash-out
- observed payout/inflow ratio vs simulated payout/inflow ratio
- observed sink utilization vs simulated sink utilization

This gives the team a fast signal for where the model is obviously misaligned.

## 4. Current Sample Calibration Result

The sample imported snapshot currently available in the local DB is:

- snapshot id: `cmmu91tj00000qzjjczqozdps`
- name: `Phase 1 Sample Import`

Running:

```bash
pnpm calibrate:snapshot cmmu91tj00000qzjjczqozdps
```

produced these notable results:

- issued vs issuance basis: `0%`
- spent vs observed sink: `-18.68%`
- cash-out vs observed cash-out: `-100%`
- payout/inflow vs observed ratio: `+15.49%`
- sink utilization vs observed: `-18.69%`
- policy status: `rejected`

Interpretation:

- the issuance path currently matches the canonical conversion basis exactly under baseline defaults
- the cash-out path is too strict for this sample because baseline `cashout_min_usd = 25` filtered out all observed cash-out rows
- payout pressure is higher than the observed basis suggests
- this sample is useful as a calibration harness, but it is not yet a trustworthy historical baseline for founder decisions

## 5. What Data Is Still Needed For Real Historical Calibration

The current local repo only has one imported sample snapshot and no imported real historical production-like dataset.

To calibrate properly, we still need:

- `1 to 3 imported historical snapshots` with real member-month facts
- a known-good mapping from BGC and iBLOOMING exports into the canonical columns
- target sanity ranges for:
  - sink spend behavior
  - cash-out behavior
  - reward liability
  - payout/inflow pressure
  - concentration by segment
- at least one approved “baseline” scenario that founders agree represents the intended pilot default

## 6. Recommended Calibration Loop

For each real imported snapshot:

1. run `pnpm calibrate:snapshot <snapshotId>`
2. record the largest deltas
3. decide whether the issue is:
   - bad source mapping,
   - bad baseline defaults,
   - bad threshold assumptions,
   - or a true business anomaly
4. adjust baseline ruleset values
5. rerun the calibration report
6. stop when deltas are acceptable enough for founder review

## 7. Best Next Calibration Tasks

The next calibration tasks should be:

1. import one real historical member-month snapshot
2. run the calibration report against that snapshot
3. tune:
   - `cashout_min_usd`
   - windowed cash-out factors
   - treasury inflow capture assumptions
   - concentration thresholds
4. save the tuned baseline model as the next explicit model version if needed

## 8. Recommendation

Do not treat the current sample calibration result as founder-ready tokenomics guidance.

Treat it as:

`proof that the simulator can now be calibrated against imported data, plus evidence of where the current baseline defaults are still too rough`
