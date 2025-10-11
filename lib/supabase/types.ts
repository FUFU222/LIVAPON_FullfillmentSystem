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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      import_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          file_name: string | null
          id: number
          status: string | null
          vendor_id: number | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: number
          status?: string | null
          vendor_id?: number | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: number
          status?: string | null
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_connections: {
        Row: {
          access_token: string
          id: string
          installed_at: string | null
          scopes: string | null
          shop: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          id?: string
          installed_at?: string | null
          scopes?: string | null
          shop: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          id?: string
          installed_at?: string | null
          scopes?: string | null
          shop?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      line_items: {
        Row: {
          created_at: string | null
          fulfilled_quantity: number | null
          id: number
          order_id: number | null
          product_name: string
          quantity: number
          shopify_line_item_id: number
          sku: string | null
          vendor_id: number | null
          vendor_sku_id: number | null
        }
        Insert: {
          created_at?: string | null
          fulfilled_quantity?: number | null
          id?: number
          order_id?: number | null
          product_name: string
          quantity: number
          shopify_line_item_id: number
          sku?: string | null
          vendor_id?: number | null
          vendor_sku_id?: number | null
        }
        Update: {
          created_at?: string | null
          fulfilled_quantity?: number | null
          id?: number
          order_id?: number | null
          product_name?: string
          quantity?: number
          shopify_line_item_id?: number
          sku?: string | null
          vendor_id?: number | null
          vendor_sku_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "line_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_vendor_sku_id_fkey"
            columns: ["vendor_sku_id"]
            isOneToOne: false
            referencedRelation: "vendor_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          customer_name: string | null
          id: number
          order_number: string
          shopify_order_id: number
          status: string | null
          updated_at: string | null
          vendor_id: number | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          id?: number
          order_number: string
          shopify_order_id: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: number | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          id?: number
          order_number?: string
          shopify_order_id?: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_line_items: {
        Row: {
          line_item_id: number
          quantity: number | null
          shipment_id: number
        }
        Insert: {
          line_item_id: number
          quantity?: number | null
          shipment_id: number
        }
        Update: {
          line_item_id?: number
          quantity?: number | null
          shipment_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipment_line_items_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_line_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string | null
          id: number
          shipped_at: string | null
          status: string | null
          tracking_number: string | null
          vendor_id: number | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          id?: number
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
          vendor_id?: number | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          id?: number
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_applications: {
        Row: {
          auth_user_id: string | null
          company_name: string
          contact_email: string
          contact_name: string | null
          created_at: string | null
          id: number
          message: string | null
          notes: string | null
          reviewed_at: string | null
          reviewer_email: string | null
          reviewer_id: string | null
          status: string | null
          updated_at: string | null
          vendor_code: string | null
          vendor_id: number | null
        }
        Insert: {
          auth_user_id?: string | null
          company_name: string
          contact_email: string
          contact_name?: string | null
          created_at?: string | null
          id?: number
          message?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewer_email?: string | null
          reviewer_id?: string | null
          status?: string | null
          updated_at?: string | null
          vendor_code?: string | null
          vendor_id?: number | null
        }
        Update: {
          auth_user_id?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string | null
          id?: number
          message?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewer_email?: string | null
          reviewer_id?: string | null
          status?: string | null
          updated_at?: string | null
          vendor_code?: string | null
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_applications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_skus: {
        Row: {
          attributes: Json | null
          created_at: string | null
          id: number
          product_number: number
          shopify_product_id: number | null
          shopify_variant_id: number | null
          sku: string
          variation_number: number
          vendor_id: number | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          id?: number
          product_number: number
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          sku: string
          variation_number: number
          vendor_id?: number | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          id?: number
          product_number?: number
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          sku?: string
          variation_number?: number
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_skus_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          code: string | null
          contact_email: string | null
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          code?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
