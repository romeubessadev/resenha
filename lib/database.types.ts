// Gerado por `npx supabase gen types typescript --linked`.
//
// ATENÇÃO ao regerar: o gerador NÃO modela nulabilidade de argumento de
// função — emite `p_category_id: string` mesmo onde o SQL aceita NULL. Os
// dois RPCs de despesa (create_expense_with_participants e
// update_expense_with_participants) são chamados com null de propósito
// (despesa que ainda não foi categorizada, comprovante ausente etc.), então o
// `| null` dos argumentos deles é restaurado À MÃO depois de cada regeração.
// Sem isso o tsc acusa erros em hooks/useExpenses.ts.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      expense_participants: {
        Row: {
          exact_amount: number | null
          expense_id: string
          shares: number | null
          user_id: string
        }
        Insert: {
          exact_amount?: number | null
          expense_id: string
          shares?: number | null
          user_id: string
        }
        Update: {
          exact_amount?: number | null
          expense_id?: string
          shares?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_participants_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_recurrences: {
        Row: {
          active: boolean
          amount: number
          anchor_day: number
          category_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          end_date: string | null
          freq: string
          group_id: string
          id: string
          interval_days: number | null
          next_run_date: string
          paid_by: string
          participants: Json
          paused: boolean
          receipt_path: string | null
          split_type: string
          title: string
        }
        Insert: {
          active?: boolean
          amount: number
          anchor_day: number
          category_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          end_date?: string | null
          freq: string
          group_id: string
          id?: string
          interval_days?: number | null
          next_run_date: string
          paid_by: string
          participants: Json
          paused?: boolean
          receipt_path?: string | null
          split_type: string
          title: string
        }
        Update: {
          active?: boolean
          amount?: number
          anchor_day?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          end_date?: string | null
          freq?: string
          group_id?: string
          id?: string
          interval_days?: number | null
          next_run_date?: string
          paid_by?: string
          participants?: Json
          paused?: boolean
          receipt_path?: string | null
          split_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_recurrences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_recurrences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_recurrences_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          group_id: string
          id: string
          paid_by: string
          receipt_path: string | null
          recurrence_id: string | null
          split_type: string
          title: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          group_id: string
          id?: string
          paid_by: string
          receipt_path?: string | null
          recurrence_id?: string | null
          split_type?: string
          title: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          group_id?: string
          id?: string
          paid_by?: string
          receipt_path?: string | null
          recurrence_id?: string | null
          split_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "expense_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          actor_avatar_path: string | null
          actor_id: string
          actor_name: string
          at: string
          group_id: string
          id: string
          payload: Json
          type: string
        }
        Insert: {
          actor_avatar_path?: string | null
          actor_id: string
          actor_name: string
          at?: string
          group_id: string
          id?: string
          payload?: Json
          type: string
        }
        Update: {
          actor_avatar_path?: string | null
          actor_id?: string
          actor_name?: string
          at?: string
          group_id?: string
          id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          archived_at: string | null
          created_at: string
          group_id: string
          role: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          group_id: string
          role?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          group_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_key: string | null
          avatar_path: string | null
          created_at: string
          created_by: string
          default_split_type: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          avatar_key?: string | null
          avatar_path?: string | null
          created_at?: string
          created_by: string
          default_split_type?: string
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          avatar_key?: string | null
          avatar_path?: string | null
          created_at?: string
          created_by?: string
          default_split_type?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          from_user: string
          group_id: string
          id: string
          receipt_path: string | null
          to_user: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          from_user: string
          group_id: string
          id?: string
          receipt_path?: string | null
          to_user: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          from_user?: string
          group_id?: string
          id?: string
          receipt_path?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string | null
          avatar_path: string | null
          created_at: string
          id: string
          is_premium: boolean
          language: string
          name: string
          onboarding_answers: Json | null
          pix_key: string | null
          pix_key_type: string | null
          premium_since: string | null
          timezone: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_key?: string | null
          avatar_path?: string | null
          created_at?: string
          id: string
          is_premium?: boolean
          language?: string
          name?: string
          onboarding_answers?: Json | null
          pix_key?: string | null
          pix_key_type?: string | null
          premium_since?: string | null
          timezone?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_key?: string | null
          avatar_path?: string | null
          created_at?: string
          id?: string
          is_premium?: boolean
          language?: string
          name?: string
          onboarding_answers?: Json | null
          pix_key?: string | null
          pix_key_type?: string | null
          premium_since?: string | null
          timezone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      push_log: {
        Row: {
          actor_id: string | null
          created_at: string
          group_id: string | null
          id: string
          kind: string
          metadata: Json | null
          recipient_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          kind: string
          metadata?: Json | null
          recipient_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          metadata?: Json | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          confirmed_at: string | null
          from_user: string
          group_id: string
          id: string
          marked_at: string
          proof_path: string | null
          recorded_by_creditor: boolean
          status: string
          to_user: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          from_user: string
          group_id: string
          id?: string
          marked_at?: string
          proof_path?: string | null
          recorded_by_creditor?: boolean
          status?: string
          to_user: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          from_user?: string
          group_id?: string
          id?: string
          marked_at?: string
          proof_path?: string | null
          recorded_by_creditor?: boolean
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_months_clamped: {
        Args: { p_anchor_day: number; p_from: string; p_months: number }
        Returns: string
      }
      confirm_settlement: {
        Args: { p_settlement_id: string }
        Returns: undefined
      }
      create_expense_with_participants: {
        Args: {
          p_amount: number
          p_category_id: string | null
          p_date: string
          p_description?: string | null
          p_group_id: string
          p_id: string
          p_paid_by: string
          p_participants: Json
          p_receipt_path?: string | null
          p_recurrence_id?: string | null
          p_split_type: string
          p_title: string
        }
        Returns: undefined
      }
      create_group_with_owner: {
        Args: {
          p_avatar_key: string
          p_default_split_type?: string
          p_name: string
        }
        Returns: {
          avatar_key: string | null
          avatar_path: string | null
          created_at: string
          created_by: string
          default_split_type: string
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_notification: {
        Args: {
          p_actor_avatar_path: string
          p_actor_id: string
          p_actor_name: string
          p_context: string
          p_family: string
          p_group_id: string
          p_href: string
          p_kind: string
          p_metadata: Json
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      demote_admin: {
        Args: { gid: string; target_user_id: string }
        Returns: undefined
      }
      find_group_by_invite_code: {
        Args: { code: string }
        Returns: {
          avatar_key: string | null
          avatar_path: string | null
          created_at: string
          created_by: string
          default_split_type: string
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_invite_code: { Args: never; Returns: string }
      group_last_activity: {
        Args: { p_group_ids: string[] }
        Returns: {
          gid: string
          last_at: string
        }[]
      }
      is_group_admin: { Args: { gid: string }; Returns: boolean }
      is_group_member: { Args: { gid: string }; Returns: boolean }
      is_group_owner: { Args: { gid: string }; Returns: boolean }
      materialize_recurring_expenses: {
        Args: { p_recurrence_id?: string }
        Returns: undefined
      }
      next_recurrence_date: {
        Args: {
          p_anchor_day?: number
          p_freq: string
          p_from: string
          p_interval_days: number
        }
        Returns: string
      }
      notify_open_balances: { Args: never; Returns: undefined }
      record_receipt: {
        Args: { p_amount: number; p_from_user: string; p_group_id: string }
        Returns: undefined
      }
      send_push_event: {
        Args: {
          p_actor_id: string
          p_group_id: string
          p_kind: string
          p_metadata: Json
          p_recipient_id: string
        }
        Returns: undefined
      }
      set_group_avatar_on_create: {
        Args: { p_group_id: string; p_path: string }
        Returns: undefined
      }
      set_my_group_archived: {
        Args: { archived: boolean; gid: string }
        Returns: undefined
      }
      shares_group_with: { Args: { other: string }; Returns: boolean }
      transfer_owner: {
        Args: { gid: string; new_owner_user_id: string }
        Returns: undefined
      }
      update_expense_with_participants: {
        Args: {
          p_amount: number
          p_category_id?: string | null
          p_date: string
          p_id: string
          p_paid_by: string
          p_participants: Json
          p_receipt_path?: string | null
          p_recurrence_id?: string | null
          p_set_recurrence?: boolean
          p_split_type: string
          p_title: string
        }
        Returns: undefined
      }
      user_group_balance: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
