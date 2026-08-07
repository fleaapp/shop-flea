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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_last_seen: {
        Row: {
          created_at: string
          seen_at: string
          tab: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          seen_at?: string
          tab: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          seen_at?: string
          tab?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      banned_users: {
        Row: {
          banned_at: string
          banned_by: string
          created_at: string
          id: string
          lifted_at: string | null
          reason: string
          related_report_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by: string
          created_at?: string
          id?: string
          lifted_at?: string | null
          reason: string
          related_report_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string
          created_at?: string
          id?: string
          lifted_at?: string | null
          reason?: string
          related_report_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_users_related_report_id_fkey"
            columns: ["related_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_devices: {
        Row: {
          amount_cents: number
          associated_user_id: string | null
          created_at: string
          device_id: string
          reason: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          associated_user_id?: string | null
          created_at?: string
          device_id: string
          reason: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          associated_user_id?: string | null
          created_at?: string
          device_id?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          brand_name: string
          created_at: string
          display_name: string
          id: string
          usage_count: number
        }
        Insert: {
          brand_name: string
          created_at?: string
          display_name: string
          id?: string
          usage_count?: number
        }
        Update: {
          brand_name?: string
          created_at?: string
          display_name?: string
          id?: string
          usage_count?: number
        }
        Relationships: []
      }
      buyer_addresses: {
        Row: {
          address: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          postcode: string
          state: string
          suburb: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          postcode?: string
          state?: string
          suburb?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          postcode?: string
          state?: string
          suburb?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          sender_id: string
          sender_type: string
          thread_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sender_id: string
          sender_type?: string
          thread_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sender_id?: string
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          message: string
          name: string
          notified_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          message: string
          name: string
          notified_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          message?: string
          name?: string
          notified_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          name: string
          region_id: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          region_id: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "countries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          checkout_reference: string | null
          coupon_id: string
          created_at: string
          id: string
          order_group_id: string | null
          user_id: string
        }
        Insert: {
          checkout_reference?: string | null
          coupon_id: string
          created_at?: string
          id?: string
          order_group_id?: string | null
          user_id: string
        }
        Update: {
          checkout_reference?: string | null
          coupon_id?: string
          created_at?: string
          id?: string
          order_group_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          max_redemptions: number | null
          redemption_count: number
          starts_at: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          redemption_count?: number
          starts_at?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          redemption_count?: number
          starts_at?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      discarded_listings: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discarded_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          dedupe_key: string | null
          device: Json | null
          id: string
          message: string
          route: string | null
          severity: string
          source: string
          stack: string | null
          title: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          dedupe_key?: string | null
          device?: Json | null
          id?: string
          message: string
          route?: string | null
          severity?: string
          source: string
          stack?: string | null
          title: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          dedupe_key?: string | null
          device?: Json | null
          id?: string
          message?: string
          route?: string | null
          severity?: string
          source?: string
          stack?: string | null
          title?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          listing_id: string
          parent_id: string | null
          report_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          listing_id: string
          parent_id?: string | null
          report_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          listing_id?: string
          parent_id?: string | null
          report_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "listing_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          auto_accept_offer_price: number | null
          brand: string
          category: string
          colour: string | null
          condition: string
          country_code: string | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          images: string[]
          price: number
          region_id: string | null
          report_count: number
          shipping_price: number | null
          size: string
          status: string
          style: string | null
          subcategory: string | null
          tags: string[] | null
          thumbnails: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_accept_offer_price?: number | null
          brand: string
          category: string
          colour?: string | null
          condition: string
          country_code?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          images?: string[]
          price: number
          region_id?: string | null
          report_count?: number
          shipping_price?: number | null
          size: string
          status?: string
          style?: string | null
          subcategory?: string | null
          tags?: string[] | null
          thumbnails?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_accept_offer_price?: number | null
          brand?: string
          category?: string
          colour?: string | null
          condition?: string
          country_code?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          images?: string[]
          price?: number
          region_id?: string | null
          report_count?: number
          shipping_price?: number | null
          size?: string
          status?: string
          style?: string | null
          subcategory?: string | null
          tags?: string[] | null
          thumbnails?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string | null
          related_listing_id: string | null
          related_order_id: string | null
          related_thread_id: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_listing_id?: string | null
          related_order_id?: string | null
          related_thread_id?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_listing_id?: string | null
          related_order_id?: string | null
          related_thread_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_listing_id_fkey"
            columns: ["related_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accepted_at: string | null
          amount: number
          buyer_id: string
          created_at: string
          direction: string
          expires_at: string
          id: string
          listing_id: string
          message: string | null
          original_price: number
          parent_offer_id: string | null
          responded_at: string | null
          round: number
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          amount: number
          buyer_id: string
          created_at?: string
          direction?: string
          expires_at?: string
          id?: string
          listing_id: string
          message?: string | null
          original_price: number
          parent_offer_id?: string | null
          responded_at?: string | null
          round?: number
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          buyer_id?: string
          created_at?: string
          direction?: string
          expires_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          original_price?: number
          parent_offer_id?: string | null
          responded_at?: string | null
          round?: number
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          message: string
          message_type: string
          order_id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          order_id: string
          read?: boolean
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          order_id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }
        Insert: {
          admin_marked_delivered?: boolean
          buyer_id: string
          cancelled_by_seller?: boolean
          checkout_reference?: string | null
          completed_at?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          coupon_type?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_window_ends_at?: string | null
          disputed_at?: string | null
          id?: string
          listing_id: string
          order_group_id?: string | null
          order_number?: string | null
          payment_method?: string
          pending_admin_delivery_review?: boolean
          price: number
          refund_declined_at?: string | null
          refund_declined_reason?: string | null
          refund_reason?: string | null
          refund_request_deadline_at?: string | null
          refund_request_reason?: string | null
          refund_requested_at?: string | null
          refund_requested_by?: string | null
          refunded_at?: string | null
          secure_checkout_fee?: number
          seller_id: string
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_postcode?: string | null
          shipping_price?: number
          shipping_state?: string | null
          status?: string
          tracking_approved_at?: string | null
          tracking_approved_by?: string | null
          tracking_number?: string | null
          tracking_provider?: string | null
          tracking_rejected_at?: string | null
          tracking_rejection_reason?: string | null
          transaction_fee?: number
          updated_at?: string
        }
        Update: {
          admin_marked_delivered?: boolean
          buyer_id?: string
          cancelled_by_seller?: boolean
          checkout_reference?: string | null
          completed_at?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          coupon_type?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_window_ends_at?: string | null
          disputed_at?: string | null
          id?: string
          listing_id?: string
          order_group_id?: string | null
          order_number?: string | null
          payment_method?: string
          pending_admin_delivery_review?: boolean
          price?: number
          refund_declined_at?: string | null
          refund_declined_reason?: string | null
          refund_reason?: string | null
          refund_request_deadline_at?: string | null
          refund_request_reason?: string | null
          refund_requested_at?: string | null
          refund_requested_by?: string | null
          refunded_at?: string | null
          secure_checkout_fee?: number
          seller_id?: string
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_postcode?: string | null
          shipping_price?: number
          shipping_state?: string | null
          status?: string
          tracking_approved_at?: string | null
          tracking_approved_by?: string | null
          tracking_number?: string | null
          tracking_provider?: string | null
          tracking_rejected_at?: string | null
          tracking_rejection_reason?: string | null
          transaction_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount: number | null
          buyer_id: string | null
          created_at: string
          event_id: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json | null
          provider: string
          seller_id: string | null
        }
        Insert: {
          amount?: number | null
          buyer_id?: string | null
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          provider: string
          seller_id?: string | null
        }
        Update: {
          amount?: number | null
          buyer_id?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          provider?: string
          seller_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          bundle_item_discount_percent: number | null
          bundle_shipping_discount_percent: number | null
          bundle_shipping_mode: string
          country_code: string | null
          created_at: string
          device_ids: string[]
          email: string | null
          first_name: string | null
          gst_alert_60k_sent_at: string | null
          gst_alert_75k_sent_at: string | null
          id: string
          is_apple_reviewer: boolean
          last_name: string | null
          last_sign_in_at: string | null
          legal_name: string | null
          location: string | null
          marketing_opt_in: boolean
          negative_balance_cents: number
          negative_balance_updated_at: string | null
          offers_enabled: boolean
          password_set: boolean
          pause_selling: boolean
          paypal_merchant_id: string | null
          paypal_onboarding_complete: boolean
          preferred_gender: string[] | null
          preferred_sizes: string[] | null
          rating: number | null
          region_id: string | null
          report_strike_count: number
          seller_cancel_count: number
          shipping_preferences_set: boolean | null
          shipping_tier_1: number | null
          shipping_tier_2: number | null
          shipping_tier_3: number | null
          status: string
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean
          stripe_onboarding_step: string | null
          tiered_shipping_enabled: boolean | null
          total_reviews: number | null
          tracking_flagged: boolean
          updated_at: string
          user_id: string
          username: string
          wrong_tracking_count: number
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          bundle_item_discount_percent?: number | null
          bundle_shipping_discount_percent?: number | null
          bundle_shipping_mode?: string
          country_code?: string | null
          created_at?: string
          device_ids?: string[]
          email?: string | null
          first_name?: string | null
          gst_alert_60k_sent_at?: string | null
          gst_alert_75k_sent_at?: string | null
          id?: string
          is_apple_reviewer?: boolean
          last_name?: string | null
          last_sign_in_at?: string | null
          legal_name?: string | null
          location?: string | null
          marketing_opt_in?: boolean
          negative_balance_cents?: number
          negative_balance_updated_at?: string | null
          offers_enabled?: boolean
          password_set?: boolean
          pause_selling?: boolean
          paypal_merchant_id?: string | null
          paypal_onboarding_complete?: boolean
          preferred_gender?: string[] | null
          preferred_sizes?: string[] | null
          rating?: number | null
          region_id?: string | null
          report_strike_count?: number
          seller_cancel_count?: number
          shipping_preferences_set?: boolean | null
          shipping_tier_1?: number | null
          shipping_tier_2?: number | null
          shipping_tier_3?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          stripe_onboarding_step?: string | null
          tiered_shipping_enabled?: boolean | null
          total_reviews?: number | null
          tracking_flagged?: boolean
          updated_at?: string
          user_id: string
          username: string
          wrong_tracking_count?: number
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          bundle_item_discount_percent?: number | null
          bundle_shipping_discount_percent?: number | null
          bundle_shipping_mode?: string
          country_code?: string | null
          created_at?: string
          device_ids?: string[]
          email?: string | null
          first_name?: string | null
          gst_alert_60k_sent_at?: string | null
          gst_alert_75k_sent_at?: string | null
          id?: string
          is_apple_reviewer?: boolean
          last_name?: string | null
          last_sign_in_at?: string | null
          legal_name?: string | null
          location?: string | null
          marketing_opt_in?: boolean
          negative_balance_cents?: number
          negative_balance_updated_at?: string | null
          offers_enabled?: boolean
          password_set?: boolean
          pause_selling?: boolean
          paypal_merchant_id?: string | null
          paypal_onboarding_complete?: boolean
          preferred_gender?: string[] | null
          preferred_sizes?: string[] | null
          rating?: number | null
          region_id?: string | null
          report_strike_count?: number
          seller_cancel_count?: number
          shipping_preferences_set?: boolean | null
          shipping_tier_1?: number | null
          shipping_tier_2?: number | null
          shipping_tier_3?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          stripe_onboarding_step?: string | null
          tiered_shipping_enabled?: boolean | null
          total_reviews?: number | null
          tracking_flagged?: boolean
          updated_at?: string
          user_id?: string
          username?: string
          wrong_tracking_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          bundle_item_discount_percent: number | null
          bundle_shipping_discount_percent: number | null
          bundle_shipping_mode: string | null
          country_code: string | null
          created_at: string | null
          id: string
          last_sign_in_at: string | null
          location: string | null
          offers_enabled: boolean | null
          pause_selling: boolean | null
          paypal_onboarding_complete: boolean | null
          rating: number | null
          region_id: string | null
          shipping_preferences_set: boolean | null
          shipping_tier_1: number | null
          shipping_tier_2: number | null
          shipping_tier_3: number | null
          status: string | null
          stripe_onboarding_complete: boolean | null
          tiered_shipping_enabled: boolean | null
          total_reviews: number | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bundle_item_discount_percent?: number | null
          bundle_shipping_discount_percent?: number | null
          bundle_shipping_mode?: string | null
          country_code?: string | null
          created_at?: string | null
          id: string
          last_sign_in_at?: string | null
          location?: string | null
          offers_enabled?: boolean | null
          pause_selling?: boolean | null
          paypal_onboarding_complete?: boolean | null
          rating?: number | null
          region_id?: string | null
          shipping_preferences_set?: boolean | null
          shipping_tier_1?: number | null
          shipping_tier_2?: number | null
          shipping_tier_3?: number | null
          status?: string | null
          stripe_onboarding_complete?: boolean | null
          tiered_shipping_enabled?: boolean | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bundle_item_discount_percent?: number | null
          bundle_shipping_discount_percent?: number | null
          bundle_shipping_mode?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          last_sign_in_at?: string | null
          location?: string | null
          offers_enabled?: boolean | null
          pause_selling?: boolean | null
          paypal_onboarding_complete?: boolean | null
          rating?: number | null
          region_id?: string | null
          shipping_preferences_set?: boolean | null
          shipping_tier_1?: number | null
          shipping_tier_2?: number | null
          shipping_tier_3?: number | null
          status?: string | null
          stripe_onboarding_complete?: boolean | null
          tiered_shipping_enabled?: boolean | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string
          id: string
          p256dh: string | null
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint: string
          id?: string
          p256dh?: string | null
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string | null
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reason: string | null
          report_type: string
          reported_entity_id: string
          reported_user_id: string
          reporting_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          report_type: string
          reported_entity_id: string
          reported_user_id: string
          reporting_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          report_type?: string
          reported_entity_id?: string
          reported_user_id?: string
          reporting_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          photo_url: string | null
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          photo_url?: string | null
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          photo_url?: string | null
          rating?: number
          reviewed_user_id?: string
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          last_notified_at: string
          query: string
          region_id: string | null
          signature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          last_notified_at?: string
          query?: string
          region_id?: string | null
          signature: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          last_notified_at?: string
          query?: string
          region_id?: string | null
          signature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          created_at: string
          id: string
          query: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          description: string
          event_at: string
          id: string
          location: string | null
          shipment_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          description: string
          event_at: string
          id?: string
          location?: string | null
          shipment_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          event_at?: string
          id?: string
          location?: string | null
          shipment_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "tracking_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_shipments: {
        Row: {
          buyer_id: string
          carrier_code: string | null
          carrier_name: string | null
          created_at: string
          delivered_at: string | null
          first_scan_at: string | null
          id: string
          is_exception: boolean
          last_synced_at: string | null
          latest_event_at: string | null
          latest_event_summary: string | null
          not_found_notified_at: string | null
          order_group_id: string
          provider: string
          provider_status: string | null
          raw_payload: Json | null
          registered_at: string | null
          seller_id: string
          tracking_number: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          carrier_code?: string | null
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          first_scan_at?: string | null
          id?: string
          is_exception?: boolean
          last_synced_at?: string | null
          latest_event_at?: string | null
          latest_event_summary?: string | null
          not_found_notified_at?: string | null
          order_group_id: string
          provider?: string
          provider_status?: string | null
          raw_payload?: Json | null
          registered_at?: string | null
          seller_id: string
          tracking_number: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          carrier_code?: string | null
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          first_scan_at?: string | null
          id?: string
          is_exception?: boolean
          last_synced_at?: string | null
          latest_event_at?: string | null
          latest_event_summary?: string | null
          not_found_notified_at?: string | null
          order_group_id?: string
          provider?: string
          provider_status?: string | null
          raw_payload?: Json | null
          registered_at?: string | null
          seller_id?: string
          tracking_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          country_code: string
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          notified_at: string | null
          region_id: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notified_at?: string | null
          region_id?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notified_at?: string | null
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_tracking: {
        Args: { p_order_id: string }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_approve_untracked_delivery: {
        Args: { p_order_id: string }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_dismiss_refund_dispute: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      admin_reject_tracking: {
        Args: { p_order_id: string; p_reason: string }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_reject_untracked_delivery: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      auto_complete_delivered_orders: { Args: never; Returns: number }
      auto_deliver_shipped_orders: { Args: never; Returns: number }
      check_and_record_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      complete_order: {
        Args: { p_order_group_id?: string; p_order_id?: string }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_mention_notifications: {
        Args: {
          p_comment_preview: string
          p_listing_id: string
          p_mentioned_usernames: string[]
          p_mentioner_user_id: string
        }
        Returns: undefined
      }
      create_offer: {
        Args: {
          p_amount: number
          p_listing_id: string
          p_message?: string
          p_parent_offer_id?: string
        }
        Returns: {
          accepted_at: string | null
          amount: number
          buyer_id: string
          created_at: string
          direction: string
          expires_at: string
          id: string
          listing_id: string
          message: string | null
          original_price: number
          parent_offer_id: string | null
          responded_at: string | null
          round: number
          seller_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_stale_offers: { Args: never; Returns: number }
      get_accepted_offer_prices: {
        Args: { _buyer_id: string; _listing_ids: string[] }
        Returns: {
          amount: number
          expires_at: string
          listing_id: string
          offer_id: string
          original_price: number
        }[]
      }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      get_home_feed: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          auto_accept_offer_price: number | null
          brand: string
          category: string
          colour: string | null
          condition: string
          country_code: string | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          images: string[]
          price: number
          region_id: string | null
          report_count: number
          shipping_price: number | null
          size: string
          status: string
          style: string | null
          subcategory: string | null
          tags: string[] | null
          thumbnails: string[] | null
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_listing_engagement_counts: {
        Args: { _listing_ids: string[] }
        Returns: {
          cart_count: number
          listing_id: string
          wishlist_count: number
        }[]
      }
      get_nav_badges: { Args: { _user_id: string }; Returns: Json }
      get_profiles_public: {
        Args: never
        Returns: {
          avatar_url: string
          bundle_shipping_discount_percent: number
          bundle_shipping_mode: string
          country_code: string
          created_at: string
          id: string
          last_sign_in_at: string
          location: string
          pause_selling: boolean
          paypal_onboarding_complete: boolean
          rating: number
          region_id: string
          shipping_preferences_set: boolean
          shipping_tier_1: number
          shipping_tier_2: number
          shipping_tier_3: number
          status: string
          stripe_onboarding_complete: boolean
          tiered_shipping_enabled: boolean
          total_reviews: number
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      get_seller_payment_accounts: {
        Args: { seller_ids: string[] }
        Returns: {
          paypal_onboarding_complete: boolean
          stripe_onboarding_complete: boolean
          user_id: string
        }[]
      }
      get_trending_searches: {
        Args: { limit_count?: number }
        Returns: {
          query: string
          search_count: number
        }[]
      }
      get_user_region_id: { Args: { user_uuid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_brand_usage: { Args: { _brand_id: string }; Returns: undefined }
      increment_coupon_redemption: {
        Args: { _coupon_id: string }
        Returns: undefined
      }
      is_region_active: { Args: { region: string }; Returns: boolean }
      is_user_blocked: { Args: { user_uuid: string }; Returns: boolean }
      mark_order_delivered: {
        Args: {
          p_order_group_id?: string
          p_order_id?: string
          p_source?: string
        }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_order_shipped: {
        Args: {
          p_order_group_id?: string
          p_order_id?: string
          p_tracking_number?: string
          p_tracking_provider?: string
        }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_order_thread_read: { Args: { _thread_id: string }; Returns: Json }
      mark_support_thread_read: {
        Args: { _thread_id: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_expiring_accepted_offers: { Args: never; Returns: number }
      notify_offers_voided: {
        Args: { _listing_id: string; _reason: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      request_refund: {
        Args: {
          p_order_group_id?: string
          p_order_id?: string
          p_reason?: string
        }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      respond_to_offer: {
        Args: { p_decision: string; p_offer_id: string }
        Returns: {
          accepted_at: string | null
          amount: number
          buyer_id: string
          created_at: string
          direction: string
          expires_at: string
          id: string
          listing_id: string
          message: string | null
          original_price: number
          parent_offer_id: string | null
          responded_at: string | null
          round: number
          seller_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_refund_request: {
        Args: {
          p_decision?: string
          p_order_group_id?: string
          p_order_id?: string
          p_reason?: string
        }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seed_push_vault_key: { Args: { p_key: string }; Returns: undefined }
      seller_cancel_order_begin: {
        Args: { p_order_id: string; p_reason: string }
        Returns: {
          admin_marked_delivered: boolean
          buyer_id: string
          cancelled_by_seller: boolean
          checkout_reference: string | null
          completed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          coupon_type: string | null
          created_at: string
          delivered_at: string | null
          dispute_window_ends_at: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          pending_admin_delivery_review: boolean
          price: number
          refund_declined_at: string | null
          refund_declined_reason: string | null
          refund_reason: string | null
          refund_request_deadline_at: string | null
          refund_request_reason: string | null
          refund_requested_at: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          secure_checkout_fee: number
          seller_id: string
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_price: number
          shipping_state: string | null
          status: string
          tracking_approved_at: string | null
          tracking_approved_by: string | null
          tracking_number: string | null
          tracking_provider: string | null
          tracking_rejected_at: string | null
          tracking_rejection_reason: string | null
          transaction_fee: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seller_relist_cancelled_listing: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      withdraw_offer: {
        Args: { p_offer_id: string }
        Returns: {
          accepted_at: string | null
          amount: number
          buyer_id: string
          created_at: string
          direction: string
          expires_at: string
          id: string
          listing_id: string
          message: string | null
          original_price: number
          parent_offer_id: string | null
          responded_at: string | null
          round: number
          seller_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
