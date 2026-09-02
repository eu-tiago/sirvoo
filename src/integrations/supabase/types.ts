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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_broadcasts: {
        Row: {
          channel: string
          created_at: string
          cta: string | null
          id: string
          message: string
          recipients_count: number
          segment: string
          sent_by: string
          title: string
        }
        Insert: {
          channel?: string
          created_at?: string
          cta?: string | null
          id?: string
          message: string
          recipients_count?: number
          segment: string
          sent_by: string
          title: string
        }
        Update: {
          channel?: string
          created_at?: string
          cta?: string | null
          id?: string
          message?: string
          recipients_count?: number
          segment?: string
          sent_by?: string
          title?: string
        }
        Relationships: []
      }
      church_members: {
        Row: {
          church_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          church_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          church_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_subscriptions: {
        Row: {
          church_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          max_users: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_users?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_users?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_subscriptions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          state: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          state?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          state?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      event_repertoire: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          notes: string | null
          performed_key: string | null
          position: number
          song_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          notes?: string | null
          performed_key?: string | null
          position?: number
          song_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          performed_key?: string | null
          position?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_repertoire_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_repertoire_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_repertoire_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string | null
          id: string
          is_recurring: boolean | null
          recurrence_rule: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          is_recurring?: boolean | null
          recurrence_rule?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          is_recurring?: boolean | null
          recurrence_rule?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          church_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          ministry_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          church_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          ministry_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          church_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          ministry_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          id: string
          member_id: string
          role_id: string
        }
        Insert: {
          id?: string
          member_id: string
          role_id: string
        }
        Update: {
          id?: string
          member_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ministry_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ministry_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          church_id: string
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          church_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_members: {
        Row: {
          id: string
          is_leader: boolean | null
          joined_at: string
          ministry_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_leader?: boolean | null
          joined_at?: string
          ministry_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_leader?: boolean | null
          joined_at?: string
          ministry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministry_members_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ministry_id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ministry_id: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ministry_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_roles_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_schedule_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_schedule_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_schedule_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_schedule_id_fkey"
            columns: ["related_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_songs: {
        Row: {
          church_id: string
          created_at: string
          id: string
          playlist_id: string
          position: number
          song_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          playlist_id: string
          position?: number
          song_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          reminders_enabled: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          reminders_enabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          reminders_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
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
      recurring_assignments: {
        Row: {
          active: boolean
          church_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          ministry_id: string
          occurrence: number
          role_id: string | null
          start_date: string | null
          time: string | null
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          active?: boolean
          church_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          ministry_id: string
          occurrence: number
          role_id?: string | null
          start_date?: string | null
          time?: string | null
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          active?: boolean
          church_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          ministry_id?: string
          occurrence?: number
          role_id?: string | null
          start_date?: string | null
          time?: string | null
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_assignments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_assignments_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ministry_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          church_id: string
          created_at: string
          day_of_week: number
          id: string
          ministry_id: string
          role_id: string | null
          user_id: string
          week_number: number
        }
        Insert: {
          church_id: string
          created_at?: string
          day_of_week: number
          id?: string
          ministry_id: string
          role_id?: string | null
          user_id: string
          week_number: number
        }
        Update: {
          church_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          ministry_id?: string
          role_id?: string | null
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ministry_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          notes: string | null
          original_user_id: string | null
          recurring_id: string | null
          role_id: string | null
          schedule_id: string
          status: string | null
          substitution_reason: string | null
          substitution_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          original_user_id?: string | null
          recurring_id?: string | null
          role_id?: string | null
          schedule_id: string
          status?: string | null
          substitution_reason?: string | null
          substitution_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          original_user_id?: string | null
          recurring_id?: string | null
          role_id?: string | null
          schedule_id?: string
          status?: string | null
          substitution_reason?: string | null
          substitution_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ministry_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_reminders: {
        Row: {
          assignment_id: string
          created_at: string
          event_id: string
          id: string
          remind_at: string
          reminder_type: string
          schedule_id: string
          sent: boolean
          sent_at: string | null
          user_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          event_id: string
          id?: string
          remind_at: string
          reminder_type?: string
          schedule_id: string
          sent?: boolean
          sent_at?: string | null
          user_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          event_id?: string
          id?: string
          remind_at?: string
          reminder_type?: string
          schedule_id?: string
          sent?: boolean
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_reminders_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_reminders_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_role_quotas: {
        Row: {
          created_at: string
          id: string
          quantity: number
          role_id: string | null
          schedule_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          role_id?: string | null
          schedule_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          role_id?: string | null
          schedule_id?: string
        }
        Relationships: []
      }
      schedule_songs: {
        Row: {
          chord_url: string | null
          created_at: string
          id: string
          notes: string | null
          schedule_id: string
          sort_order: number | null
          title: string
          youtube_url: string | null
        }
        Insert: {
          chord_url?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          schedule_id: string
          sort_order?: number | null
          title: string
          youtube_url?: string | null
        }
        Update: {
          chord_url?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          schedule_id?: string
          sort_order?: number | null
          title?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_songs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          ministry_id: string
          published_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          ministry_id: string
          published_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          ministry_id?: string
          published_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_pages: {
        Row: {
          allow_indexing: boolean
          changefreq: string | null
          created_at: string
          description: string | null
          h1: string | null
          id: string
          include_in_sitemap: boolean
          path: string
          priority: number | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_indexing?: boolean
          changefreq?: string | null
          created_at?: string
          description?: string | null
          h1?: string | null
          id?: string
          include_in_sitemap?: boolean
          path: string
          priority?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_indexing?: boolean
          changefreq?: string | null
          created_at?: string
          description?: string | null
          h1?: string | null
          id?: string
          include_in_sitemap?: boolean
          path?: string
          priority?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_robots: {
        Row: {
          content: string
          id: string
          updated_at: string
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_settings: {
        Row: {
          allow_indexing: boolean
          canonical_url: string | null
          created_at: string
          default_description: string
          default_keywords: string | null
          default_title: string
          domain_verification: string | null
          faq: Json | null
          google_analytics_id: string | null
          google_search_console_id: string | null
          id: string
          institutional_context: string | null
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          og_url: string | null
          product_description: string | null
          updated_at: string
        }
        Insert: {
          allow_indexing?: boolean
          canonical_url?: string | null
          created_at?: string
          default_description?: string
          default_keywords?: string | null
          default_title?: string
          domain_verification?: string | null
          faq?: Json | null
          google_analytics_id?: string | null
          google_search_console_id?: string | null
          id?: string
          institutional_context?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          og_url?: string | null
          product_description?: string | null
          updated_at?: string
        }
        Update: {
          allow_indexing?: boolean
          canonical_url?: string | null
          created_at?: string
          default_description?: string
          default_keywords?: string | null
          default_title?: string
          domain_verification?: string | null
          faq?: Json | null
          google_analytics_id?: string | null
          google_search_console_id?: string | null
          id?: string
          institutional_context?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          og_url?: string | null
          product_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      song_files: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          file_name: string
          file_type: string
          id: string
          size_bytes: number | null
          song_id: string
          storage_path: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          file_name: string
          file_type: string
          id?: string
          size_bytes?: number | null
          song_id: string
          storage_path: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_type?: string
          id?: string
          size_bytes?: number | null
          song_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_files_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_files_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          artist: string | null
          bpm: number | null
          category: string | null
          church_id: string
          cifra_url: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          id: string
          language: string | null
          multitracks_url: string | null
          notes: string | null
          original_key: string | null
          playback_url: string | null
          spotify_url: string | null
          time_signature: string | null
          title: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          artist?: string | null
          bpm?: number | null
          category?: string | null
          church_id: string
          cifra_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          language?: string | null
          multitracks_url?: string | null
          notes?: string | null
          original_key?: string | null
          playback_url?: string | null
          spotify_url?: string | null
          time_signature?: string | null
          title: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          artist?: string | null
          bpm?: number | null
          category?: string | null
          church_id?: string
          cifra_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          language?: string | null
          multitracks_url?: string | null
          notes?: string | null
          original_key?: string | null
          playback_url?: string | null
          spotify_url?: string | null
          time_signature?: string | null
          title?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          status: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
          status?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          status?: string
          stripe_event_id?: string
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
      swap_requests: {
        Row: {
          created_at: string
          id: string
          requested_id: string
          requester_assignment_id: string
          requester_id: string
          schedule_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_id: string
          requester_assignment_id: string
          requester_id: string
          schedule_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_id?: string
          requester_assignment_id?: string
          requester_id?: string
          schedule_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_requester_assignment_id_fkey"
            columns: ["requester_assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volunteer_availability: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_available: boolean | null
          reason: string | null
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_available?: boolean | null
          reason?: string | null
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_available?: boolean | null
          reason?: string | null
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      safe_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          phone: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_recurring_assignments: {
        Args: { _schedule_id: string }
        Returns: number
      }
      can_add_church_user: { Args: { _church_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_church_user_count: { Args: { _church_id: string }; Returns: number }
      get_invitation_email_statuses: {
        Args: { _church_id: string }
        Returns: {
          created_at: string
          error_message: string
          invitation_id: string
          message_id: string
          status: string
        }[]
      }
      get_user_church_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_church_admin: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_church_admin_of_user: {
        Args: { _admin_user_id: string; _target_user_id: string }
        Returns: boolean
      }
      is_church_leader: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_church_leader_of_user: {
        Args: { _leader_id: string; _target_user_id: string }
        Returns: boolean
      }
      is_church_member: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_ministry_member: {
        Args: { _ministry_id: string; _user_id: string }
        Returns: boolean
      }
      is_schedule_member: {
        Args: { _schedule_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      list_safe_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }[]
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
      occurrence_of_month: { Args: { _d: string }; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rotating_occurrence: { Args: { _d: string }; Returns: number }
      send_notification: {
        Args: {
          _message: string
          _related_schedule_id?: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: string
      }
      set_member_role: {
        Args: {
          _church_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      sync_recurring_for_range: {
        Args: { _church_id: string; _from: string; _to: string }
        Returns: number
      }
      users_share_church: {
        Args: { _admin_user_id: string; _target_user_id: string }
        Returns: boolean
      }
      users_share_church_any: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "ministry_leader" | "volunteer"
      subscription_plan: "free" | "basic" | "standard"
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
      app_role: ["admin", "ministry_leader", "volunteer"],
      subscription_plan: ["free", "basic", "standard"],
    },
  },
} as const
