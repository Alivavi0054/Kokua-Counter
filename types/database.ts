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
          display_name?: string;
          public_alias?: string | null;
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
        };
        Update: {
          name?: string;
          address?: string;
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
          donor_email: string | null;
          is_anonymous: boolean;
          refunded_amount_cents: number;
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
          donor_email?: string | null;
          is_anonymous?: boolean;
          refunded_amount_cents?: number;
        };
        Update: {
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          status?: ContributionStatus;
          refunded_amount_cents?: number;
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
          student_user_id: string;
          token_hash: string;
          meal_value_cents?: number;
          status?: QrStatus;
          expires_at: string;
        };
        Update: {
          status?: QrStatus;
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
          qr_code_id: string;
          student_user_id: string;
          eatery_id: string;
          amount_cents?: number;
          status?: RedemptionStatus;
          metadata?: Json | null;
        };
        Update: {
          status?: RedemptionStatus;
          reversed_at?: string | null;
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
          eatery_id: string;
          amount_cents: number;
          period_start: string;
          period_end: string;
          stripe_transfer_id?: string | null;
          stripe_payout_id?: string | null;
          status?: SettlementStatus;
        };
        Update: {
          status?: SettlementStatus;
          stripe_transfer_id?: string | null;
          stripe_payout_id?: string | null;
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
        };
        Returns: undefined;
      };
      record_refund: {
        Args: {
          p_contribution_id: string;
          p_stripe_refund_id: string;
          p_amount_cents: number;
        };
        Returns: undefined;
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
        Args: { p_token_hash: string; p_eatery_user_id: string };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      contribution_status: ContributionStatus;
      qr_status: QrStatus;
      redemption_status: RedemptionStatus;
      settlement_status: SettlementStatus;
      pool_entry_type: PoolEntryType;
    };
  };
};
