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
          name: string;
          contact_email: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          contact_email?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
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
      line_items: {
        Row: {
          id: number;
          order_id: number | null;
          shopify_line_item_id: number;
          product_name: string;
          quantity: number;
          fulfilled_quantity: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          order_id?: number | null;
          shopify_line_item_id: number;
          product_name: string;
          quantity: number;
          fulfilled_quantity?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          order_id?: number | null;
          shopify_line_item_id?: number;
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
          }
        ];
      };
      shipments: {
        Row: {
          id: number;
          line_item_id: number | null;
          tracking_number: string | null;
          carrier: string | null;
          status: string | null;
          shipped_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          line_item_id?: number | null;
          tracking_number?: string | null;
          carrier?: string | null;
          status?: string | null;
          shipped_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          line_item_id?: number | null;
          tracking_number?: string | null;
          carrier?: string | null;
          status?: string | null;
          shipped_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shipments_line_item_id_fkey';
            columns: ['line_item_id'];
            referencedRelation: 'line_items';
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
