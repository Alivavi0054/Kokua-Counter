export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "student" | "eatery" | "admin";
export type ContributionStatus = "pending" | "completed" | "failed" | "refunded";
export type QrStatus = "active" | "redeemed" | "expired" | "cancelled";
export type RedemptionStatus = "completed" | "reversed";
export type RefundStatus = "requested" | "pending" | "succeeded" | "failed" | "canceled";
export type OpsEntryType =
  | "fee_charge"
  | "fee_refund"
  | "fee_refund_reversal"
  | "processor_fee"
  | "processor_fee_reversal"
  | "dispute_fee"
  | "dispute_fee_reversal";
export type SettlementStatus = "pending" | "processing" | "paid" | "failed";
export type PoolEntryType =
  | "credit"
  | "hold"
  | "release"
  | "redemption"
  | "refund"
  | "refund_reversal";

export type Database = {
  public: {
    Tables: {
      _migrations_applied: {
        Row: {
          id: number;
          file_name: string;
          applied_at: string;
        };
        Insert: {
          file_name: string;
          applied_at?: string;
        };
        Update: {
          file_name?: string;
          applied_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          role: UserRole;
          display_name: string;
          public_alias: string | null;
          verified_school_domain: string | null;
          voucher_code_hash: string | null;
          voucher_region: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          display_name: string;
          public_alias?: string | null;
          verified_school_domain?: string | null;
          voucher_code_hash?: string | null;
          voucher_region?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: UserRole;
          display_name?: string;
          public_alias?: string | null;
          verified_school_domain?: string | null;
          voucher_code_hash?: string | null;
          voucher_region?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      eateries: {
        Row: {
          id: string;
          owner_user_id: string;
          name: string;
          slug: string;
          address: string;
          island: string;
          contact_email: string;
          stripe_connect_account_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          name: string;
          slug: string;
          address: string;
          island: string;
          contact_email: string;
          stripe_connect_account_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_user_id?: string;
          name?: string;
          slug?: string;
          address?: string;
          island?: string;
          contact_email?: string;
          stripe_connect_account_id?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      contributions: {
        Row: {
          id: string;
          donor_user_id: string | null;
          amount_cents: number;
          meal_credit_count: number;
          currency: "usd";
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          status: ContributionStatus;
          is_anonymous: boolean;
          refunded_amount_cents: number;
          fee_rate_bps: number;
          operational_fee_cents: number;
          total_charged_cents: number;
          fee_refunded_cents: number;
          client_request_key: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          donor_user_id?: string | null;
          amount_cents: number;
          currency?: "usd";
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          status?: ContributionStatus;
          is_anonymous?: boolean;
          refunded_amount_cents?: number;
          fee_rate_bps?: number;
          operational_fee_cents?: number;
          fee_refunded_cents?: number;
          client_request_key?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          donor_user_id?: string | null;
          amount_cents?: number;
          currency?: "usd";
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          status?: ContributionStatus;
          is_anonymous?: boolean;
          refunded_amount_cents?: number;
          fee_rate_bps?: number;
          operational_fee_cents?: number;
          fee_refunded_cents?: number;
          client_request_key?: string | null;
          failure_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pool_ledger: {
        Row: {
          id: string;
          entry_type: PoolEntryType;
          amount_cents: number;
          contribution_id: string | null;
          qr_code_id: string | null;
          redemption_id: string | null;
          reference_key: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          entry_type: PoolEntryType;
          amount_cents: number;
          contribution_id?: string | null;
          qr_code_id?: string | null;
          redemption_id?: string | null;
          reference_key?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      qr_codes: {
        Row: {
          id: string;
          student_user_id: string;
          token_hash: string;
          meal_value_cents: number;
          status: QrStatus;
          created_at: string;
          expires_at: string;
          redeemed_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          student_user_id: string;
          token_hash: string;
          meal_value_cents?: number;
          status?: QrStatus;
          created_at?: string;
          expires_at: string;
          redeemed_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          student_user_id?: string;
          token_hash?: string;
          meal_value_cents?: number;
          status?: QrStatus;
          expires_at?: string;
          redeemed_at?: string | null;
          cancelled_at?: string | null;
        };
        Relationships: [];
      };
      redemptions: {
        Row: {
          id: string;
          qr_code_id: string;
          student_user_id: string;
          eatery_id: string;
          amount_cents: number;
          status: RedemptionStatus;
          redeemed_at: string;
          reversed_at: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          qr_code_id: string;
          student_user_id: string;
          eatery_id: string;
          amount_cents?: number;
          status?: RedemptionStatus;
          redeemed_at?: string;
          reversed_at?: string | null;
          metadata?: Json | null;
        };
        Update: {
          qr_code_id?: string;
          student_user_id?: string;
          eatery_id?: string;
          amount_cents?: number;
          status?: RedemptionStatus;
          redeemed_at?: string;
          reversed_at?: string | null;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      settlements: {
        Row: {
          id: string;
          eatery_id: string;
          amount_cents: number;
          period_start: string;
          period_end: string;
          stripe_transfer_id: string | null;
          stripe_payout_id: string | null;
          status: SettlementStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          eatery_id: string;
          amount_cents: number;
          period_start: string;
          period_end: string;
          stripe_transfer_id?: string | null;
          stripe_payout_id?: string | null;
          status?: SettlementStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          eatery_id?: string;
          amount_cents?: number;
          period_start?: string;
          period_end?: string;
          stripe_transfer_id?: string | null;
          stripe_payout_id?: string | null;
          status?: SettlementStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      fee_settings: {
        Row: {
          id: string;
          rate_bps: number;
          effective_at: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rate_bps: number;
          effective_at?: string;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      refunds: {
        Row: {
          id: string;
          contribution_id: string;
          source: "admin" | "external";
          status: RefundStatus;
          amount_cents: number;
          principal_cents: number;
          fee_cents: number;
          currency: string;
          reason: string | null;
          requested_by: string | null;
          idempotency_ref: string | null;
          stripe_refund_id: string | null;
          failure_code: string | null;
          failure_detail: string | null;
          recovery_obligation_cents: number;
          requested_at: string;
          completed_at: string | null;
          reversed_at: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          contribution_id: string;
          stripe_dispute_id: string;
          status: "open" | "won" | "lost";
          amount_cents: number;
          principal_cents: number;
          fee_cents: number;
          dispute_fee_cents: number;
          recovery_obligation_cents: number;
          reason: string | null;
          stripe_status: string | null;
          opened_at: string;
          closed_at: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      operations_ledger: {
        Row: {
          id: string;
          entry_type: OpsEntryType;
          amount_cents: number;
          contribution_id: string;
          refund_id: string | null;
          dispute_id: string | null;
          reference_key: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          actor_user_id: string;
          action: string;
          target_type: string | null;
          target_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          actor_user_id: string;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          details?: Json | null;
        };
        Update: never;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          mission: string | null;
          contact_name: string;
          email: string;
          phone: string | null;
          city: string | null;
          state: string | null;
          website: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          mission?: string | null;
          contact_name: string;
          email: string;
          phone?: string | null;
          city?: string | null;
          state?: string | null;
          website?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          mission?: string | null;
          contact_name?: string;
          email?: string;
          phone?: string | null;
          city?: string | null;
          state?: string | null;
          website?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_registrations: {
        Row: {
          id: string;
          school_name: string;
          contact_name: string;
          email: string;
          phone: string | null;
          school_type: string | null;
          students: string | null;
          city: string | null;
          state: string | null;
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_name: string;
          contact_name: string;
          email: string;
          phone?: string | null;
          school_type?: string | null;
          students?: string | null;
          city?: string | null;
          state?: string | null;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          school_name?: string;
          contact_name?: string;
          email?: string;
          phone?: string | null;
          school_type?: string | null;
          students?: string | null;
          city?: string | null;
          state?: string | null;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      pool_balance: {
        Row: { available_balance_cents: number };
        Relationships: [];
      };
      public_eateries: {
        Row: {
          name: string;
          slug: string;
          island: string;
          address: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_pool_balance: { Args: Record<PropertyKey, never>; Returns: number };
      record_credit: {
        Args: {
          p_contribution_id: string;
          p_checkout_session_id: string;
          p_payment_intent_id: string;
          p_amount_total_cents?: number | null;
        };
        Returns: undefined;
      };
      record_refund: {
        Args: {
          p_contribution_id: string;
          p_stripe_refund_id: string;
          p_amount_cents: number;
          p_internal_refund_id?: string | null;
          p_provider_status?: "pending" | "succeeded";
        };
        Returns: undefined;
      };
      create_contribution: {
        Args: {
          p_donor_user_id: string | null;
          p_principal_cents: number;
          p_is_anonymous: boolean;
          p_client_request_key?: string | null;
        };
        Returns: Json;
      };
      current_fee_rate_bps: { Args: { p_at?: string }; Returns: number };
      set_operational_fee_rate: {
        Args: { p_rate_bps: number; p_effective_at: string | null; p_created_by: string; p_note?: string | null };
        Returns: Json;
      };
      reserve_refund: {
        Args: {
          p_contribution_id: string;
          p_amount_cents: number | null;
          p_reason: string | null;
          p_requested_by: string;
          p_idempotency_ref?: string | null;
        };
        Returns: Json;
      };
      mark_refund_submitted: {
        Args: { p_refund_id: string; p_stripe_refund_id: string };
        Returns: undefined;
      };
      mark_refund_failed: {
        Args: { p_refund_id: string; p_failure_code: string; p_failure_detail?: string | null };
        Returns: undefined;
      };
      record_processor_fee: {
        Args: {
          p_contribution_id: string;
          p_payment_intent_id: string;
          p_fee_cents: number;
          p_balance_transaction_id?: string | null;
        };
        Returns: undefined;
      };
      record_dispute_opened: {
        Args: {
          p_contribution_id: string;
          p_stripe_dispute_id: string;
          p_amount_cents: number;
          p_reason: string | null;
          p_stripe_status: string | null;
          p_dispute_fee_cents?: number;
        };
        Returns: undefined;
      };
      record_dispute_closed: {
        Args: { p_stripe_dispute_id: string; p_outcome: "won" | "lost"; p_dispute_fee_cents?: number | null };
        Returns: undefined;
      };
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_ms: number };
        Returns: Json;
      };
      claim_receipt_email: { Args: { p_contribution_id: string }; Returns: boolean };
      release_receipt_email: { Args: { p_contribution_id: string }; Returns: undefined };
      finance_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      finance_reconciliation: { Args: Record<PropertyKey, never>; Returns: Json };
      contributions_missing_processor_fee: {
        Args: { p_limit?: number };
        Returns: Array<{ contribution_id: string; payment_intent_id: string }>;
      };
      record_refund_reversal: {
        Args: { p_stripe_refund_id: string };
        Returns: undefined;
      };
      create_qr_hold: {
        Args: {
          p_student_id: string;
          p_token_hash: string;
          p_expires_at: string;
          p_meals_per_day: number;
          p_passes_generated_per_day: number;
          p_qr_ttl_minutes: number;
          p_now?: string;
        };
        Returns: Json;
      };
      release_expired_qr: {
        Args: { p_qr_id: string };
        Returns: undefined;
      };
      expire_stale_qrs: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      redeem_qr: {
        Args: {
          p_token_hash: string;
          p_eatery_user_id: string;
          p_eatery_daily_limit: number;
          p_now?: string;
        };
        Returns: Json;
      };
      cancel_qr: {
        Args: { p_qr_id: string; p_student_user_id: string };
        Returns: Json;
      };
      health_check: { Args: Record<PropertyKey, never>; Returns: Json };
      create_student_profile: {
        Args: { p_user_id: string; p_display_name: string };
        Returns: Json;
      };
      create_settlement: {
        Args: { p_eatery_id: string; p_now?: string };
        Returns: Json;
      };
      mark_settlement_result: {
        Args: {
          p_settlement_id: string;
          p_status: SettlementStatus;
          p_stripe_transfer_id?: string | null;
          p_stripe_payout_id?: string | null;
        };
        Returns: undefined;
      };
      record_qr_scan_failure: {
        Args: { p_eatery_user_id: string; p_now?: string };
        Returns: boolean;
      };
    };
  };
};
