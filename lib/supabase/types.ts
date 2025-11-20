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
      fulfillment_request_line_items: {
        Row: {
          created_at: string | null
          fulfillment_order_line_item_id: number | null
          fulfillment_request_id: number
          id: number
          line_item_id: number | null
          remaining_quantity: number | null
          requested_quantity: number | null
          shopify_line_item_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fulfillment_order_line_item_id?: number | null
          fulfillment_request_id: number
          id?: number
          line_item_id?: number | null
          remaining_quantity?: number | null
          requested_quantity?: number | null
          shopify_line_item_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fulfillment_order_line_item_id?: number | null
          fulfillment_request_id?: number
          id?: number
          line_item_id?: number | null
          remaining_quantity?: number | null
          requested_quantity?: number | null
          shopify_line_item_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_request_line_items_fulfillment_request_id_fkey"
            columns: ["fulfillment_request_id"]
            isOneToOne: false
            referencedRelation: "fulfillment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_request_line_items_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_requests: {
        Row: {
          created_at: string | null
          id: number
          message: string | null
          order_id: number | null
          processed_at: string | null
          raw_payload: Json
          requested_at: string | null
          shop_domain: string | null
          shopify_fulfillment_order_id: number
          shopify_order_id: number
          status: string | null
          updated_at: string | null
          vendor_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          message?: string | null
          order_id?: number | null
          processed_at?: string | null
          raw_payload: Json
          requested_at?: string | null
          shop_domain?: string | null
          shopify_fulfillment_order_id: number
          shopify_order_id: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          message?: string | null
          order_id?: number | null
          processed_at?: string | null
          raw_payload?: Json
          requested_at?: string | null
          shop_domain?: string | null
          shopify_fulfillment_order_id?: number
          shopify_order_id?: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          created_at: string | null
          fulfillable_quantity: number | null
          fulfilled_quantity: number | null
          fulfillment_order_line_item_id: number | null
          id: number
          last_updated_by: string | null
          last_updated_source: string
          order_id: number | null
          product_name: string
          variant_title: string | null
          quantity: number
          shopify_line_item_id: number
          sku: string | null
          vendor_id: number | null
          vendor_sku_id: number | null
        }
        Insert: {
          created_at?: string | null
          fulfillable_quantity?: number | null
          fulfilled_quantity?: number | null
          fulfillment_order_line_item_id?: number | null
          id?: number
          last_updated_by?: string | null
          last_updated_source?: string
          order_id?: number | null
          product_name: string
          variant_title?: string | null
          quantity: number
          shopify_line_item_id: number
          sku?: string | null
          vendor_id?: number | null
          vendor_sku_id?: number | null
        }
        Update: {
          created_at?: string | null
          fulfillable_quantity?: number | null
          fulfilled_quantity?: number | null
          fulfillment_order_line_item_id?: number | null
          id?: number
          last_updated_by?: string | null
          last_updated_source?: string
          order_id?: number | null
          product_name?: string
          variant_title?: string | null
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
          last_updated_by: string | null
          last_updated_source: string
          order_number: string
          shipping_address1: string | null
          shipping_address2: string | null
          shipping_city: string | null
          shipping_postal: string | null
          shipping_prefecture: string | null
          shop_domain: string | null
          shopify_fulfillment_order_id: number | null
          shopify_fo_status: string | null
          shopify_order_id: number
          status: string | null
          updated_at: string | null
          vendor_id: number | null
          archived_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          id?: number
          last_updated_by?: string | null
          last_updated_source?: string
          order_number: string
          shipping_address1?: string | null
          shipping_address2?: string | null
          shipping_city?: string | null
          shipping_postal?: string | null
          shipping_prefecture?: string | null
          shop_domain?: string | null
          shopify_fulfillment_order_id?: number | null
          shopify_fo_status?: string | null
          shopify_order_id: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: number | null
          archived_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          id?: number
          last_updated_by?: string | null
          last_updated_source?: string
          order_number?: string
          shipping_address1?: string | null
          shipping_address2?: string | null
          shipping_city?: string | null
          shipping_postal?: string | null
          shipping_prefecture?: string | null
          shop_domain?: string | null
          shopify_fulfillment_order_id?: number | null
          shopify_fo_status?: string | null
          shopify_order_id?: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: number | null
          archived_at?: string | null
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
          fulfillment_order_line_item_id: number | null
          line_item_id: number
          quantity: number | null
          shipment_id: number
        }
        Insert: {
          fulfillment_order_line_item_id?: number | null
          line_item_id: number
          quantity?: number | null
          shipment_id: number
        }
        Update: {
          fulfillment_order_line_item_id?: number | null
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
      shipment_adjustment_requests: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          desired_change: string
          id: number
          issue_summary: string
          issue_type: string
          line_item_context: string | null
          order_id: number | null
          order_number: string
          shopify_order_id: number | null
          status: string | null
          submitted_by: string | null
          tracking_number: string | null
          updated_at: string | null
          vendor_id: number
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          desired_change: string
          id?: number
          issue_summary: string
          issue_type: string
          line_item_context?: string | null
          order_id?: number | null
          order_number: string
          shopify_order_id?: number | null
          status?: string | null
          submitted_by?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          vendor_id: number
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          desired_change?: string
          id?: number
          issue_summary?: string
          issue_type?: string
          line_item_context?: string | null
          order_id?: number | null
          order_number?: string
          shopify_order_id?: number | null
          status?: string | null
          submitted_by?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          vendor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipment_adjustment_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_adjustment_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_cancellation_logs: {
        Row: {
          id: number
          shipment_id: number | null
          order_id: number | null
          vendor_id: number | null
          reason_type: string
          reason_detail: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          shipment_id?: number | null
          order_id?: number | null
          vendor_id?: number | null
          reason_type: string
          reason_detail?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          shipment_id?: number | null
          order_id?: number | null
          vendor_id?: number | null
          reason_type?: string
          reason_detail?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_cancellation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_cancellation_logs_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_cancellation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string | null
          id: number
          last_updated_by: string | null
          last_updated_source: string
          order_id: number | null
          shipped_at: string | null
          shopify_fulfillment_id: number | null
          status: string | null
          sync_error: string | null
          last_retry_at: string | null
          sync_pending_until: string | null
          sync_retry_count: number | null
          sync_status: string | null
          synced_at: string | null
          tracking_company: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
          vendor_id: number | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          id?: number
          last_updated_by?: string | null
          last_updated_source?: string
          order_id?: number | null
          shipped_at?: string | null
          shopify_fulfillment_id?: number | null
          status?: string | null
          sync_error?: string | null
          last_retry_at?: string | null
          sync_pending_until?: string | null
          sync_retry_count?: number | null
          sync_status?: string | null
          synced_at?: string | null
          tracking_company?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          vendor_id?: number | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          id?: number
          last_updated_by?: string | null
          last_updated_source?: string
          order_id?: number | null
          shipped_at?: string | null
          shopify_fulfillment_id?: number | null
          status?: string | null
          sync_error?: string | null
          last_retry_at?: string | null
          sync_pending_until?: string | null
          sync_retry_count?: number | null
          sync_status?: string | null
          synced_at?: string | null
          tracking_company?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_vendor_id_fkey"
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
      webhook_jobs: {
        Row: {
          api_version: string | null
          attempts: number
          created_at: string
          id: number
          last_error: string | null
          locked_at: string | null
          payload: Json
          shop_domain: string
          status: string
          topic: string
          updated_at: string
          webhook_id: string | null
        }
        Insert: {
          api_version?: string | null
          attempts?: number
          created_at?: string
          id?: number
          last_error?: string | null
          locked_at?: string | null
          payload: Json
          shop_domain: string
          status?: string
          topic: string
          updated_at?: string
          webhook_id?: string | null
        }
        Update: {
          api_version?: string | null
          attempts?: number
          created_at?: string
          id?: number
          last_error?: string | null
          locked_at?: string | null
          payload?: Json
          shop_domain?: string
          status?: string
          topic?: string
          updated_at?: string
          webhook_id?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          code: string | null
          contact_name: string | null
          contact_email: string | null
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          code?: string | null
          contact_name?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string | null
          contact_name?: string | null
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
      claim_pending_webhook_jobs: {
        Args: {
          batch_limit?: number | null
        }
        Returns: Database['public']['Tables']['webhook_jobs']['Row'][]
      }
      sync_order_line_items: {
        Args: {
          p_order_id: number
          p_items: Json
        }
        Returns: void
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
