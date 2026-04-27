# ALPHA Simulation Basis v2

Status: Confirmed local basis for Whitepaper v2 and Token Flow v2  
Date: 2026-04-16  
Source of truth: local Postgres database confirmed on April 16, 2026  
Method: one approved snapshot, four completed standard scenario runs only  
Excluded from this basis: custom scenario runs, including `BGC v3 Candidate Fairness Floor`

## 1. Basis Selection

This v2 basis intentionally uses only:

- one existing approved snapshot judged to be the best current local dataset, and
- four standard scenarios: `Baseline`, `Conservative`, `Growth`, and `Stress`

The selected snapshot is:

- Snapshot ID: `cmnehc4470002qzk6bh9szmj8`
- Name: `BGC canonical bundle v3 with DATA_AGG`
- Approval date: `2026-03-31`
- Source systems: `bgc`, `iblooming`
- Coverage window: `2024-04-01` to `2026-01-31`
- Imported facts: `2,127`

This snapshot remains the best available basis because it is the latest approved canonical bundle and includes the most complete local BGC x iBLOOMING member-month fact set.

## 2. Standard Scenario Set

The four standard scenarios confirmed on this snapshot are:

| Template | Scenario Name | Scenario ID | Latest Completed Run ID | Completed At |
| --- | --- | --- | --- | --- |
| Baseline | `BGC v3 Baseline 24M` | `cmnehqkxl000eqzk6kydklkre` | `cmnei26pp000mqzk6g76r5nvi` | `2026-03-31 10:54:26 UTC` |
| Conservative | `BGC v3 Conservative 24M` | `cmnei7bwy000qqzk6qfl4eyjz` | `cmnei7ef3000uqzk6pcvxneln` | `2026-03-31 10:58:30 UTC` |
| Growth | `BGC v3 Growth 24M` | `cmneii6ih000yqzk6454xj9qn` | `cmneii8tg0012qzk6561oop7u` | `2026-03-31 11:06:57 UTC` |
| Stress | `BGC v3 Stress 24M` | `cmneimc6v0016qzk604i2sgvc` | `cmneiuyx5001iqzk6r1p3lakw` | `2026-03-31 11:16:49 UTC` |

## 3. Core Result Table

| Scenario | Verdict | Flags | ALPHA Issued | ALPHA Spent | ALPHA Held | Cash-Out Eq. | Treasury Pressure | Runway | Top 10% Reward Share |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | `risky` | `critical:reward_concentration_high` | 1,325,912.96 | 432,305.55 | 437,219.10 | 456,388.32 | 0.19x | 24 | 88.47% |
| Conservative | `risky` | `critical:reward_concentration_high` | 812,048.79 | 288,561.30 | 347,143.87 | 176,343.62 | 0.15x | 24 | 85.46% |
| Growth | `risky` | `critical:reward_concentration_high` | 1,878,186.01 | 544,986.56 | 564,224.97 | 768,974.49 | 0.22x | 24 | 90.60% |
| Stress | `risky` | `critical:reward_concentration_high` | 567,419.51 | 185,262.69 | 283,024.81 | 99,132.01 | 0.13x | 24 | 81.08% |

## 4. Strategic Objective Readout

| Scenario | Revenue Score | Ops Cost Score | Tax Score | Affiliate Score | Active-User Score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 71.17 | 45.20 | 49.11 | 100.00 | 86.73 |
| Conservative | 68.80 | 47.85 | 51.00 | 100.00 | 83.41 |
| Growth | 75.23 | 42.25 | 46.31 | 100.00 | 92.39 |
| Stress | 68.75 | 47.47 | 51.00 | 100.00 | 82.21 |

Interpretation against current `model-v1` thresholds:

- `Affiliate` remains the strongest result across the full set.
- `Active-user` support remains strong across the full set.
- `Revenue` is strongest in `Growth`, acceptable in `Baseline`, and softer in `Conservative` and `Stress`.
- `Ops cost` is not proven; only `Conservative` and `Stress` rise modestly within `risky` territory.
- `Tax` remains checklist-level and should not be treated as proven improvement.

## 5. What The Four Scenarios Actually Show

### Treasury is not the immediate blocker

All four standard scenarios remain well below the current critical treasury threshold:

- `payout_inflow_critical = 1.15`
- observed range = `0.13x` to `0.22x`

All four also remain at:

- `reserve_runway_months = 24`

So the system is not failing because the standard scenarios drain treasury too quickly.

### Fairness concentration is the actual blocker

All four scenarios fail the concentration gate:

- `reward_concentration_warning = 55`
- `reward_concentration_critical = 70`
- observed range = `81.08%` to `90.60%`

This is why every standard scenario remains `risky`.

### The trade-off envelope is clear

- `Growth` gives the strongest revenue and active-user scores, but it is also the highest on issuance, cash-out, treasury pressure, and concentration.
- `Baseline` is more balanced than `Growth`, but it still remains far above the fairness threshold.
- `Conservative` reduces issuance and cash-out materially, and slightly improves ops/tax signals, but concentration is still unacceptable.
- `Stress` is the safest on treasury pressure and the lowest on issuance, yet it still fails the concentration gate.

## 6. Standard Policy Envelope

The four standard scenarios establish the current local policy envelope:

| Parameter | Baseline | Conservative | Growth | Stress |
| --- | ---: | ---: | ---: | ---: |
| `k_pc` | 1.00 | 0.80 | 1.15 | 0.70 |
| `k_sp` | 1.00 | 0.80 | 1.15 | 0.75 |
| `reward_global_factor` | 1.00 | 0.85 | 1.15 | 0.72 |
| `reward_pool_factor` | 0.90 | 0.80 | 1.05 | 0.70 |
| `cap_user_monthly` | 2,500 | 1,800 | 3,200 | 1,300 |
| `cap_group_monthly` | 25,000 | 18,000 | 32,000 | 13,000 |
| `sink_target` | 0.32 | 0.40 | 0.24 | 0.50 |
| `cashout_fee_bps` | 150 | 250 | 100 | 350 |
| `cashout_min_usd` | 25 | 50 | 25 | 75 |
| `cashout_windows_per_year` | 4 | 2 | 6 | 1 |
| `cashout_window_days` | 7 | 5 | 7 | 4 |

## 7. Decision Implication For v2

This v2 basis does **not** support locking one of the four standard scenarios as the production pilot policy.

What it does support is:

- locking the best approved snapshot as the common evidence base
- locking the four standard scenarios as the comparison framework
- locking the decision gates for Whitepaper and Token Flow:
  - treasury pressure
  - reserve runway
  - reward concentration
  - controlled cash-out
- concluding that one more parameter revision pass is required before a standard-template policy is founder-ready

## 8. v2 Recommendation

Whitepaper v2 and Token Flow v2 should be finalized around this statement:

`ALPHA is validated as an internal settlement design direction, but the current four standard scenarios do not yet produce a founder-ready pilot policy because reward concentration remains above the model threshold in every case.`

That means:

- the concept is strong enough to document
- the mechanics are strong enough to describe
- the decision gates are strong enough to formalize
- but the final production policy still requires another fairness-focused tuning pass
