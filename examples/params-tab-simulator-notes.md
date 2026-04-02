# PARAMS Tab To Simulator Mapping

This conversion is a proxy import built from the Google Sheet `PARAMS` tab. The source tab is monthly aggregate data, not member-month data, so it cannot be imported directly into the simulator without reconstruction.

## Files

- `params-tab-simulator-aggregate.csv`: 1 synthetic aggregate member per month.
- `params-tab-simulator-proxy-10-member.csv`: 10 synthetic persistent members per month, weighted to preserve distribution and make concentration metrics more usable.

## Mapping Rules

- `period_key`: monthly key from the tab.
- `pc_volume`: mapped from `PC Issued`.
- `global_reward_usd`: mapped from `GPSP(15%) US$`.
- `pool_reward_usd`: mapped from `WEC 3% US$` only where the tab still exposes that aligned monthly series (`2024-04` to `2025-03`). Later periods are set to `0` because the middle block changes meaning and is not month-aligned.
- `sp_reward_basis`: proxy = `(global_reward_usd + pool_reward_usd) * 10`. This is chosen to match the simulator's current `sp_units_per_alpha = 10` baseline.
- `cashout_usd`: proxy = `(global_reward_usd + pool_reward_usd) * cashout_rate`, using `cashout_rate = 1` from the PARAMS tab.
- `sink_spend_usd`: mapped from `PC Spent / 100`, because the tab tracks PC in `PC_UNIT = 100`.
- `recognized_revenue_usd`: mapped from `Entry Fee USD Total` when available, otherwise `0`.
- `gross_margin_usd`: proxy = `35%` of recognized revenue because the PARAMS tab does not provide gross margin directly.

## Important Limits

- This is not real member-level data.
- Referral and pool blocks shown in the middle section after `2025-04` are not reliably month-aligned with the left and right monthly blocks, so they are not imported as direct monthly pool rewards.
- Use the proxy 10-member file for simulator testing. Use the aggregate file only for sanity checks.
