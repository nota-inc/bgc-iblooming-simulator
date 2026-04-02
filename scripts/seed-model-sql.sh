#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${BGC_DB_CONTAINER_NAME:-bgc-alpha-postgres}"
DB_NAME="${BGC_DB_NAME:-bgc_alpha_simulator}"
DB_USER="${BGC_DB_USER:-postgres}"

RULESET_JSON='{"version":"model-v1","summary":"Executable Phase 1 baseline model using imported member-month facts.","lockedAssumptions":["affiliate-membership-fiat-only","100-pc-equals-1-usd","1-sp-equals-1-usd-reward-basis","alpha-phase-1-internal-non-transferable"],"openQuestions":["cashout-baseline-mode","phase-1-sink-scope"],"defaults":{"k_pc":1,"k_sp":1,"reward_global_factor":1,"reward_pool_factor":1,"cap_user_monthly":2500,"cap_group_monthly":25000,"sink_target":0.3,"cashout_mode":"WINDOWS","cashout_min_usd":25,"cashout_fee_bps":150,"cashout_windows_per_year":4,"cashout_window_days":7},"conversionRules":{"pc_units_per_alpha":100,"sp_units_per_alpha":10,"pc_alpha_weight":1,"sp_alpha_weight":1,"active_member_multiplier":1,"inactive_member_multiplier":0.7},"rewardRules":{"global_reward_weight":1,"pool_reward_weight":1},"capRules":{"minimum_user_monthly_cap":50,"minimum_group_monthly_cap":250},"sinkRules":{"baseline_sink_target":0.3,"spend_release_factor":1,"max_spend_share":0.95},"cashoutRules":{"always_open_release_factor":1,"windowed_release_factor":0.72,"min_window_coverage_ratio":0.35,"fee_retention_factor":1},"treasuryRules":{"reserve_buffer_months":9,"inflow_capture_rate":0.85},"recommendationThresholds":{"payout_inflow_warning":1,"payout_inflow_critical":1.15,"reserve_runway_warning":6,"reserve_runway_critical":3,"reward_concentration_warning":55,"reward_concentration_critical":70},"strategicKpiAssumptions":{"score_thresholds":{"candidate":70,"risky":45},"revenue":{"recognized_revenue_inflow_weight":0.12,"gross_margin_inflow_weight":0.18,"proxy_revenue_capture_rate":0.8,"target_revenue_per_active_member":60,"target_cross_app_share_pct":35},"ops_cost":{"automation_coverage_score":35,"target_cost_to_serve_index":65,"cashout_ops_penalty_weight":0.6},"tax":{"legal_readiness_score":25,"compliance_structure_score":35,"target_tax_event_reduction_pct":70},"affiliate":{"affiliate_member_multiplier":1.04,"target_activation_rate_pct":70,"target_retention_rate_pct":55,"target_productivity_share_pct":30},"active_user":{"new_member_multiplier":1.05,"reactivated_member_multiplier":1.03,"cross_app_active_multiplier":1.02,"target_retention_rate_pct":60,"target_cross_app_share_pct":30}}}'

docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" <<SQL
INSERT INTO "BaselineModelVersion" ("id", "versionName", "description", "status", "rulesetJson", "createdAt")
VALUES (
  'model_model_v1',
  'model-v1',
  'Executable Phase 1 baseline model using imported member-month facts.',
  'ACTIVE',
  '${RULESET_JSON}'::jsonb,
  NOW()
)
ON CONFLICT ("versionName") DO UPDATE SET
  "description" = EXCLUDED."description",
  "status" = EXCLUDED."status",
  "rulesetJson" = EXCLUDED."rulesetJson";
SQL

echo "Seeded baseline model model-v1."
