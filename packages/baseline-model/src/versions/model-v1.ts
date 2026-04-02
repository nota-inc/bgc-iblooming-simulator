export type BaselineCashoutMode = "WINDOWS" | "ALWAYS_OPEN";

export type RecommendationThresholds = {
  payout_inflow_warning: number;
  payout_inflow_critical: number;
  reserve_runway_warning: number;
  reserve_runway_critical: number;
  reward_concentration_warning: number;
  reward_concentration_critical: number;
};

export type StrategicKpiScoreThresholds = {
  candidate: number;
  risky: number;
};

export type StrategicKpiAssumptions = {
  score_thresholds: StrategicKpiScoreThresholds;
  revenue: {
    recognized_revenue_inflow_weight: number;
    gross_margin_inflow_weight: number;
    proxy_revenue_capture_rate: number;
    target_revenue_per_active_member: number;
    target_cross_app_share_pct: number;
  };
  ops_cost: {
    automation_coverage_score: number;
    target_cost_to_serve_index: number;
    cashout_ops_penalty_weight: number;
  };
  tax: {
    legal_readiness_score: number;
    compliance_structure_score: number;
    target_tax_event_reduction_pct: number;
  };
  affiliate: {
    affiliate_member_multiplier: number;
    target_activation_rate_pct: number;
    target_retention_rate_pct: number;
    target_productivity_share_pct: number;
  };
  active_user: {
    new_member_multiplier: number;
    reactivated_member_multiplier: number;
    cross_app_active_multiplier: number;
    target_retention_rate_pct: number;
    target_cross_app_share_pct: number;
  };
};

export type BaselineModelRuleset = {
  version: string;
  summary: string;
  lockedAssumptions: string[];
  openQuestions: string[];
  defaults: {
    k_pc: number;
    k_sp: number;
    reward_global_factor: number;
    reward_pool_factor: number;
    cap_user_monthly: number;
    cap_group_monthly: number;
    sink_target: number;
    cashout_mode: BaselineCashoutMode;
    cashout_min_usd: number;
    cashout_fee_bps: number;
    cashout_windows_per_year: number;
    cashout_window_days: number;
  };
  conversionRules: {
    pc_units_per_alpha: number;
    sp_units_per_alpha: number;
    pc_alpha_weight: number;
    sp_alpha_weight: number;
    active_member_multiplier: number;
    inactive_member_multiplier: number;
  };
  rewardRules: {
    global_reward_weight: number;
    pool_reward_weight: number;
  };
  capRules: {
    minimum_user_monthly_cap: number;
    minimum_group_monthly_cap: number;
  };
  sinkRules: {
    baseline_sink_target: number;
    spend_release_factor: number;
    max_spend_share: number;
  };
  cashoutRules: {
    always_open_release_factor: number;
    windowed_release_factor: number;
    min_window_coverage_ratio: number;
    fee_retention_factor: number;
  };
  treasuryRules: {
    reserve_buffer_months: number;
    inflow_capture_rate: number;
  };
  recommendationThresholds: RecommendationThresholds;
  strategicKpiAssumptions: StrategicKpiAssumptions;
};

export const modelV1: BaselineModelRuleset = {
  version: "model-v1",
  summary: "Executable Phase 1 baseline model using imported member-month facts.",
  lockedAssumptions: [
    "affiliate-membership-fiat-only",
    "100-pc-equals-1-usd",
    "1-sp-equals-1-usd-reward-basis",
    "alpha-phase-1-internal-non-transferable"
  ],
  openQuestions: ["cashout-baseline-mode", "phase-1-sink-scope"],
  defaults: {
    k_pc: 1,
    k_sp: 1,
    reward_global_factor: 1,
    reward_pool_factor: 1,
    cap_user_monthly: 2500,
    cap_group_monthly: 25000,
    sink_target: 0.3,
    cashout_mode: "WINDOWS",
    cashout_min_usd: 25,
    cashout_fee_bps: 150,
    cashout_windows_per_year: 4,
    cashout_window_days: 7
  },
  conversionRules: {
    pc_units_per_alpha: 100,
    sp_units_per_alpha: 10,
    pc_alpha_weight: 1,
    sp_alpha_weight: 1,
    active_member_multiplier: 1,
    inactive_member_multiplier: 0.7
  },
  rewardRules: {
    global_reward_weight: 1,
    pool_reward_weight: 1
  },
  capRules: {
    minimum_user_monthly_cap: 50,
    minimum_group_monthly_cap: 250
  },
  sinkRules: {
    baseline_sink_target: 0.3,
    spend_release_factor: 1,
    max_spend_share: 0.95
  },
  cashoutRules: {
    always_open_release_factor: 1,
    windowed_release_factor: 0.72,
    min_window_coverage_ratio: 0.35,
    fee_retention_factor: 1
  },
  treasuryRules: {
    reserve_buffer_months: 9,
    inflow_capture_rate: 0.85
  },
  recommendationThresholds: {
    payout_inflow_warning: 1,
    payout_inflow_critical: 1.15,
    reserve_runway_warning: 6,
    reserve_runway_critical: 3,
    reward_concentration_warning: 55,
    reward_concentration_critical: 70
  },
  strategicKpiAssumptions: {
    score_thresholds: {
      candidate: 70,
      risky: 45
    },
    revenue: {
      recognized_revenue_inflow_weight: 0.12,
      gross_margin_inflow_weight: 0.18,
      proxy_revenue_capture_rate: 0.8,
      target_revenue_per_active_member: 60,
      target_cross_app_share_pct: 35
    },
    ops_cost: {
      automation_coverage_score: 35,
      target_cost_to_serve_index: 65,
      cashout_ops_penalty_weight: 0.6
    },
    tax: {
      legal_readiness_score: 25,
      compliance_structure_score: 35,
      target_tax_event_reduction_pct: 70
    },
    affiliate: {
      affiliate_member_multiplier: 1.04,
      target_activation_rate_pct: 70,
      target_retention_rate_pct: 55,
      target_productivity_share_pct: 30
    },
    active_user: {
      new_member_multiplier: 1.05,
      reactivated_member_multiplier: 1.03,
      cross_app_active_multiplier: 1.02,
      target_retention_rate_pct: 60,
      target_cross_app_share_pct: 30
    }
  }
};
