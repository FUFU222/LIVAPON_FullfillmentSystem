export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: number;
          code: string | null;
          name: string;
          contact_email: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          code?: string | null;
          name: string;
          contact_email?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          code?: string | null;
          name?: string;
          contact_email?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: number;
          shopify_order_id: number;
          vendor_id: number | null;
          order_number: string;
          customer_name: string | null;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          shopify_order_id: number;
          vendor_id?: number | null;
          order_number: string;
          customer_name?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          shopify_order_id?: number;
          vendor_id?: number | null;
          order_number?: string;
          customer_name?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
      vendor_applications: {
        Row: {
          id: number;
          vendor_code: string | null;
          company_name: string;
          contact_name: string | null;
          contact_email: string;
          message: string | null;
          status: string | null;
          notes: string | null;
          vendor_id: number | null;
          reviewer_id: string | null;
          reviewer_email: string | null;
          reviewed_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          vendor_code?: string | null;
          company_name: string;
          contact_name?: string | null;
          contact_email: string;
          message?: string | null;
          status?: string | null;
          notes?: string | null;
          vendor_id?: number | null;
          reviewer_id?: string | null;
          reviewer_email?: string | null;
          reviewed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          vendor_code?: string | null;
          company_name?: string;
          contact_name?: string | null;
          contact_email?: string;
          message?: string | null;
          status?: string | null;
          notes?: string | null;
          vendor_id?: number | null;
          reviewer_id?: string | null;
          reviewer_email?: string | null;
          reviewed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_applications_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
      line_items: {
        Row: {
          id: number;
          order_id: number | null;
          vendor_id: number | null;
          vendor_sku_id: number | null;
          shopify_line_item_id: number;
          sku: string | null;
          product_name: string;
          quantity: number;
          fulfilled_quantity: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          order_id?: number | null;
          vendor_id?: number | null;
          vendor_sku_id?: number | null;
          shopify_line_item_id: number;
          sku?: string | null;
          product_name: string;
          quantity: number;
          fulfilled_quantity?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          order_id?: number | null;
          vendor_id?: number | null;
          vendor_sku_id?: number | null;
          shopify_line_item_id?: number;
          sku?: string | null;
          product_name?: string;
          quantity?: number;
          fulfilled_quantity?: number | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'line_items_order_id_fkey';
            columns: ['order_id'];
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'line_items_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'line_items_vendor_sku_id_fkey';
            columns: ['vendor_sku_id'];
            referencedRelation: 'vendor_skus';
            referencedColumns: ['id'];
          }
        ];
      };
      vendor_skus: {
        Row: {
          id: number;
          vendor_id: number | null;
          sku: string;
          product_number: number;
          variation_number: number;
          shopify_product_id: number | null;
          shopify_variant_id: number | null;
          attributes: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          vendor_id?: number | null;
          sku: string;
          product_number: number;
          variation_number: number;
          shopify_product_id?: number | null;
          shopify_variant_id?: number | null;
          attributes?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          vendor_id?: number | null;
          sku?: string;
          product_number?: number;
          variation_number?: number;
          shopify_product_id?: number | null;
          shopify_variant_id?: number | null;
          attributes?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_skus_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
      shipments: {
        Row: {
          id: number;
          vendor_id: number | null;
          tracking_number: string | null;
          carrier: string | null;
          status: string | null;
          shipped_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          vendor_id?: number | null;
          tracking_number?: string | null;
          carrier?: string | null;
          status?: string | null;
          shipped_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          vendor_id?: number | null;
          tracking_number?: string | null;
          carrier?: string | null;
          status?: string | null;
          shipped_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shipments_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
      shipment_line_items: {
        Row: {
          shipment_id: number;
          line_item_id: number;
          quantity: number | null;
        };
        Insert: {
          shipment_id: number;
          line_item_id: number;
          quantity?: number | null;
        };
        Update: {
          shipment_id?: number;
          line_item_id?: number;
          quantity?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shipment_line_items_line_item_id_fkey';
            columns: ['line_item_id'];
            referencedRelation: 'line_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shipment_line_items_shipment_id_fkey';
            columns: ['shipment_id'];
            referencedRelation: 'shipments';
            referencedColumns: ['id'];
          }
        ];
      };
      import_logs: {
        Row: {
          id: number;
          vendor_id: number | null;
          file_name: string | null;
          status: string | null;
          error_message: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          vendor_id?: number | null;
          file_name?: string | null;
          status?: string | null;
          error_message?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          vendor_id?: number | null;
          file_name?: string | null;
          status?: string | null;
          error_message?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'import_logs_vendor_id_fkey';
            columns: ['vendor_id'];
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          }
        ];
      };
    };
  };
}
