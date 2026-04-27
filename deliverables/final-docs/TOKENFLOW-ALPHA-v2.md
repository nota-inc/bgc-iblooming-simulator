# ALPHA Token Flow v2

Status: Simulation-backed revision draft  
Date: 2026-04-16  
Document type: Phase 1 token-flow and policy mechanics draft  
Simulation basis: one approved snapshot and four standard completed scenarios only  
Related basis memo: [SIMULATION-BASIS-ALPHA-v2.md](./SIMULATION-BASIS-ALPHA-v2.md)

## 1. Token Flow Objective

Token Flow v2 should define how value moves through the Phase 1 `ALPHA` system without pretending that the final pilot parameters have already been approved.

Its purpose is to specify:

- the economic input signals
- the issuance logic
- the control levers
- the spend / hold / cash-out mechanics
- and the policy envelope currently tested by the four standard scenarios

## 2. Phase 1 Flow Statement

The Phase 1 flow remains:

`Business Activity -> PC / SP -> ALPHA Issuance -> Spend / Hold / Controlled Cash-Out -> Treasury Accounting -> Milestone Review`

This means:

- `PC` and `SP` remain the source signals
- `ALPHA` is the internal settlement layer
- spend, hold, and cash-out are policy outcomes, not free-market outcomes
- treasury pressure and fairness concentration are hard control gates

## 3. Input Fields Used By The Engine

The engine reads these core inputs per member-month:

- `pcVolume`
- `spRewardBasis`
- `globalRewardUsd`
- `poolRewardUsd`
- `cashoutUsd`
- `sinkSpendUsd`
- `activeMember`

When available, the engine also uses:

- `recognizedRevenueUsd`
- `grossMarginUsd`
- `memberJoinPeriod`
- `isAffiliate`
- `crossAppActive`

All current v2 conclusions are based on the approved snapshot:

- `BGC canonical bundle v3 with DATA_AGG`
- `2,127` imported facts
- coverage from April 1, 2024 to January 31, 2026

## 4. Issuance Formula

Under `model-v1`, raw issuance is:

`rawIssued = ((pcVolume / 100) * k_pc + (spRewardBasis / 10) * k_sp) * activityMultiplier`

Where:

- `100 PC` is treated as one USD-equivalent basis
- `10 SP` becomes the base ALPHA conversion unit before the scenario coefficient
- activity multiplier is `1.0` for active members and `0.7` for inactive members

Additional strategic multipliers may apply for:

- affiliate members
- new members
- reactivated members
- cross-app active members

## 5. Standard Parameter Envelope

The four standard scenarios define the current tested token-flow envelope:

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

This is the tested local range that Token Flow v2 should document.

## 6. Spend, Hold, And Cash-Out Outcomes

| Scenario | ALPHA Issued | ALPHA Spent | ALPHA Held | Cash-Out Eq. | Sink Utilization |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 1,325,912.96 | 432,305.55 | 437,219.10 | 456,388.32 | 32.60% |
| Conservative | 812,048.79 | 288,561.30 | 347,143.87 | 176,343.62 | 35.53% |
| Growth | 1,878,186.01 | 544,986.56 | 564,224.97 | 768,974.49 | 29.02% |
| Stress | 567,419.51 | 185,262.69 | 283,024.81 | 99,132.01 | 32.65% |

Interpretation:

- `Growth` maximizes issuance and spend, but also creates the largest cash-out equivalent.
- `Conservative` lowers issuance and cash-out materially while maintaining the best sink utilization of the four.
- `Stress` suppresses issuance and cash-out most strongly, but at lower growth quality.
- `Baseline` remains the reference configuration, but it does not solve concentration.

## 7. Treasury And Fairness Readout

| Scenario | Treasury Pressure | Reserve Runway | Top 10% Reward Share | Verdict |
| --- | ---: | ---: | ---: | --- |
| Baseline | 0.19x | 24 | 88.47% | `risky` |
| Conservative | 0.15x | 24 | 85.46% | `risky` |
| Growth | 0.22x | 24 | 90.60% | `risky` |
| Stress | 0.13x | 24 | 81.08% | `risky` |

Important implication:

- the standard envelope does not currently fail on treasury exhaustion
- the standard envelope fails on fairness concentration

So Token Flow v2 should not imply that the current standard parameter set is already deployable.

## 8. Mechanical Reading By Scenario

### Baseline

- the closest to a normal operating posture
- balanced across issuance, spend, hold, and cash-out
- still too concentrated to approve

### Conservative

- tighter caps, higher fees, fewer windows
- materially lower issuance and cash-out than Baseline
- still not enough fairness improvement

### Growth

- strongest upside profile
- loosest effective release posture
- worst concentration and highest cash-out equivalent

### Stress

- lowest issuance and lowest treasury pressure
- functions as a defensive downside test
- still fails concentration, so safety alone is not sufficient

## 9. What Token Flow v2 Should Finalize

Token Flow v2 should finalize:

- the source signals: `PC` and `SP`
- the issuance logic
- the cap logic
- the spend-release logic
- the cash-out control logic
- the treasury accounting logic
- the milestone-governed review loop

Token Flow v2 should **not** finalize:

- one production parameter set from the current standard four
- a claim that fairness is solved
- a claim that the current standard sink posture is already mature enough

## 10. The Correct v2 Conclusion

The correct Token Flow v2 conclusion is:

`The current one-snapshot/four-scenario comparison is sufficient to define the ALPHA flow mechanics and the tested policy envelope, but it is not yet sufficient to lock the final pilot parameter set because reward concentration remains above the model threshold in every standard scenario.`

That conclusion keeps Token Flow defensible and aligned with the simulator rather than overstating readiness.
