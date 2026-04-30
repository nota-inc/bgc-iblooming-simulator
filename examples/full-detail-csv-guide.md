# Full Detail CSV Guide

Use this format when a snapshot must make every Source Detail checklist available.

The file is still a normal CSV. Open it in a spreadsheet, fill one row per source-detail item, and leave columns blank when they do not apply to that row.

For the complete data dictionary, see `SNAPSHOT_DATA_DICTIONARY.md` in the repo root.

## Required idea

Every row must have `record_type`.

Supported values:

- `member`
- `member_alias`
- `role_history`
- `offer`
- `business_event`
- `pc_entry`
- `sp_entry`
- `reward_obligation`
- `pool_entry`
- `cashout_event`
- `qualification_window`
- `qualification_status`

For simple member identity, use one `member` row and fill `source_system`, `alias_key`, `alias_type`, and `confidence` on that same row. The engine will create the internal member and the source-system alias automatically.

Use a separate `member_alias` row only when one internal member has extra source-system IDs, for example one person has both a BGC ID and an iBlooming ID.

## Important fixed choices

Use uppercase values for Full Detail CSV.

- `source_system`: `BGC`, `IBLOOMING`
- `role_type`: `AFFILIATE_LEVEL`, `CP_STATUS`, `EXECUTIVE_CP_STATUS`, `WEC_STATUS`, `CROSS_APP_STATUS`
- `offer_type`: `BGC_AFFILIATE_JOIN`, `BGC_AFFILIATE_UPGRADE`, `BGC_PHYSICAL_PRODUCT`, `IB_CP_DIGITAL_PRODUCT`, `IB_GIM_PRODUCT`, `IB_IMATRIX_PRODUCT`
- `unit` and `threshold_unit`: `USD`, `PC`, `SP`, `COUNT`, `SHARE`
- `payment_method`: `FIAT`, `PC`, `ALPHA`, `MIXED`
- `business_event.event_type`: `AFFILIATE_JOINED`, `AFFILIATE_UPGRADED`, `PHYSICAL_PRODUCT_PURCHASED`, `CP_PRODUCT_SOLD`, `GIM_SIGNUP_COMPLETED`, `IMATRIX_PURCHASE_COMPLETED`, `REWARD_ACCRUED`, `POOL_FUNDED`, `POOL_DISTRIBUTED`, `QUALIFICATION_WINDOW_OPENED`, `QUALIFICATION_ACHIEVED`, `CASHOUT_REQUESTED`, `CASHOUT_APPROVED`, `CASHOUT_PAID`
- `cashout_event.event_type`: `REQUESTED`, `APPROVED`, `PAID`, `REJECTED`
- `reward_source_code`: `BGC_RR`, `BGC_GR`, `BGC_MIRACLE_CASH`, `BGC_GPSP`, `BGC_WEC_POOL`, `IB_LR`, `IB_MIRACLE_CASH`, `IB_CPR`, `IB_GRR`, `IB_IRR`, `IB_GPS`, `IB_GMP`, `IB_GEC`
- `distribution_cycle`: `EVENT_BASED`, `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `YEARLY`, `ADHOC`
- `obligation_status`: `ACCRUED`, `ELIGIBLE`, `DISTRIBUTED`, `CANCELLED`
- `pool_code`: `BGC_GPSP_MONTHLY_POOL`, `BGC_WEC_QUARTERLY_POOL`, `IB_GPS_SEMIANNUAL_POOL`, `IB_WEC_USER_MONTHLY_POOL`, `IB_GMP_MONTHLY_POOL`, `IB_GEC_INTERNAL_POOL`
- `qualification_type`: `WEC_60_DAY`, `CPR_YEAR_1`, `CPR_YEAR_2`, `EXECUTIVE_CP_APPOINTMENT`, `POOL_RECIPIENT_SNAPSHOT`
- `qualification_status.status`: `OPEN`, `ELIGIBLE`, `ACHIEVED`, `ACTIVE`, `EXPIRED`, `CANCELLED`

## Minimum rows for all-green Source Detail

- Member history: at least one `member` row with source alias fields filled, plus one `role_history`
- Business events: at least one `business_event`
- Reward details: at least one `reward_obligation`, `pc_entry`, and `sp_entry`
- Pool details: at least one `pool_entry`
- Cash-out details: at least one `cashout_event`
- Qualification windows: at least one `qualification_window` and `qualification_status`
- Monthly simulation rows: derived automatically from the detail rows above

For product sales, fill `cash_in_usd`, `internal_credit_spent_usd`, and `payment_method` when possible. This lets the engine separate new fiat cash from PC/ALPHA usage.

## Example

Use `examples/full-detail-csv-template.csv` for a blank template.

Use `examples/full-detail-csv-glossary.csv` as the column legend.

Use `examples/sample-source-detail-all-green.csv` or `examples/sample-24m-bgc-iblooming-full-detail.csv` as filled examples.
