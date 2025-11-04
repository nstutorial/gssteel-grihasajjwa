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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bill_customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          name: string
          outstanding_amount: number | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          outstanding_amount?: number | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          outstanding_amount?: number | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bill_transactions: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_method"]
          transaction_type: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode: Database["public"]["Enums"]["payment_method"]
          transaction_type: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_method"]
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_amount: number
          bill_date: string
          bill_number: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          interest_rate: number | null
          interest_type: string | null
          is_active: boolean | null
          mahajan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_amount: number
          bill_date?: string
          bill_number?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          interest_type?: string | null
          is_active?: boolean | null
          mahajan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_amount?: number
          bill_date?: string
          bill_number?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          interest_type?: string | null
          is_active?: boolean | null
          mahajan_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_mahajan_id_fkey"
            columns: ["mahajan_id"]
            isOneToOne: false
            referencedRelation: "mahajans"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_transaction_types: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          daily_amount: number | null
          id: string
          name: string
          outstanding_amount: number | null
          payment_day: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          daily_amount?: number | null
          id?: string
          name: string
          outstanding_amount?: number | null
          payment_day?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          daily_amount?: number | null
          id?: string
          name?: string
          outstanding_amount?: number | null
          payment_day?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          bank_name: string | null
          created_at: string
          current_balance: number
          id: string
          is_active: boolean
          opening_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type: string
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          opening_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          opening_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      firm_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          firm_account_id: string
          id: string
          mahajan_id: string | null
          partner_id: string | null
          transaction_date: string
          transaction_sub_type: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          firm_account_id: string
          id?: string
          mahajan_id?: string | null
          partner_id?: string | null
          transaction_date?: string
          transaction_sub_type?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          firm_account_id?: string
          id?: string
          mahajan_id?: string | null
          partner_id?: string | null
          transaction_date?: string
          transaction_sub_type?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_transactions_firm_account_id_fkey"
            columns: ["firm_account_id"]
            isOneToOne: false
            referencedRelation: "firm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_transactions_mahajan_id_fkey"
            columns: ["mahajan_id"]
            isOneToOne: false
            referencedRelation: "mahajans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          is_confirmed: boolean | null
          loan_id: string
          notes: string | null
          payment_date: string
          payment_mode: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_confirmed?: boolean | null
          loan_id: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_confirmed?: boolean | null
          loan_id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          due_date: string | null
          emi_amount: number | null
          emi_frequency: string | null
          id: string
          interest_rate: number | null
          interest_type: string | null
          is_active: boolean | null
          loan_date: string
          loan_number: string | null
          principal_amount: number
          processing_fee: number | null
          total_outstanding: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          due_date?: string | null
          emi_amount?: number | null
          emi_frequency?: string | null
          id?: string
          interest_rate?: number | null
          interest_type?: string | null
          is_active?: boolean | null
          loan_date?: string
          loan_number?: string | null
          principal_amount: number
          processing_fee?: number | null
          total_outstanding?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          due_date?: string | null
          emi_amount?: number | null
          emi_frequency?: string | null
          id?: string
          interest_rate?: number | null
          interest_type?: string | null
          is_active?: boolean | null
          loan_date?: string
          loan_number?: string | null
          principal_amount?: number
          processing_fee?: number | null
          total_outstanding?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      mahajans: {
        Row: {
          address: string | null
          advance_payment: number
          created_at: string
          id: string
          name: string
          payment_day: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          advance_payment?: number
          created_at?: string
          id?: string
          name: string
          payment_day?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          advance_payment?: number
          created_at?: string
          id?: string
          name?: string
          payment_day?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          mahajan_id: string | null
          notes: string | null
          partner_id: string
          payment_date: string
          payment_mode: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mahajan_id?: string | null
          notes?: string | null
          partner_id: string
          payment_date?: string
          payment_mode?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mahajan_id?: string | null
          notes?: string | null
          partner_id?: string
          payment_date?: string
          payment_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_transactions_mahajan_id_fkey"
            columns: ["mahajan_id"]
            isOneToOne: false
            referencedRelation: "mahajans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          total_invested: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          total_invested?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          total_invested?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          user_role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          user_role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
      }
      sale_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_method"]
          sale_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode: Database["public"]["Enums"]["payment_method"]
          sale_id: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_method"]
          sale_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          bill_customer_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          interest_rate: number | null
          interest_type: string | null
          is_active: boolean | null
          sale_amount: number
          sale_date: string
          sale_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_customer_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          interest_type?: string | null
          is_active?: boolean | null
          sale_amount: number
          sale_date?: string
          sale_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_customer_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          interest_type?: string | null
          is_active?: boolean | null
          sale_amount?: number
          sale_date?: string
          sale_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_bill_customer_id_fkey"
            columns: ["bill_customer_id"]
            isOneToOne: false
            referencedRelation: "bill_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_access_password: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          password_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          password_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          password_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          control_settings: Json | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          visible_tabs: Json
        }
        Insert: {
          control_settings?: Json | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          visible_tabs?: Json
        }
        Update: {
          control_settings?: Json | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          visible_tabs?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_bill_number: { Args: never; Returns: string }
      generate_loan_number: { Args: never; Returns: string }
      generate_sale_number: { Args: never; Returns: string }
      get_all_users_for_admin: {
        Args: never
        Returns: {
          created_at: string
          full_name: string
          user_id: string
          user_role: string
        }[]
      }
      get_user_role: { Args: { user_id_param: string }; Returns: string }
      update_user_email: {
        Args: { new_email_param: string; user_id_param: string }
        Returns: undefined
      }
    }
    Enums: {
      payment_method: "cash" | "bank"
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
    Enums: {
      payment_method: ["cash", "bank"],
    },
  },
} as const
