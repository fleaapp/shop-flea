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
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
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
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
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
          buyer_id: string
          checkout_reference: string | null
          created_at: string
          delivered_at: string | null
          id: string
          listing_id: string
          order_group_id: string | null
          order_number: string | null
          payment_method: string
          price: number
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
          tracking_number: string | null
          tracking_provider: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          checkout_reference?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          listing_id: string
          order_group_id?: string | null
          order_number?: string | null
          payment_method?: string
          price: number
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
          tracking_number?: string | null
          tracking_provider?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          checkout_reference?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          listing_id?: string
          order_group_id?: string | null
          order_number?: string | null
          payment_method?: string
          price?: number
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
          tracking_number?: string | null
          tracking_provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country_code: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          last_sign_in_at: string | null
          location: string | null
          password_set: boolean
          pause_selling: boolean
          paypal_merchant_id: string | null
          paypal_onboarding_complete: boolean
          preferred_gender: string[] | null
          preferred_sizes: string[] | null
          rating: number | null
          region_id: string | null
          report_strike_count: number
          shipping_preferences_set: boolean | null
          shipping_tier_1: number | null
          shipping_tier_2: number | null
          shipping_tier_3: number | null
          status: string
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean
          tiered_shipping_enabled: boolean | null
          total_reviews: number | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_sign_in_at?: string | null
          location?: string | null
          password_set?: boolean
          pause_selling?: boolean
          paypal_merchant_id?: string | null
          paypal_onboarding_complete?: boolean
          preferred_gender?: string[] | null
          preferred_sizes?: string[] | null
          rating?: number | null
          region_id?: string | null
          report_strike_count?: number
          shipping_preferences_set?: boolean | null
          shipping_tier_1?: number | null
          shipping_tier_2?: number | null
          shipping_tier_3?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          tiered_shipping_enabled?: boolean | null
          total_reviews?: number | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_sign_in_at?: string | null
          location?: string | null
          password_set?: boolean
          pause_selling?: boolean
          paypal_merchant_id?: string | null
          paypal_onboarding_complete?: boolean
          preferred_gender?: string[] | null
          preferred_sizes?: string[] | null
          rating?: number | null
          region_id?: string | null
          report_strike_count?: number
          shipping_preferences_set?: boolean | null
          shipping_tier_1?: number | null
          shipping_tier_2?: number | null
          shipping_tier_3?: number | null
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          tiered_shipping_enabled?: boolean | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string
          username?: string
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
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
          created_at: string
          id: string
          reason: string | null
          report_type: string
          reported_entity_id: string
          reported_user_id: string
          reporting_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          report_type: string
          reported_entity_id: string
          reported_user_id: string
          reporting_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          report_type?: string
          reported_entity_id?: string
          reported_user_id?: string
          reporting_user_id?: string
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
      waitlist: {
        Row: {
          country_code: string
          created_at: string
          email: string
          id: string
          notified_at: string | null
          region_id: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          region_id?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          email?: string
          id?: string
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
      profiles_public: {
        Row: {
          avatar_url: string | null
          country_code: string | null
          created_at: string | null
          id: string | null
          last_sign_in_at: string | null
          location: string | null
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
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string | null
          last_sign_in_at?: string | null
          location?: string | null
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
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string | null
          last_sign_in_at?: string | null
          location?: string | null
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
          user_id?: string | null
          username?: string | null
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
    }
    Functions: {
      create_mention_notifications: {
        Args: {
          p_comment_preview: string
          p_listing_id: string
          p_mentioned_usernames: string[]
          p_mentioner_user_id: string
        }
        Returns: undefined
      }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      get_nav_badges: { Args: { _user_id: string }; Returns: Json }
      get_trending_searches: {
        Args: { limit_count?: number }
        Returns: {
          query: string
          search_count: number
        }[]
      }
      get_user_region_id: { Args: { user_uuid: string }; Returns: string }
      is_region_active: { Args: { region: string }; Returns: boolean }
      is_user_blocked: { Args: { user_uuid: string }; Returns: boolean }
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
