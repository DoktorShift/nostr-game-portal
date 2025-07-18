export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      follow_npub: {
        Row: {
          created_at: string
          followed_about: string | null
          followed_banner: string | null
          followed_display_name: string | null
          followed_lud16: string | null
          followed_name: string | null
          followed_nip05: string | null
          followed_npub: string | null
          followed_picture: string | null
          followed_pubkey: string
          followed_website: string | null
          friend_source: string
          id: string
          is_favorite: boolean
          updated_at: string
          user_pubkey: string
        }
        Insert: {
          created_at?: string
          followed_about?: string | null
          followed_banner?: string | null
          followed_display_name?: string | null
          followed_lud16?: string | null
          followed_name?: string | null
          followed_nip05?: string | null
          followed_npub?: string | null
          followed_picture?: string | null
          followed_pubkey: string
          followed_website?: string | null
          friend_source?: string
          id?: string
          is_favorite?: boolean
          updated_at?: string
          user_pubkey: string
        }
        Update: {
          created_at?: string
          followed_about?: string | null
          followed_banner?: string | null
          followed_display_name?: string | null
          followed_lud16?: string | null
          followed_name?: string | null
          followed_nip05?: string | null
          followed_npub?: string | null
          followed_picture?: string | null
          followed_pubkey?: string
          followed_website?: string | null
          friend_source?: string
          id?: string
          is_favorite?: boolean
          updated_at?: string
          user_pubkey?: string
        }
        Relationships: []
      }
      friend_circle_members: {
        Row: {
          added_by_pubkey: string
          circle_id: string
          created_at: string
          id: string
          member_pubkey: string
        }
        Insert: {
          added_by_pubkey: string
          circle_id: string
          created_at?: string
          id?: string
          member_pubkey: string
        }
        Update: {
          added_by_pubkey?: string
          circle_id?: string
          created_at?: string
          id?: string
          member_pubkey?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "friend_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_circles: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_pubkey: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_pubkey: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_pubkey?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          about: string | null
          banner: string | null
          created_at: string | null
          display_name: string | null
          id: string
          last_seen_at: string | null
          lud16: string | null
          name: string | null
          nip05: string | null
          npub: string | null
          picture: string | null
          pubkey: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          about?: string | null
          banner?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
          lud16?: string | null
          name?: string | null
          nip05?: string | null
          npub?: string | null
          picture?: string | null
          pubkey: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          about?: string | null
          banner?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
          lud16?: string | null
          name?: string | null
          nip05?: string | null
          npub?: string | null
          picture?: string | null
          pubkey?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_last_seen: {
        Args:
          | { p_pubkey: string }
          | {
              p_pubkey: string
              p_name?: string
              p_display_name?: string
              p_picture?: string
              p_npub?: string
              p_about?: string
              p_banner?: string
              p_nip05?: string
              p_lud16?: string
              p_website?: string
            }
        Returns: undefined
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
