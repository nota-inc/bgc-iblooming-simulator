# BGC Source Bundle To Simulator Mapping

This mapping converts the raw BGC/iBLOOMING exports in the workspace root into the simulator's canonical `member-month` CSV contract.

The current bundle uses 9 raw inputs: the original 7 operational CSVs, the monthly aggregate `Copy of SIMULATION SHEETS v0.1 - PARAMS.csv` top-up file, and the `Copy of SIMULATION SHEETS v0.1 - DATA_AGG.csv` aggregate override file.

## Generated Output

- Canonical file: `examples/bgc-source-bundle-canonical.csv`
- Builder script: `scripts/build-bgc-source-bundle.ts`
- Verifier script: `scripts/verify-bgc-source-bundle.ts`

Run it with:

```bash
pnpm snapshot:build-bgc-bundle
pnpm snapshot:verify-bgc-bundle
```

Optional arguments:

```bash
pnpm snapshot:build-bgc-bundle -- --input-dir "/path/to/folder" --output "/path/to/output.csv"
```

## Source Mapping

### `2024 Global Profit Sharing from Turnover - Sheet1.csv`

- This sheet is summary-level only and does not contain member IDs.
- The converter expands each level count into synthetic members at period `2024-12`.
- `global_reward_usd` uses the published bonus-per-member figure.
- `sp_reward_basis` is proxied as `global_reward_usd * 10` to stay aligned with the simulator's current `sp_units_per_alpha = 10` baseline.

### `2025 1st Half Global Profit Sharing from Turnover - Sheet1.csv`

- Real member IDs are available in the half-year allocation section.
- Each listed member is imported at period `2025-06`.
- `global_reward_usd` uses the sheet's `a Share of price` value.
- `sp_reward_basis` is proxied as `global_reward_usd * 10`.

### `BGC New & Upgrade Affiliates - Upgrade.csv`

- This file contributes BGC-side member activity, tier, and affiliate status by month.
- Rows are merged into the same canonical `bgc` member-month key used by the global-profit sheets.
- The unlabeled trailing numeric columns are ignored because their meaning is not stable across the file and they are blank for most rows.

### `Copy of BGC New & Upgrade Affiliates - Newly Joined.csv`

- This file is now the primary source for explicit `member_join_period` on new BGC affiliates.
- Rows are imported as `bgc` member-month activity using the join month.
- `recognized_revenue_usd` uses the per-level join value shown in the sixth column.
- `member_tier`, `active_member`, and `is_affiliate` are set directly from this file.
- The latest copy export also carries named monthly summary columns; those are preserved in `extra_json` when present so the canonical bundle retains the sheet's month-total context without double-counting revenue.
- The unlabeled trailing summary columns are ignored.

### `CP Videos Sold - Sheet1.csv`

- Imported as `iblooming` member-month activity.
- `sink_spend_usd` and `recognized_revenue_usd` use sale price.
- `gross_margin_usd` uses `iBlooming Profit`.
- The file only exposes buyer names, not BGC IDs.
- The converter attempts to resolve names to BGC IDs using the upgrade and WEP files.
- Unmatched names are kept as stable synthetic member keys so the transactions still remain importable.

### `WEP - World Executive Program Application Form (Responses) - Form Responses 1.csv`

- Treated as iBLOOMING-side activity/start signals.
- Only the first confirmed application month is kept per member.
- These rows carry activity and join-period hints but no direct revenue or reward amounts.

### `iMatrix Records - Sheet1.csv`

- This sheet is monthly aggregate revenue, not member-level data.
- The converter creates synthetic aggregate rows per product line and month.
- `recognized_revenue_usd` and `sink_spend_usd` use total amount.
- `pool_reward_usd` uses `Global Pool CP`.
- `sp_reward_basis` is proxied as `pool_reward_usd * 10`.
- These rows stay synthetic because the source file has no member IDs.

### `Copy of SIMULATION SHEETS v0.1 - PARAMS.csv`

- This sheet is monthly aggregate data, not member-level data.
- The converter reads monthly totals from the left and right blocks, then computes a per-month gap against the already observed 7-file bundle.
- Any positive gap is distributed across the proxy member layout from `examples/params-tab-simulator-proxy-10-member.csv`.
- `pc_volume` uses `PC Issued`.
- `global_reward_usd` uses `GPSP(15%) US$`.
- `pool_reward_usd` uses `WEC 3% US$` only through `2025-03`; later months are forced to `0` because the middle block changes meaning and is no longer month-aligned.
- `sp_reward_basis` is proxied as `(global_reward_usd + pool_reward_usd) * 10`.
- `cashout_usd` is proxied as `(global_reward_usd + pool_reward_usd) * cashout_rate`.
- `sink_spend_usd` uses `PC Spent / PC_UNIT`, with `PC_UNIT = 100` from the sheet.
- `recognized_revenue_usd` uses `Entry Fee USD Total` where the right-side monthly block still provides it.

### `Copy of SIMULATION SHEETS v0.1 - DATA_AGG.csv`

- This sheet provides authoritative monthly aggregate totals: `Total_PC`, `Total_SP`, `Rewards_USD`, `Cashout_USD`, `Active_Members`, and `EntryFee_USD_from_PC`.
- After PARAMS metrics are parsed, DATA_AGG metrics are merged in: where DATA_AGG provides non-zero values they override PARAMS for `pcVolume`, `spRewardBasis`, `globalRewardUsd`, `cashoutUsd`, `recognizedRevenueUsd`, and `grossMarginUsd`.
- `poolRewardUsd` and `sinkSpendUsd` are preserved from PARAMS since DATA_AGG does not break these out separately.
- Future placeholder months (all zeros) in DATA_AGG are skipped.
- The merged aggregate totals are then used to compute the per-month gap for the proxy member top-up step.
- `gross_margin_usd` is proxied as `35%` of recognized revenue.

## Canonical Field Policy

- `source_system`: normalized to `bgc` or `iblooming` so the simulator's cross-app logic stays ecosystem-level.
- `member_join_period`: taken from `Newly Joined` where available, otherwise backfilled to the earliest observed active period for the member inside this bundle.
- `is_affiliate`: propagated to all active rows for members that appear in BGC affiliate exports.
- `cross_app_active`: set when the same member is observed in both `bgc` and `iblooming` after identity resolution.
- `extra_json`: stores row provenance, including raw source file and source-category tags, so simulator imports can preserve which of the 9 CSV categories fed each canonical row. PARAMS proxy rows now carry both `params_monthly_topup` and `data_agg_monthly_override` when DATA_AGG contributes to that month.

## Known Limits

- `pc_volume`, `recognized_revenue_usd`, and `sink_spend_usd` are now backfilled from `PARAMS` where that sheet exposes the right-side monthly block. In the downloaded file, that block is populated through `2025-06`; later months stay `0` unless another source provides them.
- `global_reward_usd`, `sp_reward_basis`, and `cashout_usd` are now backfilled from `PARAMS` through the monthly left-side series, which continues through `2025-09` in the downloaded file.
- 2024 global profit, iMatrix, and PARAMS are still partial proxies because those sources are aggregate summaries rather than native member-month exports.
- CP identity resolution is only as good as the name matching that can be inferred from the other files.
