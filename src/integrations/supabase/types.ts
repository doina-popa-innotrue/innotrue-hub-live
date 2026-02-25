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
      ac_assessment_results: {
        Row: {
          ac_contact_id: string | null
          ac_metadata: Json | null
          assessment_type_id: string
          contact_email: string
          contact_name: string | null
          created_at: string
          id: string
          matched_at: string | null
          received_at: string
          responses: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ac_contact_id?: string | null
          ac_metadata?: Json | null
          assessment_type_id: string
          contact_email: string
          contact_name?: string | null
          created_at?: string
          id?: string
          matched_at?: string | null
          received_at?: string
          responses?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ac_contact_id?: string | null
          ac_metadata?: Json | null
          assessment_type_id?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          matched_at?: string | null
          received_at?: string
          responses?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ac_assessment_results_assessment_type_id_fkey"
            columns: ["assessment_type_id"]
            isOneToOne: false
            referencedRelation: "ac_assessment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ac_assessment_shares: {
        Row: {
          assessment_result_id: string
          created_at: string
          id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          assessment_result_id: string
          created_at?: string
          id?: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          assessment_result_id?: string
          created_at?: string
          id?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac_assessment_shares_assessment_result_id_fkey"
            columns: ["assessment_result_id"]
            isOneToOne: false
            referencedRelation: "ac_assessment_results"
            referencedColumns: ["id"]
          },
        ]
      }
      ac_assessment_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          structure: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          structure?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          structure?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ac_interest_registrations: {
        Row: {
          ac_automation_name: string | null
          ac_contact_id: string | null
          ac_metadata: Json | null
          assessment_result_id: string | null
          assessment_summary: Json | null
          contact_email: string
          contact_name: string | null
          converted_at: string | null
          created_at: string
          enrollment_timeframe: string | null
          id: string
          notes: string | null
          program_id: string | null
          program_name: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ac_automation_name?: string | null
          ac_contact_id?: string | null
          ac_metadata?: Json | null
          assessment_result_id?: string | null
          assessment_summary?: Json | null
          contact_email: string
          contact_name?: string | null
          converted_at?: string | null
          created_at?: string
          enrollment_timeframe?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          program_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ac_automation_name?: string | null
          ac_contact_id?: string | null
          ac_metadata?: Json | null
          assessment_result_id?: string | null
          assessment_summary?: Json | null
          contact_email?: string
          contact_name?: string | null
          converted_at?: string | null
          created_at?: string
          enrollment_timeframe?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          program_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ac_interest_registrations_assessment_result_id_fkey"
            columns: ["assessment_result_id"]
            isOneToOne: false
            referencedRelation: "ac_assessment_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ac_interest_registrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ac_signup_intents: {
        Row: {
          ac_contact_id: string | null
          ac_data: Json | null
          consent_given: boolean | null
          converted_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          plan_interest: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ac_contact_id?: string | null
          ac_data?: Json | null
          consent_given?: boolean | null
          converted_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          plan_interest?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ac_contact_id?: string | null
          ac_data?: Json | null
          consent_given?: boolean | null
          converted_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          plan_interest?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activecampaign_sync_configs: {
        Row: {
          ac_target_id: string | null
          ac_target_name: string | null
          created_at: string
          created_by: string | null
          event_type: string
          field_mappings: Json | null
          filter_conditions: Json | null
          id: string
          is_active: boolean
          name: string
          sync_type: string
          updated_at: string
        }
        Insert: {
          ac_target_id?: string | null
          ac_target_name?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          field_mappings?: Json | null
          filter_conditions?: Json | null
          id?: string
          is_active?: boolean
          name: string
          sync_type: string
          updated_at?: string
        }
        Update: {
          ac_target_id?: string | null
          ac_target_name?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          field_mappings?: Json | null
          filter_conditions?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          sync_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      activecampaign_sync_logs: {
        Row: {
          ac_contact_id: string | null
          ac_response: Json | null
          config_id: string | null
          created_at: string
          error_message: string | null
          event_data: Json | null
          event_type: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          ac_contact_id?: string | null
          ac_response?: Json | null
          config_id?: string | null
          created_at?: string
          error_message?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          ac_contact_id?: string | null
          ac_response?: Json | null
          config_id?: string | null
          created_at?: string
          error_message?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activecampaign_sync_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "activecampaign_sync_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      add_on_consumption_log: {
        Row: {
          action_reference_id: string | null
          action_type: string
          created_at: string
          id: string
          notes: string | null
          quantity_consumed: number
          user_add_on_id: string
          user_id: string
        }
        Insert: {
          action_reference_id?: string | null
          action_type: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity_consumed?: number
          user_add_on_id: string
          user_id: string
        }
        Update: {
          action_reference_id?: string | null
          action_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity_consumed?: number
          user_add_on_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_consumption_log_user_add_on_id_fkey"
            columns: ["user_add_on_id"]
            isOneToOne: false
            referencedRelation: "user_add_ons"
            referencedColumns: ["id"]
          },
        ]
      }
      add_on_features: {
        Row: {
          add_on_id: string
          created_at: string
          feature_id: string
          id: string
        }
        Insert: {
          add_on_id: string
          created_at?: string
          feature_id: string
          id?: string
        }
        Update: {
          add_on_id?: string
          created_at?: string
          feature_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_features_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      add_ons: {
        Row: {
          created_at: string
          description: string | null
          display_name: string | null
          id: string
          initial_quantity: number | null
          is_active: boolean
          is_consumable: boolean
          key: string
          name: string
          price_cents: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          initial_quantity?: number | null
          is_active?: boolean
          is_consumable?: boolean
          key: string
          name: string
          price_cents?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          initial_quantity?: number | null
          is_active?: boolean
          is_consumable?: boolean
          key?: string
          name?: string
          price_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_preferences: {
        Row: {
          ai_insights_enabled: boolean
          ai_recommendations_enabled: boolean
          consent_given_at: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_insights_enabled?: boolean
          ai_recommendations_enabled?: boolean
          consent_given_at?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_insights_enabled?: boolean
          ai_recommendations_enabled?: boolean
          consent_given_at?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alumni_touchpoints: {
        Row: {
          enrollment_id: string
          id: string
          sent_at: string | null
          touchpoint_type: string
        }
        Insert: {
          enrollment_id: string
          id?: string
          sent_at?: string | null
          touchpoint_type: string
        }
        Update: {
          enrollment_id?: string
          id?: string
          sent_at?: string | null
          touchpoint_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alumni_touchpoints_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_touchpoints_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_category: string | null
          event_name: string
          event_properties: Json | null
          id: string
          page_url: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_category?: string | null
          event_name: string
          event_properties?: Json | null
          id?: string
          page_url?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_category?: string | null
          event_name?: string
          event_properties?: Json | null
          id?: string
          page_url?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_excluded_users: {
        Row: {
          created_at: string
          excluded_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          excluded_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          excluded_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      announcement_categories: {
        Row: {
          color: string | null
          created_at: string
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          category_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "announcement_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      assessment_definitions: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          feature_key: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          is_public: boolean | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_public?: boolean | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_definitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "assessment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_dimensions: {
        Row: {
          assessment_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_dimensions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_families: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessment_interest_registrations: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          notes: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_interest_registrations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "psychometric_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_interpretations: {
        Row: {
          assessment_id: string
          conditions: Json
          created_at: string
          description: string | null
          id: string
          interpretation_text: string
          name: string
          priority: number
        }
        Insert: {
          assessment_id: string
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          interpretation_text: string
          name: string
          priority?: number
        }
        Update: {
          assessment_id?: string
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          interpretation_text?: string
          name?: string
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_interpretations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_option_scores: {
        Row: {
          created_at: string
          dimension_id: string
          id: string
          option_id: string
          score: number
        }
        Insert: {
          created_at?: string
          dimension_id: string
          id?: string
          option_id: string
          score?: number
        }
        Update: {
          created_at?: string
          dimension_id?: string
          id?: string
          option_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_option_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "assessment_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_option_scores_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "assessment_options"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_options: {
        Row: {
          created_at: string
          id: string
          option_text: string
          order_index: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_text: string
          order_index?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_text?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          is_required: boolean | null
          order_index: number
          question_text: string
          question_type: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          order_index?: number
          question_text: string
          question_type?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          order_index?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          assessment_id: string
          completed_at: string
          created_at: string
          dimension_scores: Json
          email: string | null
          id: string
          interpretations: Json
          name: string | null
          newsletter_consent: boolean | null
          plan_interest: string | null
          responses: Json
          user_id: string | null
        }
        Insert: {
          assessment_id: string
          completed_at?: string
          created_at?: string
          dimension_scores?: Json
          email?: string | null
          id?: string
          interpretations?: Json
          name?: string | null
          newsletter_consent?: boolean | null
          plan_interest?: string | null
          responses?: Json
          user_id?: string | null
        }
        Update: {
          assessment_id?: string
          completed_at?: string
          created_at?: string
          dimension_scores?: Json
          email?: string | null
          id?: string
          interpretations?: Json
          name?: string | null
          newsletter_consent?: boolean | null
          plan_interest?: string | null
          responses?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_contexts: {
        Row: {
          allow_slug_access: boolean
          auto_assign_track: boolean | null
          auto_enroll_program: boolean | null
          context_type: string
          created_at: string | null
          default_to_signup: boolean | null
          description: string | null
          features: Json | null
          headline: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          organization_id: string | null
          primary_color: string | null
          program_id: string | null
          public_code: string | null
          slug: string
          subheadline: string | null
          track_id: string | null
          updated_at: string | null
        }
        Insert: {
          allow_slug_access?: boolean
          auto_assign_track?: boolean | null
          auto_enroll_program?: boolean | null
          context_type: string
          created_at?: string | null
          default_to_signup?: boolean | null
          description?: string | null
          features?: Json | null
          headline: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          program_id?: string | null
          public_code?: string | null
          slug: string
          subheadline?: string | null
          track_id?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_slug_access?: boolean
          auto_assign_track?: boolean | null
          auto_enroll_program?: boolean | null
          context_type?: string
          created_at?: string | null
          default_to_signup?: boolean | null
          description?: string | null
          features?: Json | null
          headline?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          program_id?: string | null
          public_code?: string | null
          slug?: string
          subheadline?: string | null
          track_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_contexts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_contexts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_contexts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_info: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string | null
          id: string
          postal_code: string | null
          updated_at: string | null
          user_id: string
          vat: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          postal_code?: string | null
          updated_at?: string | null
          user_id: string
          vat?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          postal_code?: string | null
          updated_at?: string | null
          user_id?: string
          vat?: string | null
        }
        Relationships: []
      }
      calcom_event_type_mappings: {
        Row: {
          calcom_event_type_id: number
          calcom_event_type_name: string | null
          calcom_event_type_slug: string | null
          created_at: string
          default_group_id: string | null
          default_module_id: string | null
          default_program_id: string | null
          id: string
          is_active: boolean | null
          module_type: string | null
          scheduling_url: string | null
          session_target: string
          updated_at: string
        }
        Insert: {
          calcom_event_type_id: number
          calcom_event_type_name?: string | null
          calcom_event_type_slug?: string | null
          created_at?: string
          default_group_id?: string | null
          default_module_id?: string | null
          default_program_id?: string | null
          id?: string
          is_active?: boolean | null
          module_type?: string | null
          scheduling_url?: string | null
          session_target: string
          updated_at?: string
        }
        Update: {
          calcom_event_type_id?: number
          calcom_event_type_name?: string | null
          calcom_event_type_slug?: string | null
          created_at?: string
          default_group_id?: string | null
          default_module_id?: string | null
          default_program_id?: string | null
          id?: string
          is_active?: boolean | null
          module_type?: string | null
          scheduling_url?: string | null
          session_target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calcom_event_type_mappings_default_group_id_fkey"
            columns: ["default_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calcom_event_type_mappings_default_module_id_fkey"
            columns: ["default_module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calcom_event_type_mappings_default_program_id_fkey"
            columns: ["default_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calcom_event_type_mappings_module_type_fkey"
            columns: ["module_type"]
            isOneToOne: false
            referencedRelation: "module_types"
            referencedColumns: ["name"]
          },
        ]
      }
      calcom_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
        }
        Relationships: []
      }
      capability_assessments: {
        Row: {
          allow_instructor_eval: boolean
          assessment_mode: string
          category_id: string | null
          created_at: string
          description: string | null
          family_id: string | null
          feature_key: string | null
          id: string
          instructions: string | null
          instructions_evaluator: string | null
          instructions_self: string | null
          is_active: boolean
          is_public: boolean
          is_retired: boolean
          name: string
          pass_fail_enabled: boolean
          pass_fail_mode: string | null
          pass_fail_threshold: number | null
          program_id: string | null
          question_types: Json | null
          rating_scale: number
          slug: string
          updated_at: string
        }
        Insert: {
          allow_instructor_eval?: boolean
          assessment_mode?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id?: string | null
          feature_key?: string | null
          id?: string
          instructions?: string | null
          instructions_evaluator?: string | null
          instructions_self?: string | null
          is_active?: boolean
          is_public?: boolean
          is_retired?: boolean
          name: string
          pass_fail_enabled?: boolean
          pass_fail_mode?: string | null
          pass_fail_threshold?: number | null
          program_id?: string | null
          question_types?: Json | null
          rating_scale?: number
          slug: string
          updated_at?: string
        }
        Update: {
          allow_instructor_eval?: boolean
          assessment_mode?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id?: string | null
          feature_key?: string | null
          id?: string
          instructions?: string | null
          instructions_evaluator?: string | null
          instructions_self?: string | null
          is_active?: boolean
          is_public?: boolean
          is_retired?: boolean
          name?: string
          pass_fail_enabled?: boolean
          pass_fail_mode?: string | null
          pass_fail_threshold?: number | null
          program_id?: string | null
          question_types?: Json | null
          rating_scale?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_assessments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "assessment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_assessments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "assessment_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_assessments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_domain_notes: {
        Row: {
          content: string
          created_at: string
          domain_id: string
          id: string
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          domain_id: string
          id?: string
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          domain_id?: string
          id?: string
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_domain_notes_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_domain_notes_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_domain_questions: {
        Row: {
          created_at: string
          description: string | null
          domain_id: string
          id: string
          input_type: string
          options: Json | null
          order_index: number
          question_text: string
          question_type: string | null
          type_weight: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain_id: string
          id?: string
          input_type?: string
          options?: Json | null
          order_index?: number
          question_text: string
          question_type?: string | null
          type_weight?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          domain_id?: string
          id?: string
          input_type?: string
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string | null
          type_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_domain_questions_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_domains: {
        Row: {
          assessment_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "capability_domains_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_question_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          question_id: string
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          question_id: string
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          question_id?: string
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_question_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_question_notes_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_snapshot_ratings: {
        Row: {
          created_at: string
          domain_name_snapshot: string | null
          id: string
          question_id: string
          question_text_snapshot: string | null
          rating: number
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_name_snapshot?: string | null
          id?: string
          question_id: string
          question_text_snapshot?: string | null
          rating: number
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_name_snapshot?: string | null
          id?: string
          question_id?: string
          question_text_snapshot?: string | null
          rating?: number
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_snapshot_ratings_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshot_ratings_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_snapshots: {
        Row: {
          assessment_id: string
          completed_at: string | null
          created_at: string
          enrollment_id: string | null
          evaluation_relationship: string | null
          evaluator_id: string | null
          id: string
          is_private: boolean
          is_self_assessment: boolean
          notes: string | null
          shared_with_coach: boolean
          shared_with_instructor: boolean
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string | null
          evaluation_relationship?: string | null
          evaluator_id?: string | null
          id?: string
          is_private?: boolean
          is_self_assessment?: boolean
          notes?: string | null
          shared_with_coach?: boolean
          shared_with_instructor?: boolean
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string | null
          evaluation_relationship?: string | null
          evaluator_id?: string | null
          id?: string
          is_private?: boolean
          is_self_assessment?: boolean
          notes?: string | null
          shared_with_coach?: boolean
          shared_with_instructor?: boolean
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_snapshots_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_interest_registrations: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      circle_users: {
        Row: {
          circle_email: string
          circle_user_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          circle_email: string
          circle_user_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          circle_email?: string
          circle_user_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      client_badge_credentials: {
        Row: {
          acceptance_url: string | null
          accepted_at: string | null
          client_badge_id: string
          created_at: string
          id: string
          program_badge_credential_id: string
        }
        Insert: {
          acceptance_url?: string | null
          accepted_at?: string | null
          client_badge_id: string
          created_at?: string
          id?: string
          program_badge_credential_id: string
        }
        Update: {
          acceptance_url?: string | null
          accepted_at?: string | null
          client_badge_id?: string
          created_at?: string
          id?: string
          program_badge_credential_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_badge_credentials_client_badge_id_fkey"
            columns: ["client_badge_id"]
            isOneToOne: false
            referencedRelation: "client_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_badge_credentials_program_badge_credential_id_fkey"
            columns: ["program_badge_credential_id"]
            isOneToOne: false
            referencedRelation: "program_badge_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      client_badges: {
        Row: {
          created_at: string
          enrollment_id: string
          expires_at: string | null
          id: string
          image_path: string | null
          is_private: boolean
          is_public: boolean
          issued_at: string | null
          issued_by: string | null
          program_badge_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          expires_at?: string | null
          id?: string
          image_path?: string | null
          is_private?: boolean
          is_public?: boolean
          issued_at?: string | null
          issued_by?: string | null
          program_badge_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          expires_at?: string | null
          id?: string
          image_path?: string | null
          is_private?: boolean
          is_public?: boolean
          issued_at?: string | null
          issued_by?: string | null
          program_badge_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_badges_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_badges_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_badges_program_badge_id_fkey"
            columns: ["program_badge_id"]
            isOneToOne: false
            referencedRelation: "program_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      client_coaches: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      client_enrollments: {
        Row: {
          client_user_id: string | null
          cohort_id: string | null
          completed_at: string | null
          created_at: string | null
          discount_code_id: string | null
          discount_percent: number | null
          end_date: string | null
          enrollment_code_id: string | null
          enrollment_number: number | null
          enrollment_source: string | null
          final_credit_cost: number | null
          id: string
          is_public: boolean
          original_credit_cost: number | null
          payment_status: string | null
          payment_type: string | null
          program_id: string
          program_plan_id: string | null
          program_version_id: string | null
          referral_note: string | null
          referred_by: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          stripe_subscription_id: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          client_user_id?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          discount_code_id?: string | null
          discount_percent?: number | null
          end_date?: string | null
          enrollment_code_id?: string | null
          enrollment_number?: number | null
          enrollment_source?: string | null
          final_credit_cost?: number | null
          id?: string
          is_public?: boolean
          original_credit_cost?: number | null
          payment_status?: string | null
          payment_type?: string | null
          program_id: string
          program_plan_id?: string | null
          program_version_id?: string | null
          referral_note?: string | null
          referred_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          client_user_id?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          discount_code_id?: string | null
          discount_percent?: number | null
          end_date?: string | null
          enrollment_code_id?: string | null
          enrollment_number?: number | null
          enrollment_source?: string | null
          final_credit_cost?: number | null
          id?: string
          is_public?: boolean
          original_credit_cost?: number | null
          payment_status?: string | null
          payment_type?: string | null
          program_id?: string
          program_plan_id?: string | null
          program_version_id?: string | null
          referral_note?: string | null
          referred_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "program_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_enrollment_code_id_fkey"
            columns: ["enrollment_code_id"]
            isOneToOne: false
            referencedRelation: "enrollment_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_program_plan_id_fkey"
            columns: ["program_plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_program_version_id_fkey"
            columns: ["program_version_id"]
            isOneToOne: false
            referencedRelation: "program_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_instructors: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          instructor_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          instructor_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          instructor_id?: string
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["user_status"]
          status_marker: string | null
          tags: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          status_marker?: string | null
          tags?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          status_marker?: string | null
          tags?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      client_staff_note_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          note_id: string
          title: string
          url: string | null
        }
        Insert: {
          attachment_type?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          note_id: string
          title: string
          url?: string | null
        }
        Update: {
          attachment_type?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          note_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_staff_note_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "client_staff_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_staff_notes: {
        Row: {
          author_id: string
          client_user_id: string
          content: string | null
          created_at: string
          enrollment_id: string | null
          id: string
          is_flagged: boolean
          is_private: boolean
          note_type: string
          sentiment: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          client_user_id: string
          content?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          is_flagged?: boolean
          is_private?: boolean
          note_type?: string
          sentiment?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          client_user_id?: string
          content?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          is_flagged?: boolean
          is_private?: boolean
          note_type?: string
          sentiment?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_staff_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_staff_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_access_logs: {
        Row: {
          access_type: string
          accessed_at: string
          client_id: string
          coach_id: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string
          client_id: string
          coach_id: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string
          client_id?: string
          coach_id?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      coach_feedback_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          description: string | null
          feedback_id: string
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          title: string
          url: string | null
        }
        Insert: {
          attachment_type: string
          created_at?: string
          description?: string | null
          feedback_id: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title: string
          url?: string | null
        }
        Update: {
          attachment_type?: string
          created_at?: string
          description?: string | null
          feedback_id?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_feedback_attachments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "coach_module_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_instructor_requests: {
        Row: {
          admin_notes: string | null
          bio: string | null
          certifications: string | null
          created_at: string | null
          id: string
          message: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          scheduling_url: string | null
          source_type: string | null
          specialties: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          bio?: string | null
          certifications?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduling_url?: string | null
          source_type?: string | null
          specialties?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          bio?: string | null
          certifications?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduling_url?: string | null
          source_type?: string | null
          specialties?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coach_module_feedback: {
        Row: {
          coach_id: string
          created_at: string | null
          feedback: string | null
          id: string
          module_progress_id: string
          status: string
          structured_responses: Json | null
          template_type_id: string | null
          updated_at: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          module_progress_id: string
          status?: string
          structured_responses?: Json | null
          template_type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          module_progress_id?: string
          status?: string
          structured_responses?: Json | null
          template_type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_module_feedback_module_progress_id_fkey"
            columns: ["module_progress_id"]
            isOneToOne: false
            referencedRelation: "module_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_module_feedback_template_type_id_fkey"
            columns: ["template_type_id"]
            isOneToOne: false
            referencedRelation: "feedback_template_types"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_consent_preferences: {
        Row: {
          consent_given_at: string | null
          consent_updated_at: string
          created_at: string
          id: string
          share_assessments: boolean
          share_decisions: boolean
          share_development_items: boolean
          share_goals: boolean
          share_progress: boolean
          share_tasks: boolean
          user_id: string
        }
        Insert: {
          consent_given_at?: string | null
          consent_updated_at?: string
          created_at?: string
          id?: string
          share_assessments?: boolean
          share_decisions?: boolean
          share_development_items?: boolean
          share_goals?: boolean
          share_progress?: boolean
          share_tasks?: boolean
          user_id: string
        }
        Update: {
          consent_given_at?: string | null
          consent_updated_at?: string
          created_at?: string
          id?: string
          share_assessments?: boolean
          share_decisions?: boolean
          share_development_items?: boolean
          share_goals?: boolean
          share_progress?: boolean
          share_tasks?: boolean
          user_id?: string
        }
        Relationships: []
      }
      cohort_session_attendance: {
        Row: {
          created_at: string | null
          enrollment_id: string
          id: string
          marked_at: string | null
          marked_by: string | null
          notes: string | null
          session_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enrollment_id: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          session_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          session_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_session_attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_session_attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cohort_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_session_reminder_log: {
        Row: {
          id: string
          recipients_count: number | null
          reminder_type: string
          sent_at: string | null
          session_id: string
        }
        Insert: {
          id?: string
          recipients_count?: number | null
          reminder_type: string
          sent_at?: string | null
          session_id: string
        }
        Update: {
          id?: string
          recipients_count?: number | null
          reminder_type?: string
          sent_at?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_session_reminder_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cohort_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_sessions: {
        Row: {
          cohort_id: string
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          instructor_id: string | null
          location: string | null
          meeting_link: string | null
          module_id: string | null
          notes: string | null
          order_index: number
          recap: string | null
          recording_url: string | null
          session_date: string
          start_time: string | null
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          instructor_id?: string | null
          location?: string | null
          meeting_link?: string | null
          module_id?: string | null
          notes?: string | null
          order_index?: number
          recap?: string | null
          recording_url?: string | null
          session_date: string
          start_time?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          instructor_id?: string | null
          location?: string | null
          meeting_link?: string | null
          module_id?: string | null
          notes?: string | null
          order_index?: number
          recap?: string | null
          recording_url?: string | null
          session_date?: string
          start_time?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "program_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_waitlist: {
        Row: {
          cohort_id: string
          created_at: string | null
          id: string
          notified: boolean | null
          position: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string | null
          id?: string
          notified?: boolean | null
          position: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string | null
          id?: string
          notified?: boolean | null
          position?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_waitlist_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "program_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_completions: {
        Row: {
          completed_at: string
          content_package_id: string
          created_at: string
          id: string
          result_score_scaled: number | null
          source_enrollment_id: string | null
          source_module_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          content_package_id: string
          created_at?: string
          id?: string
          result_score_scaled?: number | null
          source_enrollment_id?: string | null
          source_module_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string
          content_package_id?: string
          created_at?: string
          id?: string
          result_score_scaled?: number | null
          source_enrollment_id?: string | null
          source_module_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_completions_content_package_id_fkey"
            columns: ["content_package_id"]
            isOneToOne: false
            referencedRelation: "content_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_completions_source_enrollment_id_fkey"
            columns: ["source_enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_completions_source_enrollment_id_fkey"
            columns: ["source_enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_completions_source_module_id_fkey"
            columns: ["source_module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      content_packages: {
        Row: {
          created_at: string
          description: string | null
          file_count: number | null
          id: string
          is_active: boolean | null
          original_filename: string | null
          package_type: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_count?: number | null
          id?: string
          is_active?: boolean | null
          original_filename?: string | null
          package_type?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_count?: number | null
          id?: string
          is_active?: boolean | null
          original_filename?: string | null
          package_type?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      cookie_consent: {
        Row: {
          analytics: boolean
          consent_given_at: string
          id: string
          ip_address: string | null
          marketing: boolean
          necessary: boolean
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          consent_given_at?: string
          id?: string
          ip_address?: string | null
          marketing?: boolean
          necessary?: boolean
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          consent_given_at?: string
          id?: string
          ip_address?: string | null
          marketing?: boolean
          necessary?: boolean
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      credit_batches: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string
          feature_key: string | null
          granted_at: string
          id: string
          is_expired: boolean
          original_amount: number
          owner_id: string
          owner_type: string
          remaining_amount: number
          source_reference_id: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at: string
          feature_key?: string | null
          granted_at?: string
          id?: string
          is_expired?: boolean
          original_amount: number
          owner_id: string
          owner_type: string
          remaining_amount: number
          source_reference_id?: string | null
          source_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string
          feature_key?: string | null
          granted_at?: string
          id?: string
          is_expired?: boolean
          original_amount?: number
          owner_id?: string
          owner_type?: string
          remaining_amount?: number
          source_reference_id?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_batches_source_type_fkey"
            columns: ["source_type"]
            isOneToOne: false
            referencedRelation: "credit_source_types"
            referencedColumns: ["key"]
          },
        ]
      }
      credit_consumption_log: {
        Row: {
          action_reference_id: string | null
          action_type: string | null
          batch_id: string | null
          consumed_at: string
          created_at: string
          description: string | null
          feature_key: string | null
          id: string
          organization_id: string | null
          quantity: number
          source_type: string
          user_id: string
        }
        Insert: {
          action_reference_id?: string | null
          action_type?: string | null
          batch_id?: string | null
          consumed_at?: string
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          organization_id?: string | null
          quantity?: number
          source_type: string
          user_id: string
        }
        Update: {
          action_reference_id?: string | null
          action_type?: string | null
          batch_id?: string | null
          consumed_at?: string
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          organization_id?: string | null
          quantity?: number
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_services: {
        Row: {
          category: string
          created_at: string
          credit_cost: number
          description: string | null
          feature_id: string | null
          id: string
          is_active: boolean
          linked_entity_id: string | null
          linked_entity_type: string | null
          name: string
          track_discounted_cost: number | null
          track_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          credit_cost?: number
          description?: string | null
          feature_id?: string | null
          id?: string
          is_active?: boolean
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          name: string
          track_discounted_cost?: number | null
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          credit_cost?: number
          description?: string | null
          feature_id?: string | null
          id?: string
          is_active?: boolean
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          name?: string
          track_discounted_cost?: number | null
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_services_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_services_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_source_types: {
        Row: {
          created_at: string
          default_expiry_months: number | null
          description: string | null
          display_name: string
          is_active: boolean
          key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_expiry_months?: number | null
          description?: string | null
          display_name: string
          is_active?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_expiry_months?: number | null
          description?: string | null
          display_name?: string
          is_active?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_topup_packages: {
        Row: {
          created_at: string | null
          credit_value: number
          currency: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          max_per_user: number | null
          name: string
          price_cents: number
          slug: string
          stripe_price_id: string | null
          updated_at: string | null
          validity_months: number | null
        }
        Insert: {
          created_at?: string | null
          credit_value?: number
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          max_per_user?: number | null
          name: string
          price_cents?: number
          slug: string
          stripe_price_id?: string | null
          updated_at?: string | null
          validity_months?: number | null
        }
        Update: {
          created_at?: string | null
          credit_value?: number
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          max_per_user?: number | null
          name?: string
          price_cents?: number
          slug?: string
          stripe_price_id?: string | null
          updated_at?: string | null
          validity_months?: number | null
        }
        Relationships: []
      }
      credit_usage_periods: {
        Row: {
          created_at: string
          credits_used: number
          feature_key: string | null
          id: string
          owner_id: string
          owner_type: string
          period_end: string
          period_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          feature_key?: string | null
          id?: string
          owner_id: string
          owner_type: string
          period_end: string
          period_start: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          feature_key?: string | null
          id?: string
          owner_id?: string
          owner_type?: string
          period_end?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      decision_capability_settings: {
        Row: {
          capability: string
          created_at: string
          feature_key: string
          id: string
          updated_at: string
        }
        Insert: {
          capability: string
          created_at?: string
          feature_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          capability?: string
          created_at?: string
          feature_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      decision_comments: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string | null
          decision_id: string
          id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string | null
          decision_id: string
          id?: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string | null
          decision_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_comments_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_cons: {
        Row: {
          created_at: string | null
          decision_id: string
          id: string
          option_id: string
          text: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          decision_id: string
          id?: string
          option_id: string
          text: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string
          id?: string
          option_id?: string
          text?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_cons_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_cons_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "decision_options"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_goals: {
        Row: {
          decision_id: string
          goal_id: string
          id: string
        }
        Insert: {
          decision_id: string
          goal_id: string
          id?: string
        }
        Update: {
          decision_id?: string
          goal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_goals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_goals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_journal_entries: {
        Row: {
          content: string
          created_at: string
          decision_id: string
          entry_date: string
          id: string
          mood: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          decision_id: string
          entry_date?: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          decision_id?: string
          entry_date?: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_journal_entries_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_options: {
        Row: {
          created_at: string | null
          decision_id: string
          description: string | null
          emotion_notes: string | null
          id: string
          label: string
          overall_score: number | null
        }
        Insert: {
          created_at?: string | null
          decision_id: string
          description?: string | null
          emotion_notes?: string | null
          id?: string
          label: string
          overall_score?: number | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string
          description?: string | null
          emotion_notes?: string | null
          id?: string
          label?: string
          overall_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_options_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_pros: {
        Row: {
          created_at: string | null
          decision_id: string
          id: string
          option_id: string
          text: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          decision_id: string
          id?: string
          option_id: string
          text: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string
          id?: string
          option_id?: string
          text?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_pros_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_pros_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "decision_options"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_reflections: {
        Row: {
          alignment_with_values_score: number | null
          created_at: string | null
          decision_id: string
          id: string
          satisfaction_score: number | null
          unexpected_results: string | null
          what_did_not_go_well: string | null
          what_i_learned: string | null
          what_went_well: string | null
        }
        Insert: {
          alignment_with_values_score?: number | null
          created_at?: string | null
          decision_id: string
          id?: string
          satisfaction_score?: number | null
          unexpected_results?: string | null
          what_did_not_go_well?: string | null
          what_i_learned?: string | null
          what_went_well?: string | null
        }
        Update: {
          alignment_with_values_score?: number | null
          created_at?: string | null
          decision_id?: string
          id?: string
          satisfaction_score?: number | null
          unexpected_results?: string | null
          what_did_not_go_well?: string | null
          what_i_learned?: string | null
          what_went_well?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_reflections_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_reminders: {
        Row: {
          completed_at: string | null
          created_at: string | null
          decision_id: string
          description: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          is_completed: boolean | null
          reminder_date: string
          reminder_type: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          decision_id: string
          description?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_completed?: boolean | null
          reminder_date: string
          reminder_type: string
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          decision_id?: string
          description?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_completed?: boolean | null
          reminder_date?: string
          reminder_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_reminders_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_sharing_audit: {
        Row: {
          changed_at: string
          changed_by: string
          decision_id: string
          id: string
          ip_address: string | null
          new_value: boolean
          old_value: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          decision_id: string
          id?: string
          ip_address?: string | null
          new_value: boolean
          old_value: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          decision_id?: string
          id?: string
          ip_address?: string | null
          new_value?: boolean
          old_value?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_sharing_audit_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_values: {
        Row: {
          alignment_score: number | null
          created_at: string | null
          decision_id: string
          id: string
          notes: string | null
          value_name: string
        }
        Insert: {
          alignment_score?: number | null
          created_at?: string | null
          decision_id: string
          id?: string
          notes?: string | null
          value_name: string
        }
        Update: {
          alignment_score?: number | null
          created_at?: string | null
          decision_id?: string
          id?: string
          notes?: string | null
          value_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_values_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          actual_outcome: string | null
          buyers_model_notes: string | null
          confidence_level: number | null
          created_at: string | null
          crossroads_notes: string | null
          deadline: string | null
          decision_date: string | null
          description: string | null
          expected_outcome: string | null
          id: string
          importance: Database["public"]["Enums"]["importance_level"] | null
          internal_check_notes: string | null
          options_summary: string | null
          shared_with_coach: boolean
          status: Database["public"]["Enums"]["decision_status"]
          stop_rule_notes: string | null
          ten_ten_ten_notes: string | null
          title: string
          updated_at: string | null
          urgency: Database["public"]["Enums"]["urgency_level"] | null
          user_id: string
          values_alignment_notes: string | null
          yes_no_rule_notes: string | null
        }
        Insert: {
          actual_outcome?: string | null
          buyers_model_notes?: string | null
          confidence_level?: number | null
          created_at?: string | null
          crossroads_notes?: string | null
          deadline?: string | null
          decision_date?: string | null
          description?: string | null
          expected_outcome?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["importance_level"] | null
          internal_check_notes?: string | null
          options_summary?: string | null
          shared_with_coach?: boolean
          status?: Database["public"]["Enums"]["decision_status"]
          stop_rule_notes?: string | null
          ten_ten_ten_notes?: string | null
          title: string
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"] | null
          user_id: string
          values_alignment_notes?: string | null
          yes_no_rule_notes?: string | null
        }
        Update: {
          actual_outcome?: string | null
          buyers_model_notes?: string | null
          confidence_level?: number | null
          created_at?: string | null
          crossroads_notes?: string | null
          deadline?: string | null
          decision_date?: string | null
          description?: string | null
          expected_outcome?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["importance_level"] | null
          internal_check_notes?: string | null
          options_summary?: string | null
          shared_with_coach?: boolean
          status?: Database["public"]["Enums"]["decision_status"]
          stop_rule_notes?: string | null
          ten_ten_ten_notes?: string | null
          title?: string
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"] | null
          user_id?: string
          values_alignment_notes?: string | null
          yes_no_rule_notes?: string | null
        }
        Relationships: []
      }
      development_item_domain_links: {
        Row: {
          created_at: string
          development_item_id: string
          domain_id: string
          id: string
          snapshot_id: string | null
        }
        Insert: {
          created_at?: string
          development_item_id: string
          domain_id: string
          id?: string
          snapshot_id?: string | null
        }
        Update: {
          created_at?: string
          development_item_id?: string
          domain_id?: string
          id?: string
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_item_domain_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_domain_links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_domain_links_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_goal_links: {
        Row: {
          created_at: string
          development_item_id: string
          goal_id: string
          id: string
        }
        Insert: {
          created_at?: string
          development_item_id: string
          goal_id: string
          id?: string
        }
        Update: {
          created_at?: string
          development_item_id?: string
          goal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_item_goal_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_goal_links_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_group_links: {
        Row: {
          created_at: string
          development_item_id: string
          group_id: string
          id: string
        }
        Insert: {
          created_at?: string
          development_item_id: string
          group_id: string
          id?: string
        }
        Update: {
          created_at?: string
          development_item_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_item_group_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_group_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_milestone_links: {
        Row: {
          created_at: string
          development_item_id: string
          id: string
          milestone_id: string
        }
        Insert: {
          created_at?: string
          development_item_id: string
          id?: string
          milestone_id: string
        }
        Update: {
          created_at?: string
          development_item_id?: string
          id?: string
          milestone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_item_milestone_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_milestone_links_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "goal_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_module_links: {
        Row: {
          created_at: string
          development_item_id: string
          id: string
          module_progress_id: string
        }
        Insert: {
          created_at?: string
          development_item_id: string
          id?: string
          module_progress_id: string
        }
        Update: {
          created_at?: string
          development_item_id?: string
          id?: string
          module_progress_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_item_module_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_module_links_module_progress_id_fkey"
            columns: ["module_progress_id"]
            isOneToOne: false
            referencedRelation: "module_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_question_links: {
        Row: {
          created_at: string
          development_item_id: string
          id: string
          question_id: string
          snapshot_id: string | null
        }
        Insert: {
          created_at?: string
          development_item_id: string
          id?: string
          question_id: string
          snapshot_id?: string | null
        }
        Update: {
          created_at?: string
          development_item_id?: string
          id?: string
          question_id?: string
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_item_question_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_question_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_question_links_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_snapshot_links: {
        Row: {
          created_at: string
          development_item_id: string
          id: string
          snapshot_id: string
        }
        Insert: {
          created_at?: string
          development_item_id: string
          id?: string
          snapshot_id: string
        }
        Update: {
          created_at?: string
          development_item_id?: string
          id?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_item_snapshot_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_snapshot_links_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_task_links: {
        Row: {
          created_at: string
          development_item_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          development_item_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          development_item_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_item_task_links_development_item_id_fkey"
            columns: ["development_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_item_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      development_items: {
        Row: {
          author_id: string | null
          cohort_session_id: string | null
          completed_at: string | null
          content: string | null
          created_at: string
          due_date: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_private: boolean
          item_type: string
          library_resource_id: string | null
          mime_type: string | null
          prompt_id: string | null
          resource_type: string | null
          resource_url: string | null
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          author_id?: string | null
          cohort_session_id?: string | null
          completed_at?: string | null
          content?: string | null
          created_at?: string
          due_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_private?: boolean
          item_type: string
          library_resource_id?: string | null
          mime_type?: string | null
          prompt_id?: string | null
          resource_type?: string | null
          resource_url?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          author_id?: string | null
          cohort_session_id?: string | null
          completed_at?: string | null
          content?: string | null
          created_at?: string
          due_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_private?: boolean
          item_type?: string
          library_resource_id?: string | null
          mime_type?: string | null
          prompt_id?: string | null
          resource_type?: string | null
          resource_url?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_items_cohort_session_id_fkey"
            columns: ["cohort_session_id"]
            isOneToOne: false
            referencedRelation: "cohort_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_items_library_resource_id_fkey"
            columns: ["library_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_items_library_resource_id_fkey"
            columns: ["library_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_items_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "generated_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_uses: {
        Row: {
          created_at: string | null
          discount_amount_credits: number | null
          discount_code_id: string
          enrollment_id: string | null
          final_price_credits: number | null
          id: string
          original_price_credits: number | null
          program_id: string | null
          stripe_payment_intent_id: string | null
          tier_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          discount_amount_credits?: number | null
          discount_code_id: string
          enrollment_id?: string | null
          final_price_credits?: number | null
          id?: string
          original_price_credits?: number | null
          program_id?: string | null
          stripe_payment_intent_id?: string | null
          tier_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          discount_amount_credits?: number | null
          discount_code_id?: string
          enrollment_id?: string | null
          final_price_credits?: number | null
          id?: string
          original_price_credits?: number | null
          program_id?: string | null
          stripe_payment_intent_id?: string | null
          tier_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_uses_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_uses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_uses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_uses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          assigned_user_email: string | null
          assigned_user_id: string | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          starts_at: string | null
          updated_at: string | null
          uses_count: number | null
          valid_for_program_ids: string[] | null
          valid_for_tier_names: string[] | null
        }
        Insert: {
          assigned_user_email?: string | null
          assigned_user_id?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          starts_at?: string | null
          updated_at?: string | null
          uses_count?: number | null
          valid_for_program_ids?: string[] | null
          valid_for_tier_names?: string[] | null
        }
        Update: {
          assigned_user_email?: string | null
          assigned_user_id?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          starts_at?: string | null
          updated_at?: string | null
          uses_count?: number | null
          valid_for_program_ids?: string[] | null
          valid_for_tier_names?: string[] | null
        }
        Relationships: []
      }
      domain_collection_links: {
        Row: {
          collection_id: string
          created_at: string | null
          domain_id: string
          id: string
          notes: string | null
          order_index: number | null
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          domain_id: string
          id?: string
          notes?: string | null
          order_index?: number | null
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          domain_id?: string
          id?: string
          notes?: string | null
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_collection_links_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "resource_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_collection_links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_module_links: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          module_id: string
          notes: string | null
          order_index: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          module_id: string
          notes?: string | null
          order_index?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          module_id?: string
          notes?: string | null
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_module_links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_module_links_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_program_links: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          notes: string | null
          order_index: number | null
          program_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          notes?: string | null
          order_index?: number | null
          program_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          notes?: string | null
          order_index?: number | null
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_program_links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_program_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_resource_links: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          notes: string | null
          order_index: number | null
          resource_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          notes?: string | null
          order_index?: number | null
          resource_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          notes?: string | null
          order_index?: number | null
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_resource_links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_resource_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_resource_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      email_change_requests: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          new_email: string
          old_email: string
          token_hash: string | null
          user_id: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          new_email: string
          old_email: string
          token_hash?: string | null
          user_id: string
          verification_token: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          new_email?: string
          old_email?: string
          token_hash?: string | null
          user_id?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          notification_id: string | null
          recipient_email: string
          recipient_name: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          template_data: Json | null
          template_key: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          notification_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          template_data?: Json | null
          template_key: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          notification_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          template_data?: Json | null
          template_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_assets: {
        Row: {
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          file_url: string
          id: string
          is_system_logo: boolean | null
          mime_type: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_url: string
          id?: string
          is_system_logo?: boolean | null
          mime_type?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_system_logo?: boolean | null
          mime_type?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          description: string | null
          html_content: string
          id: string
          name: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          html_content: string
          id?: string
          name: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          html_content?: string
          id?: string
          name?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollment_codes: {
        Row: {
          code: string
          code_type: string
          cohort_id: string | null
          created_at: string
          created_by: string
          current_uses: number
          discount_percent: number | null
          expires_at: string | null
          grants_plan_id: string | null
          grants_tier: string | null
          id: string
          is_active: boolean
          is_free: boolean
          max_uses: number | null
          program_id: string
        }
        Insert: {
          code: string
          code_type?: string
          cohort_id?: string | null
          created_at?: string
          created_by: string
          current_uses?: number
          discount_percent?: number | null
          expires_at?: string | null
          grants_plan_id?: string | null
          grants_tier?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          max_uses?: number | null
          program_id: string
        }
        Update: {
          code?: string
          code_type?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string
          current_uses?: number
          discount_percent?: number | null
          expires_at?: string | null
          grants_plan_id?: string | null
          grants_tier?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          max_uses?: number | null
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_codes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "program_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_codes_grants_plan_id_fkey"
            columns: ["grants_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_codes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_module_staff: {
        Row: {
          created_at: string
          enrollment_id: string
          id: string
          module_id: string
          role: string
          staff_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          id?: string
          module_id: string
          role: string
          staff_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          id?: string
          module_id?: string
          role?: string
          staff_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_module_staff_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_module_staff_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_module_staff_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_module_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_module_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_module_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_course_skills: {
        Row: {
          created_at: string
          external_course_id: string
          id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          external_course_id: string
          id?: string
          skill_id: string
        }
        Update: {
          created_at?: string
          external_course_id?: string
          id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_course_skills_external_course_id_fkey"
            columns: ["external_course_id"]
            isOneToOne: false
            referencedRelation: "external_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_course_skills_external_course_id_fkey"
            columns: ["external_course_id"]
            isOneToOne: false
            referencedRelation: "public_external_courses_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_course_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      external_courses: {
        Row: {
          certificate_name: string | null
          certificate_path: string | null
          certificate_uploaded_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_private: boolean
          is_public: boolean
          notes: string | null
          planned_date: string | null
          provider: string
          status: string
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          certificate_name?: string | null
          certificate_path?: string | null
          certificate_uploaded_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_private?: boolean
          is_public?: boolean
          notes?: string | null
          planned_date?: string | null
          provider: string
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          certificate_name?: string | null
          certificate_path?: string | null
          certificate_uploaded_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_private?: boolean
          is_public?: boolean
          notes?: string | null
          planned_date?: string | null
          provider?: string
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      external_progress: {
        Row: {
          completed_at: string | null
          completion_status: string | null
          created_at: string | null
          external_metadata: Json | null
          external_score: number | null
          id: string
          last_synced_at: string | null
          module_external_mapping_id: string
          progress_percentage: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_status?: string | null
          created_at?: string | null
          external_metadata?: Json | null
          external_score?: number | null
          id?: string
          last_synced_at?: string | null
          module_external_mapping_id: string
          progress_percentage?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_status?: string | null
          created_at?: string | null
          external_metadata?: Json | null
          external_score?: number | null
          id?: string
          last_synced_at?: string | null
          module_external_mapping_id?: string
          progress_percentage?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_progress_module_external_mapping_id_fkey"
            columns: ["module_external_mapping_id"]
            isOneToOne: false
            referencedRelation: "module_external_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      external_sources: {
        Row: {
          config: Json | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      family_survey_questions: {
        Row: {
          created_at: string
          family_id: string
          help_text: string | null
          id: string
          is_required: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
        }
        Insert: {
          created_at?: string
          family_id: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_survey_questions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "guided_path_template_families"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          admin_notes: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_consumable: boolean
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_consumable?: boolean
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_consumable?: boolean
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "feature_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_template_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          structure: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          structure?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          structure?: Json
          updated_at?: string
        }
        Relationships: []
      }
      generated_prompts: {
        Row: {
          answered_at: string | null
          created_at: string
          generated_at: string
          id: string
          period_start: string
          period_type: string
          prompt_context: Json | null
          prompt_text: string
          response_item_id: string | null
          skipped_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          period_start: string
          period_type: string
          prompt_context?: Json | null
          prompt_text: string
          response_item_id?: string | null
          skipped_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          period_start?: string
          period_type?: string
          prompt_context?: Json | null
          prompt_text?: string
          response_item_id?: string | null
          skipped_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_prompts_response_item_id_fkey"
            columns: ["response_item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_assessment_links: {
        Row: {
          assessment_definition_id: string | null
          capability_assessment_id: string | null
          capability_domain_id: string | null
          capability_snapshot_id: string | null
          created_at: string
          goal_id: string
          id: string
          notes: string | null
          psychometric_assessment_id: string | null
          score_at_creation: number | null
          target_score: number | null
        }
        Insert: {
          assessment_definition_id?: string | null
          capability_assessment_id?: string | null
          capability_domain_id?: string | null
          capability_snapshot_id?: string | null
          created_at?: string
          goal_id: string
          id?: string
          notes?: string | null
          psychometric_assessment_id?: string | null
          score_at_creation?: number | null
          target_score?: number | null
        }
        Update: {
          assessment_definition_id?: string | null
          capability_assessment_id?: string | null
          capability_domain_id?: string | null
          capability_snapshot_id?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          notes?: string | null
          psychometric_assessment_id?: string | null
          score_at_creation?: number | null
          target_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_assessment_links_assessment_definition_id_fkey"
            columns: ["assessment_definition_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assessment_links_capability_assessment_id_fkey"
            columns: ["capability_assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assessment_links_capability_domain_id_fkey"
            columns: ["capability_domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assessment_links_capability_snapshot_id_fkey"
            columns: ["capability_snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assessment_links_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assessment_links_psychometric_assessment_id_fkey"
            columns: ["psychometric_assessment_id"]
            isOneToOne: false
            referencedRelation: "psychometric_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_comments: {
        Row: {
          comment: string
          created_at: string
          goal_id: string
          id: string
          is_private: boolean
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          goal_id: string
          id?: string
          is_private?: boolean
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          goal_id?: string
          id?: string
          is_private?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_comments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_milestones: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          due_date: string | null
          goal_id: string
          id: string
          is_private: boolean
          order_index: number
          status: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          goal_id: string
          id?: string
          is_private?: boolean
          order_index: number
          status?: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          goal_id?: string
          id?: string
          is_private?: boolean
          order_index?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_reflections: {
        Row: {
          content: string
          created_at: string
          goal_id: string
          id: string
          is_private: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          goal_id: string
          id?: string
          is_private?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          goal_id?: string
          id?: string
          is_private?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_reflections_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_resources: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          goal_id: string
          id: string
          resource_type: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          goal_id: string
          id?: string
          resource_type: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          goal_id?: string
          id?: string
          resource_type?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_resources_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_shares: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_shares_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: Database["public"]["Enums"]["goal_category"]
          created_at: string
          description: string | null
          id: string
          instantiation_id: string | null
          is_private: boolean
          is_public: boolean
          priority: string
          progress_percentage: number
          status: string
          target_date: string | null
          template_goal_id: string | null
          timeframe_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          description?: string | null
          id?: string
          instantiation_id?: string | null
          is_private?: boolean
          is_public?: boolean
          priority?: string
          progress_percentage?: number
          status?: string
          target_date?: string | null
          template_goal_id?: string | null
          timeframe_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          description?: string | null
          id?: string
          instantiation_id?: string | null
          is_private?: boolean
          is_public?: boolean
          priority?: string
          progress_percentage?: number
          status?: string
          target_date?: string | null
          template_goal_id?: string | null
          timeframe_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_instantiation_id_fkey"
            columns: ["instantiation_id"]
            isOneToOne: false
            referencedRelation: "guided_path_instantiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_template_goal_id_fkey"
            columns: ["template_goal_id"]
            isOneToOne: false
            referencedRelation: "guided_path_template_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_users: {
        Row: {
          created_at: string | null
          folder_name: string | null
          folder_url: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          folder_name?: string | null
          folder_url: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          folder_name?: string | null
          folder_url?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      group_check_ins: {
        Row: {
          check_in_date: string
          content: string
          created_at: string
          group_id: string
          id: string
          mood: string | null
          user_id: string
        }
        Insert: {
          check_in_date?: string
          content: string
          created_at?: string
          group_id: string
          id?: string
          mood?: string | null
          user_id: string
        }
        Update: {
          check_in_date?: string
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          mood?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_check_ins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_interest_registrations: {
        Row: {
          created_at: string
          group_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_interest_registrations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_member_links: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_member_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["group_member_role"]
          status: Database["public"]["Enums"]["group_membership_status"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          status?: Database["public"]["Enums"]["group_membership_status"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          status?: Database["public"]["Enums"]["group_membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_notes: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          file_name: string | null
          file_path: string | null
          group_id: string
          id: string
          note_type: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          file_name?: string | null
          file_path?: string | null
          group_id: string
          id?: string
          note_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          file_name?: string | null
          file_path?: string | null
          group_id?: string
          id?: string
          note_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_peer_assessments: {
        Row: {
          assessment_id: string
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          is_active: boolean
        }
        Insert: {
          assessment_id: string
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          is_active?: boolean
        }
        Update: {
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "group_peer_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_peer_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_peer_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_peer_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_peer_assessments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_session_participants: {
        Row: {
          created_at: string
          group_id: string
          id: string
          responded_at: string | null
          response_status: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          responded_at?: string | null
          response_status?: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          responded_at?: string | null
          response_status?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_session_participants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_sessions: {
        Row: {
          booked_by: string | null
          booking_source: string | null
          calcom_booking_id: string | null
          calcom_booking_uid: string | null
          calcom_event_type_id: number | null
          calcom_event_type_slug: string | null
          calcom_reschedule_uid: string | null
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          enrollment_id: string | null
          group_id: string
          id: string
          is_recurring: boolean | null
          location: string | null
          meeting_link: string | null
          parent_session_id: string | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          session_date: string
          start_time: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          booked_by?: string | null
          booking_source?: string | null
          calcom_booking_id?: string | null
          calcom_booking_uid?: string | null
          calcom_event_type_id?: number | null
          calcom_event_type_slug?: string | null
          calcom_reschedule_uid?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          enrollment_id?: string | null
          group_id: string
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          meeting_link?: string | null
          parent_session_id?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          session_date: string
          start_time?: string | null
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          booked_by?: string | null
          booking_source?: string | null
          calcom_booking_id?: string | null
          calcom_booking_uid?: string | null
          calcom_event_type_id?: number | null
          calcom_event_type_slug?: string | null
          calcom_reschedule_uid?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          enrollment_id?: string | null
          group_id?: string
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          meeting_link?: string | null
          parent_session_id?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          session_date?: string
          start_time?: string | null
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          group_id: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          group_id: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          group_id?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          calcom_mapping_id: string | null
          calendly_event_url: string | null
          circle_group_id: string | null
          circle_group_url: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          google_drive_folder_url: string | null
          id: string
          join_type: Database["public"]["Enums"]["group_join_type"]
          max_members: number | null
          name: string
          program_id: string | null
          slack_channel_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["group_status"]
          theme: string | null
          updated_at: string
        }
        Insert: {
          calcom_mapping_id?: string | null
          calendly_event_url?: string | null
          circle_group_id?: string | null
          circle_group_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          google_drive_folder_url?: string | null
          id?: string
          join_type?: Database["public"]["Enums"]["group_join_type"]
          max_members?: number | null
          name: string
          program_id?: string | null
          slack_channel_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["group_status"]
          theme?: string | null
          updated_at?: string
        }
        Update: {
          calcom_mapping_id?: string | null
          calendly_event_url?: string | null
          circle_group_id?: string | null
          circle_group_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          google_drive_folder_url?: string | null
          id?: string
          join_type?: Database["public"]["Enums"]["group_join_type"]
          max_members?: number | null
          name?: string
          program_id?: string | null
          slack_channel_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["group_status"]
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_calcom_mapping_id_fkey"
            columns: ["calcom_mapping_id"]
            isOneToOne: false
            referencedRelation: "calcom_event_type_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_path_instantiations: {
        Row: {
          actual_completion_date: string | null
          created_at: string
          estimated_completion_date: string | null
          id: string
          pace_multiplier: number
          started_at: string
          status: string
          survey_response_id: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          actual_completion_date?: string | null
          created_at?: string
          estimated_completion_date?: string | null
          id?: string
          pace_multiplier?: number
          started_at?: string
          status?: string
          survey_response_id?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          actual_completion_date?: string | null
          created_at?: string
          estimated_completion_date?: string | null
          id?: string
          pace_multiplier?: number
          started_at?: string
          status?: string
          survey_response_id?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_path_instantiations_survey_response_id_fkey"
            columns: ["survey_response_id"]
            isOneToOne: false
            referencedRelation: "guided_path_survey_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guided_path_instantiations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "guided_path_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_path_milestone_gates: {
        Row: {
          assessment_definition_id: string | null
          assessment_dimension_id: string | null
          capability_assessment_id: string | null
          capability_domain_id: string | null
          created_at: string
          gate_label: string | null
          id: string
          min_score: number
          template_milestone_id: string
        }
        Insert: {
          assessment_definition_id?: string | null
          assessment_dimension_id?: string | null
          capability_assessment_id?: string | null
          capability_domain_id?: string | null
          created_at?: string
          gate_label?: string | null
          id?: string
          min_score: number
          template_milestone_id: string
        }
        Update: {
          assessment_definition_id?: string | null
          assessment_dimension_id?: string | null
          capability_assessment_id?: string | null
          capability_domain_id?: string | null
          created_at?: string
          gate_label?: string | null
          id?: string
          min_score?: number
          template_milestone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_path_milestone_gates_assessment_definition_id_fkey"
            columns: ["assessment_definition_id"]
            isOneToOne: false
            referencedRelation: "assessment_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guided_path_milestone_gates_assessment_dimension_id_fkey"
            columns: ["assessment_dimension_id"]
            isOneToOne: false
            referencedRelation: "assessment_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guided_path_milestone_gates_capability_assessment_id_fkey"
            columns: ["capability_assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guided_path_milestone_gates_capability_domain_id_fkey"
            columns: ["capability_domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guided_path_milestone_gates_template_milestone_id_fkey"
            columns: ["template_milestone_id"]
            isOneToOne: false
            referencedRelation: "guided_path_template_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_path_survey_responses: {
        Row: {
          completed_at: string | null
          created_at: string
          family_id: string
          id: string
          responses: Json
          selected_template_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          family_id: string
          id?: string
          responses?: Json
          selected_template_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          responses?: Json
          selected_template_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_path_survey_responses_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "guided_path_template_families"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_path_template_families: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      guided_path_template_goals: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          order_index: number
          priority: string
          template_id: string
          timeframe_type: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          priority?: string
          template_id: string
          timeframe_type?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          priority?: string
          template_id?: string
          timeframe_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_path_template_goals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "guided_path_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_path_template_milestones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          recommended_days_max: number | null
          recommended_days_min: number | null
          recommended_days_optimal: number | null
          template_goal_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          recommended_days_max?: number | null
          recommended_days_min?: number | null
          recommended_days_optimal?: number | null
          template_goal_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          recommended_days_max?: number | null
          recommended_days_min?: number | null
          recommended_days_optimal?: number | null
          template_goal_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_path_template_milestones_template_goal_id_fkey"
            columns: ["template_goal_id"]
            isOneToOne: false
            referencedRelation: "guided_path_template_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_path_template_tasks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          importance: boolean | null
          order_index: number
          template_milestone_id: string
          title: string
          urgency: boolean | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          importance?: boolean | null
          order_index?: number
          template_milestone_id: string
          title: string
          urgency?: boolean | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          importance?: boolean | null
          order_index?: number
          template_milestone_id?: string
          title?: string
          urgency?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "guided_path_template_tasks_template_milestone_id_fkey"
            columns: ["template_milestone_id"]
            isOneToOne: false
            referencedRelation: "guided_path_template_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_path_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          family_id: string | null
          id: string
          is_active: boolean
          is_base_template: boolean
          name: string
          order_in_family: number
          program_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean
          is_base_template?: boolean
          name: string
          order_in_family?: number
          program_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          family_id?: string | null
          id?: string
          is_active?: boolean
          is_base_template?: boolean
          name?: string
          order_in_family?: number
          program_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_path_templates_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "guided_path_template_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guided_path_templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_calcom_event_types: {
        Row: {
          booking_url: string | null
          child_event_type_id: number
          created_at: string
          id: string
          instructor_id: string
          module_type: string
          updated_at: string
        }
        Insert: {
          booking_url?: string | null
          child_event_type_id: number
          created_at?: string
          id?: string
          instructor_id: string
          module_type: string
          updated_at?: string
        }
        Update: {
          booking_url?: string | null
          child_event_type_id?: number
          created_at?: string
          id?: string
          instructor_id?: string
          module_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_calcom_event_types_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_calcom_event_types_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_calcom_event_types_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_calcom_event_types_module_type_fkey"
            columns: ["module_type"]
            isOneToOne: false
            referencedRelation: "module_types"
            referencedColumns: ["name"]
          },
        ]
      }
      instructor_capability_evaluations: {
        Row: {
          created_at: string
          id: string
          instructor_id: string
          overall_feedback: string | null
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_id: string
          overall_feedback?: string | null
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instructor_id?: string
          overall_feedback?: string | null
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_capability_evaluations_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_capability_ratings: {
        Row: {
          created_at: string
          evaluation_id: string
          feedback: string | null
          id: string
          question_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          feedback?: string | null
          id?: string
          question_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          feedback?: string | null
          id?: string
          question_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_capability_ratings_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "instructor_capability_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_capability_ratings_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_module_notes: {
        Row: {
          created_at: string | null
          id: string
          instructor_id: string
          module_progress_id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instructor_id: string
          module_progress_id: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instructor_id?: string
          module_progress_id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_module_notes_module_progress_id_fkey"
            columns: ["module_progress_id"]
            isOneToOne: false
            referencedRelation: "module_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      lucid_users: {
        Row: {
          created_at: string | null
          id: string
          lucid_email: string
          lucid_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lucid_email: string
          lucid_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lucid_email?: string
          lucid_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      milestone_gate_overrides: {
        Row: {
          created_at: string
          gate_id: string
          goal_milestone_id: string
          id: string
          overridden_by: string
          reason: string
        }
        Insert: {
          created_at?: string
          gate_id: string
          goal_milestone_id: string
          id?: string
          overridden_by: string
          reason: string
        }
        Update: {
          created_at?: string
          gate_id?: string
          goal_milestone_id?: string
          id?: string
          overridden_by?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_gate_overrides_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "guided_path_milestone_gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_gate_overrides_goal_milestone_id_fkey"
            columns: ["goal_milestone_id"]
            isOneToOne: false
            referencedRelation: "goal_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      miro_users: {
        Row: {
          created_at: string | null
          id: string
          miro_email: string
          miro_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          miro_email: string
          miro_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          miro_email?: string
          miro_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      module_assignment_attachments: {
        Row: {
          assignment_id: string
          attachment_type: string
          created_at: string
          description: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          title: string
          url: string | null
        }
        Insert: {
          assignment_id: string
          attachment_type: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title: string
          url?: string | null
        }
        Update: {
          assignment_id?: string
          attachment_type?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_assessment_attachments_assessment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "module_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      module_assignment_configs: {
        Row: {
          assignment_type_id: string
          created_at: string
          id: string
          linked_capability_assessment_id: string | null
          module_id: string
        }
        Insert: {
          assignment_type_id: string
          created_at?: string
          id?: string
          linked_capability_assessment_id?: string | null
          module_id: string
        }
        Update: {
          assignment_type_id?: string
          created_at?: string
          id?: string
          linked_capability_assessment_id?: string | null
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_assessment_assignments_assessment_type_id_fkey"
            columns: ["assignment_type_id"]
            isOneToOne: false
            referencedRelation: "module_assignment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_assessment_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_assignment_configs_linked_capability_assessment_id_fkey"
            columns: ["linked_capability_assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      module_assignment_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          scoring_assessment_id: string | null
          structure: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          scoring_assessment_id?: string | null
          structure?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          scoring_assessment_id?: string | null
          structure?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_assignment_types_scoring_assessment_id_fkey"
            columns: ["scoring_assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      module_assignments: {
        Row: {
          assessor_id: string
          assignment_type_id: string
          completed_at: string | null
          created_at: string
          id: string
          instructor_notes: string | null
          is_private: boolean
          module_progress_id: string
          overall_comments: string | null
          overall_score: number | null
          responses: Json
          scored_at: string | null
          scored_by: string | null
          scoring_snapshot_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assessor_id: string
          assignment_type_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          instructor_notes?: string | null
          is_private?: boolean
          module_progress_id: string
          overall_comments?: string | null
          overall_score?: number | null
          responses?: Json
          scored_at?: string | null
          scored_by?: string | null
          scoring_snapshot_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assessor_id?: string
          assignment_type_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          instructor_notes?: string | null
          is_private?: boolean
          module_progress_id?: string
          overall_comments?: string | null
          overall_score?: number | null
          responses?: Json
          scored_at?: string | null
          scored_by?: string | null
          scoring_snapshot_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_assessments_assessment_type_id_fkey"
            columns: ["assignment_type_id"]
            isOneToOne: false
            referencedRelation: "module_assignment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_assessments_module_progress_id_fkey"
            columns: ["module_progress_id"]
            isOneToOne: false
            referencedRelation: "module_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_assignments_scoring_snapshot_id_fkey"
            columns: ["scoring_snapshot_id"]
            isOneToOne: false
            referencedRelation: "capability_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      module_client_content: {
        Row: {
          assigned_at: string
          assigned_by: string
          content: string
          id: string
          module_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          content: string
          id?: string
          module_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          content?: string
          id?: string
          module_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_client_content_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_client_content_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          description: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          module_client_content_id: string
          title: string
          url: string | null
        }
        Insert: {
          attachment_type: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          module_client_content_id: string
          title: string
          url?: string | null
        }
        Update: {
          attachment_type?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          module_client_content_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_client_content_attachments_module_client_content_id_fkey"
            columns: ["module_client_content_id"]
            isOneToOne: false
            referencedRelation: "module_client_content"
            referencedColumns: ["id"]
          },
        ]
      }
      module_client_content_resources: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          module_client_content_id: string
          notes: string | null
          resource_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_client_content_id: string
          notes?: string | null
          resource_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_client_content_id?: string
          notes?: string | null
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_client_content_resources_module_client_content_id_fkey"
            columns: ["module_client_content_id"]
            isOneToOne: false
            referencedRelation: "module_client_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_client_content_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_client_content_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      module_client_content_scenarios: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          module_client_content_id: string
          notes: string | null
          scenario_template_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_client_content_id: string
          notes?: string | null
          scenario_template_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_client_content_id?: string
          notes?: string | null
          scenario_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_client_content_scenarios_module_client_content_id_fkey"
            columns: ["module_client_content_id"]
            isOneToOne: false
            referencedRelation: "module_client_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_client_content_scenarios_scenario_template_id_fkey"
            columns: ["scenario_template_id"]
            isOneToOne: false
            referencedRelation: "scenario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      module_coaches: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          module_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          module_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_coaches_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_collection_links: {
        Row: {
          collection_id: string
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          order_index: number | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          order_index?: number | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "module_collection_links_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "resource_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_collection_links_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_domain_mappings: {
        Row: {
          capability_domain_id: string
          created_at: string
          id: string
          module_id: string
          relevance: string
        }
        Insert: {
          capability_domain_id: string
          created_at?: string
          id?: string
          module_id: string
          relevance?: string
        }
        Update: {
          capability_domain_id?: string
          created_at?: string
          id?: string
          module_id?: string
          relevance?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_domain_mappings_capability_domain_id_fkey"
            columns: ["capability_domain_id"]
            isOneToOne: false
            referencedRelation: "capability_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_domain_mappings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_external_mappings: {
        Row: {
          created_at: string | null
          external_content_id: string
          external_content_name: string | null
          external_source_id: string
          id: string
          module_id: string
          sync_completion: boolean | null
          sync_progress: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_content_id: string
          external_content_name?: string | null
          external_source_id: string
          id?: string
          module_id: string
          sync_completion?: boolean | null
          sync_progress?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_content_id?: string
          external_content_name?: string | null
          external_source_id?: string
          id?: string
          module_id?: string
          sync_completion?: boolean | null
          sync_progress?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_external_mappings_external_source_id_fkey"
            columns: ["external_source_id"]
            isOneToOne: false
            referencedRelation: "external_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_external_mappings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_instructors: {
        Row: {
          created_at: string | null
          id: string
          instructor_id: string
          module_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instructor_id: string
          module_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instructor_id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_instructors_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_prerequisites: {
        Row: {
          created_at: string
          id: string
          module_id: string
          prerequisite_module_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          prerequisite_module_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          prerequisite_module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_prerequisites_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_prerequisites_prerequisite_module_id_fkey"
            columns: ["prerequisite_module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          enrollment_id: string
          id: string
          module_id: string
          notes: string | null
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id: string
          id?: string
          module_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string
          id?: string
          module_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_reflection_resources: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          module_reflection_id: string
          resource_type: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          module_reflection_id: string
          resource_type: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          module_reflection_id?: string
          resource_type?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_reflection_resources_module_reflection_id_fkey"
            columns: ["module_reflection_id"]
            isOneToOne: false
            referencedRelation: "module_reflections"
            referencedColumns: ["id"]
          },
        ]
      }
      module_reflections: {
        Row: {
          content: string
          created_at: string
          id: string
          module_progress_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          module_progress_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          module_progress_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_reflections_module_progress_id_fkey"
            columns: ["module_progress_id"]
            isOneToOne: false
            referencedRelation: "module_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      module_resource_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          is_required: boolean
          module_id: string
          notes: string | null
          order_index: number
          resource_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          is_required?: boolean
          module_id: string
          notes?: string | null
          order_index?: number
          resource_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          is_required?: boolean
          module_id?: string
          notes?: string | null
          order_index?: number
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_resource_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_resource_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_resource_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      module_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_required_for_certification: boolean
          module_id: string
          notes: string | null
          order_index: number
          template_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_required_for_certification?: boolean
          module_id: string
          notes?: string | null
          order_index?: number
          template_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_required_for_certification?: boolean
          module_id?: string
          notes?: string | null
          order_index?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_scenarios_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_scenarios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scenario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      module_sections: {
        Row: {
          content: string | null
          created_at: string
          id: string
          module_id: string
          order_index: number
          section_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          module_id: string
          order_index?: number
          section_type?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          module_id?: string
          order_index?: number
          section_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_sections_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_session_participants: {
        Row: {
          created_at: string
          enrollment_id: string | null
          id: string
          response_status: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id?: string | null
          id?: string
          response_status?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string | null
          id?: string
          response_status?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_session_participants_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_session_participants_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "module_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "module_sessions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      module_sessions: {
        Row: {
          booked_by: string | null
          booking_source: string | null
          calcom_booking_id: string | null
          calcom_booking_uid: string | null
          calcom_event_type_id: number | null
          calcom_event_type_slug: string | null
          calcom_reschedule_uid: string | null
          client_response: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          enrollment_id: string | null
          id: string
          instructor_id: string | null
          is_recurring: boolean
          location: string | null
          meeting_url: string | null
          module_id: string
          notes: string | null
          parent_session_id: string | null
          preferred_date: string | null
          program_id: string | null
          recurrence_count: number | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          request_message: string | null
          request_notes: string | null
          requested_at: string | null
          requested_by: string | null
          session_date: string | null
          session_type: string
          source: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          booked_by?: string | null
          booking_source?: string | null
          calcom_booking_id?: string | null
          calcom_booking_uid?: string | null
          calcom_event_type_id?: number | null
          calcom_event_type_slug?: string | null
          calcom_reschedule_uid?: string | null
          client_response?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string
          instructor_id?: string | null
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          module_id: string
          notes?: string | null
          parent_session_id?: string | null
          preferred_date?: string | null
          program_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          request_message?: string | null
          request_notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          session_date?: string | null
          session_type?: string
          source?: string | null
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          booked_by?: string | null
          booking_source?: string | null
          calcom_booking_id?: string | null
          calcom_booking_uid?: string | null
          calcom_event_type_id?: number | null
          calcom_event_type_slug?: string | null
          calcom_reschedule_uid?: string | null
          client_response?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string
          instructor_id?: string | null
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          module_id?: string
          notes?: string | null
          parent_session_id?: string | null
          preferred_date?: string | null
          program_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          request_message?: string | null
          request_notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          session_date?: string | null
          session_type?: string
          source?: string | null
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "module_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "module_sessions_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      module_skills: {
        Row: {
          created_at: string
          id: string
          module_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_skills_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      module_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mural_users: {
        Row: {
          created_at: string | null
          id: string
          mural_email: string
          mural_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mural_email: string
          mural_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mural_email?: string
          mural_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean
          key: string
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean
          key: string
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean
          key?: string
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          assignment_graded: boolean | null
          assignment_submitted: boolean | null
          coach_module_assignments: boolean | null
          coach_program_assignments: boolean | null
          created_at: string | null
          email_changes: boolean | null
          id: string
          instructor_module_assignments: boolean | null
          instructor_program_assignments: boolean | null
          module_completions: boolean | null
          password_changes: boolean | null
          profile_updates: boolean | null
          program_assignments: boolean | null
          program_completions: boolean | null
          session_requests: boolean
          session_scheduled: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assignment_graded?: boolean | null
          assignment_submitted?: boolean | null
          coach_module_assignments?: boolean | null
          coach_program_assignments?: boolean | null
          created_at?: string | null
          email_changes?: boolean | null
          id?: string
          instructor_module_assignments?: boolean | null
          instructor_program_assignments?: boolean | null
          module_completions?: boolean | null
          password_changes?: boolean | null
          profile_updates?: boolean | null
          program_assignments?: boolean | null
          program_completions?: boolean | null
          session_requests?: boolean
          session_scheduled?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assignment_graded?: boolean | null
          assignment_submitted?: boolean | null
          coach_module_assignments?: boolean | null
          coach_program_assignments?: boolean | null
          created_at?: string | null
          email_changes?: boolean | null
          id?: string
          instructor_module_assignments?: boolean | null
          instructor_program_assignments?: boolean | null
          module_completions?: boolean | null
          password_changes?: boolean | null
          profile_updates?: boolean | null
          program_assignments?: boolean | null
          program_completions?: boolean | null
          session_requests?: boolean
          session_scheduled?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_types: {
        Row: {
          category_id: string | null
          created_at: string | null
          default_email_enabled: boolean | null
          default_in_app_enabled: boolean | null
          description: string | null
          email_template_key: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_critical: boolean | null
          is_system: boolean
          key: string
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          default_email_enabled?: boolean | null
          default_in_app_enabled?: boolean | null
          description?: string | null
          email_template_key?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_critical?: boolean | null
          is_system?: boolean
          key: string
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          default_email_enabled?: boolean | null
          default_in_app_enabled?: boolean | null
          description?: string | null
          email_template_key?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_critical?: boolean | null
          is_system?: boolean
          key?: string
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "notification_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          email_error: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          metadata: Json | null
          notification_type_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_error?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          metadata?: Json | null
          notification_type_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_error?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          metadata?: Json | null
          notification_type_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_notification_type_id_fkey"
            columns: ["notification_type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token_encrypted: string | null
          created_at: string | null
          encryption_key_id: string | null
          expires_at: string | null
          id: string
          provider: string
          refresh_token_encrypted: string | null
          scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string | null
          encryption_key_id?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token_encrypted?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string | null
          encryption_key_id?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      org_credit_balances: {
        Row: {
          available_credits: number
          created_at: string | null
          id: string
          organization_id: string
          reserved_credits: number
          total_consumed: number
          total_purchased: number
          updated_at: string | null
        }
        Insert: {
          available_credits?: number
          created_at?: string | null
          id?: string
          organization_id: string
          reserved_credits?: number
          total_consumed?: number
          total_purchased?: number
          updated_at?: string | null
        }
        Update: {
          available_credits?: number
          created_at?: string | null
          id?: string
          organization_id?: string
          reserved_credits?: number
          total_consumed?: number
          total_purchased?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_credit_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_credit_packages: {
        Row: {
          created_at: string | null
          credit_value: number
          currency: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          slug: string
          stripe_price_id: string | null
          updated_at: string | null
          validity_months: number | null
        }
        Insert: {
          created_at?: string | null
          credit_value?: number
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents?: number
          slug: string
          stripe_price_id?: string | null
          updated_at?: string | null
          validity_months?: number | null
        }
        Update: {
          created_at?: string | null
          credit_value?: number
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          slug?: string
          stripe_price_id?: string | null
          updated_at?: string | null
          validity_months?: number | null
        }
        Relationships: []
      }
      org_credit_purchases: {
        Row: {
          amount_cents: number
          created_at: string | null
          credits_purchased: number
          currency: string
          expires_at: string | null
          id: string
          notes: string | null
          organization_id: string
          package_id: string | null
          purchased_by: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          credits_purchased: number
          currency?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          package_id?: string | null
          purchased_by?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          credits_purchased?: number
          currency?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          package_id?: string | null
          purchased_by?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_credit_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_credit_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "org_credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      org_credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          enrollment_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          performed_by: string | null
          purchase_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          performed_by?: string | null
          purchase_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          performed_by?: string | null
          purchase_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_credit_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_credit_transactions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "org_credit_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      org_platform_subscriptions: {
        Row: {
          billing_email: string | null
          billing_period: string | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          starts_at: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_email?: string | null
          billing_period?: string | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          starts_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_email?: string | null
          billing_period?: string | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          starts_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_platform_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_platform_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "org_platform_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      org_platform_tiers: {
        Row: {
          annual_fee_cents: number
          created_at: string | null
          currency: string
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          includes_analytics: boolean | null
          is_active: boolean | null
          max_members: number | null
          max_sponsored_seats: number | null
          monthly_fee_cents: number | null
          name: string
          slug: string
          stripe_annual_price_id: string | null
          stripe_monthly_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          annual_fee_cents?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          includes_analytics?: boolean | null
          is_active?: boolean | null
          max_members?: number | null
          max_sponsored_seats?: number | null
          monthly_fee_cents?: number | null
          name: string
          slug: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_fee_cents?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          includes_analytics?: boolean | null
          is_active?: boolean | null
          max_members?: number | null
          max_sponsored_seats?: number | null
          monthly_fee_cents?: number | null
          name?: string
          slug?: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          department: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          sponsored_plan_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          sponsored_plan_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          sponsored_plan_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_sponsored_plan_id_fkey"
            columns: ["sponsored_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_programs: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          licensed_at: string | null
          max_enrollments: number | null
          notes: string | null
          organization_id: string
          program_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          licensed_at?: string | null
          max_enrollments?: number | null
          notes?: string | null
          organization_id: string
          program_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          licensed_at?: string | null
          max_enrollments?: number | null
          notes?: string | null
          organization_id?: string
          program_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_sharing_consent: {
        Row: {
          consent_given_at: string | null
          consent_updated_at: string
          created_at: string
          id: string
          organization_id: string
          share_assessments: boolean
          share_assignments: boolean
          share_decisions: boolean
          share_development_items: boolean
          share_goals: boolean
          share_progress: boolean
          share_tasks: boolean
          user_id: string
        }
        Insert: {
          consent_given_at?: string | null
          consent_updated_at?: string
          created_at?: string
          id?: string
          organization_id: string
          share_assessments?: boolean
          share_assignments?: boolean
          share_decisions?: boolean
          share_development_items?: boolean
          share_goals?: boolean
          share_progress?: boolean
          share_tasks?: boolean
          user_id: string
        }
        Update: {
          consent_given_at?: string | null
          consent_updated_at?: string
          created_at?: string
          id?: string
          organization_id?: string
          share_assessments?: boolean
          share_assignments?: boolean
          share_decisions?: boolean
          share_development_items?: boolean
          share_goals?: boolean
          share_progress?: boolean
          share_tasks?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_sharing_consent_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_terms: {
        Row: {
          content_html: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_blocking_on_first_access: boolean
          is_blocking_on_update: boolean
          is_current: boolean
          organization_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content_html: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_blocking_on_first_access?: boolean
          is_blocking_on_update?: boolean
          is_current?: boolean
          organization_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          content_html?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_blocking_on_first_access?: boolean
          is_blocking_on_update?: boolean
          is_current?: boolean
          organization_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string | null
          is_active: boolean
          logo_url: string | null
          name: string
          settings: Json | null
          size_range: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          logo_url?: string | null
          name: string
          settings?: Json | null
          size_range?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          logo_url?: string | null
          name?: string
          settings?: Json | null
          size_range?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      paragraph_evaluations: {
        Row: {
          assignment_id: string
          created_at: string
          evaluator_id: string | null
          feedback: string | null
          id: string
          paragraph_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          evaluator_id?: string | null
          feedback?: string | null
          id?: string
          paragraph_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          evaluator_id?: string | null
          feedback?: string | null
          id?: string
          paragraph_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paragraph_evaluations_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scenario_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paragraph_evaluations_paragraph_id_fkey"
            columns: ["paragraph_id"]
            isOneToOne: false
            referencedRelation: "section_paragraphs"
            referencedColumns: ["id"]
          },
        ]
      }
      paragraph_question_links: {
        Row: {
          created_at: string
          id: string
          paragraph_id: string
          question_id: string
          rubric_text: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          paragraph_id: string
          question_id: string
          rubric_text?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          paragraph_id?: string
          question_id?: string
          rubric_text?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paragraph_question_links_paragraph_id_fkey"
            columns: ["paragraph_id"]
            isOneToOne: false
            referencedRelation: "section_paragraphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paragraph_question_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      paragraph_question_scores: {
        Row: {
          assignment_id: string
          created_at: string
          evaluator_id: string | null
          id: string
          paragraph_id: string
          question_id: string
          score: number
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          evaluator_id?: string | null
          id?: string
          paragraph_id: string
          question_id: string
          score: number
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          evaluator_id?: string | null
          id?: string
          paragraph_id?: string
          question_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paragraph_question_scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scenario_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paragraph_question_scores_paragraph_id_fkey"
            columns: ["paragraph_id"]
            isOneToOne: false
            referencedRelation: "section_paragraphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paragraph_question_scores_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      paragraph_responses: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          paragraph_id: string
          response_text: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          paragraph_id: string
          response_text?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          paragraph_id?: string
          response_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paragraph_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scenario_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paragraph_responses_paragraph_id_fkey"
            columns: ["paragraph_id"]
            isOneToOne: false
            referencedRelation: "section_paragraphs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_codes: {
        Row: {
          code: string
          cohort_id: string | null
          created_at: string | null
          current_uses: number
          discount_percent: number | null
          expires_at: string | null
          grants_tier: string | null
          id: string
          is_active: boolean
          is_free: boolean
          label: string | null
          max_uses: number | null
          partner_id: string
          program_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          cohort_id?: string | null
          created_at?: string | null
          current_uses?: number
          discount_percent?: number | null
          expires_at?: string | null
          grants_tier?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          label?: string | null
          max_uses?: number | null
          partner_id: string
          program_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          cohort_id?: string | null
          created_at?: string | null
          current_uses?: number
          discount_percent?: number | null
          expires_at?: string | null
          grants_tier?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          label?: string | null
          max_uses?: number | null
          partner_id?: string
          program_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_codes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "program_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_program_clicks: {
        Row: {
          clicked_at: string
          id: string
          partner_program_id: string
          user_id: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          partner_program_id: string
          user_id?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          partner_program_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_program_clicks_partner_program_id_fkey"
            columns: ["partner_program_id"]
            isOneToOne: false
            referencedRelation: "partner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_programs: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          display_order: number | null
          duration_info: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          price_info: string | null
          program_url: string
          provider_logo_url: string | null
          provider_name: string
          provider_type: string
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_info?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_info?: string | null
          program_url: string
          provider_logo_url?: string | null
          provider_name: string
          provider_type?: string
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_info?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_info?: string | null
          program_url?: string
          provider_logo_url?: string | null
          provider_name?: string
          provider_type?: string
          referral_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_programs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "program_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          created_at: string | null
          enrollment_id: string | null
          id: string
          partner_code_id: string
          partner_id: string
          referral_type: string
          referred_user_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          partner_code_id: string
          partner_id: string
          referral_type?: string
          referred_user_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          partner_code_id?: string
          partner_id?: string
          referral_type?: string
          referred_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_partner_code_id_fkey"
            columns: ["partner_code_id"]
            isOneToOne: false
            referencedRelation: "partner_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          amount_paid_cents: number
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          credit_package_id: string | null
          credits_granted: number
          currency: string
          enrollment_id: string | null
          id: string
          installment_amount_cents: number
          installment_count: number
          installments_paid: number
          metadata: Json | null
          next_payment_date: string | null
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string
          total_amount_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid_cents?: number
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          credit_package_id?: string | null
          credits_granted?: number
          currency?: string
          enrollment_id?: string | null
          id?: string
          installment_amount_cents: number
          installment_count: number
          installments_paid?: number
          metadata?: Json | null
          next_payment_date?: string | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id: string
          total_amount_cents: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid_cents?: number
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          credit_package_id?: string | null
          credits_granted?: number
          currency?: string
          enrollment_id?: string | null
          id?: string
          installment_amount_cents?: number
          installment_count?: number
          installments_paid?: number
          metadata?: Json | null
          next_payment_date?: string | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string
          total_amount_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_credit_allocations: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          monthly_allocation: number
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          monthly_allocation?: number
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          monthly_allocation?: number
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_credit_allocations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_credit_rollovers: {
        Row: {
          created_at: string | null
          expires_at: string | null
          feature_key: string
          id: string
          last_period_end: string
          rollover_credits: number
          source_period_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          feature_key: string
          id?: string
          last_period_end: string
          rollover_credits?: number
          source_period_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          feature_key?: string
          id?: string
          last_period_end?: string
          rollover_credits?: number
          source_period_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_id: string
          id: string
          is_restrictive: boolean
          limit_value: number | null
          plan_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_id: string
          id?: string
          is_restrictive?: boolean
          limit_value?: number | null
          plan_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_id?: string
          id?: string
          is_restrictive?: boolean
          limit_value?: number | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          billing_interval: string
          created_at: string
          id: string
          is_default: boolean
          plan_id: string
          price_cents: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          billing_interval: string
          created_at?: string
          id?: string
          is_default?: boolean
          plan_id: string
          price_cents: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          id?: string
          is_default?: boolean
          plan_id?: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_resource_limits: {
        Row: {
          created_at: string
          id: string
          monthly_limit: number | null
          plan_id: string
          resource_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_limit?: number | null
          plan_id: string
          resource_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_limit?: number | null
          plan_id?: string
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_resource_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_resource_limits_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_resource_limits_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          credit_allowance: number | null
          credit_validity_months: number | null
          description: string | null
          display_name: string | null
          fallback_plan_id: string | null
          id: string
          is_active: boolean
          is_free: boolean
          is_purchasable: boolean
          key: string
          name: string
          stripe_product_id: string | null
          tier_level: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_allowance?: number | null
          credit_validity_months?: number | null
          description?: string | null
          display_name?: string | null
          fallback_plan_id?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          is_purchasable?: boolean
          key: string
          name: string
          stripe_product_id?: string | null
          tier_level?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_allowance?: number | null
          credit_validity_months?: number | null
          description?: string | null
          display_name?: string | null
          fallback_plan_id?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          is_purchasable?: boolean
          key?: string
          name?: string
          stripe_product_id?: string | null
          tier_level?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_fallback_plan_id_fkey"
            columns: ["fallback_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          last_force_refresh: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          last_force_refresh?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          last_force_refresh?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_terms: {
        Row: {
          content_html: string
          created_at: string
          effective_from: string
          id: string
          is_blocking_on_update: boolean
          is_current: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content_html: string
          created_at?: string
          effective_from?: string
          id?: string
          is_blocking_on_update?: boolean
          is_current?: boolean
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          content_html?: string
          created_at?: string
          effective_from?: string
          id?: string
          is_blocking_on_update?: boolean
          is_current?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          bluesky_url: string | null
          calendar_sync_enabled: boolean | null
          calendar_token: string | null
          certifications: Json | null
          constraints: string | null
          constraints_private: boolean
          created_at: string | null
          desired_target_role: string | null
          desired_target_role_private: boolean
          education: Json | null
          email: string | null
          external_credential_profiles: Json | null
          facebook_url: string | null
          future_vision: string | null
          future_vision_private: boolean
          id: string
          instagram_url: string | null
          is_disabled: boolean
          is_hidden: boolean | null
          job_title: string | null
          linkedin_url: string | null
          name: string
          organisation: string | null
          plan_expires_at: string | null
          plan_id: string | null
          preferred_meeting_times: Json | null
          real_email: string | null
          registration_status: string | null
          scheduling_url: string | null
          tagline: string | null
          timezone: string | null
          updated_at: string | null
          username: string | null
          verification_status: string | null
          verified_at: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          bluesky_url?: string | null
          calendar_sync_enabled?: boolean | null
          calendar_token?: string | null
          certifications?: Json | null
          constraints?: string | null
          constraints_private?: boolean
          created_at?: string | null
          desired_target_role?: string | null
          desired_target_role_private?: boolean
          education?: Json | null
          email?: string | null
          external_credential_profiles?: Json | null
          facebook_url?: string | null
          future_vision?: string | null
          future_vision_private?: boolean
          id: string
          instagram_url?: string | null
          is_disabled?: boolean
          is_hidden?: boolean | null
          job_title?: string | null
          linkedin_url?: string | null
          name: string
          organisation?: string | null
          plan_expires_at?: string | null
          plan_id?: string | null
          preferred_meeting_times?: Json | null
          real_email?: string | null
          registration_status?: string | null
          scheduling_url?: string | null
          tagline?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
          verification_status?: string | null
          verified_at?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          bluesky_url?: string | null
          calendar_sync_enabled?: boolean | null
          calendar_token?: string | null
          certifications?: Json | null
          constraints?: string | null
          constraints_private?: boolean
          created_at?: string | null
          desired_target_role?: string | null
          desired_target_role_private?: boolean
          education?: Json | null
          email?: string | null
          external_credential_profiles?: Json | null
          facebook_url?: string | null
          future_vision?: string | null
          future_vision_private?: boolean
          id?: string
          instagram_url?: string | null
          is_disabled?: boolean
          is_hidden?: boolean | null
          job_title?: string | null
          linkedin_url?: string | null
          name?: string
          organisation?: string | null
          plan_expires_at?: string | null
          plan_id?: string | null
          preferred_meeting_times?: Json | null
          real_email?: string | null
          registration_status?: string | null
          scheduling_url?: string | null
          tagline?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
          verification_status?: string | null
          verified_at?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      program_badge_credentials: {
        Row: {
          created_at: string
          credential_template_url: string | null
          id: string
          program_badge_id: string
          service_display_name: string | null
          service_name: string
        }
        Insert: {
          created_at?: string
          credential_template_url?: string | null
          id?: string
          program_badge_id: string
          service_display_name?: string | null
          service_name: string
        }
        Update: {
          created_at?: string
          credential_template_url?: string | null
          id?: string
          program_badge_id?: string
          service_display_name?: string | null
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_badge_credentials_program_badge_id_fkey"
            columns: ["program_badge_id"]
            isOneToOne: false
            referencedRelation: "program_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      program_badges: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          program_id: string
          renewal_period_months: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          program_id: string
          renewal_period_months?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          program_id?: string
          renewal_period_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_badges_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_coaches: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          program_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          program_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_coaches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_cohorts: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          lead_instructor_id: string | null
          name: string
          program_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          lead_instructor_id?: string | null
          name: string
          program_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          lead_instructor_id?: string | null
          name?: string
          program_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_cohorts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_entitlements: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          program_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          program_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          program_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_entitlements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_favorites: {
        Row: {
          created_at: string | null
          id: string
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_favorites_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_instructors: {
        Row: {
          created_at: string | null
          id: string
          instructor_id: string
          is_primary: boolean
          program_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instructor_id: string
          is_primary?: boolean
          program_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instructor_id?: string
          is_primary?: boolean
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_instructors_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_interest_registrations: {
        Row: {
          completed_modules_elsewhere: Json | null
          created_at: string | null
          enrollment_timeframe: string
          id: string
          notes: string | null
          preferred_tier: string | null
          program_id: string
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          scheduled_date_id: string | null
          status: string
          suggested_discount_percent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_modules_elsewhere?: Json | null
          created_at?: string | null
          enrollment_timeframe: string
          id?: string
          notes?: string | null
          preferred_tier?: string | null
          program_id: string
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          scheduled_date_id?: string | null
          status?: string
          suggested_discount_percent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_modules_elsewhere?: Json | null
          created_at?: string | null
          enrollment_timeframe?: string
          id?: string
          notes?: string | null
          preferred_tier?: string | null
          program_id?: string
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          scheduled_date_id?: string | null
          status?: string
          suggested_discount_percent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_interest_registrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_module_versions: {
        Row: {
          created_at: string | null
          id: string
          module_snapshot: Json
          order_index: number
          original_module_id: string | null
          version_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_snapshot: Json
          order_index: number
          original_module_id?: string | null
          version_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_snapshot?: Json
          order_index?: number
          original_module_id?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_module_versions_original_module_id_fkey"
            columns: ["original_module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_module_versions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "program_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_modules: {
        Row: {
          available_from_date: string | null
          calendly_event_url: string | null
          canonical_code: string | null
          capability_assessment_id: string | null
          capability_tags: string[] | null
          code: string | null
          content: string | null
          content_package_id: string | null
          content_package_path: string | null
          content_package_type: string | null
          created_at: string | null
          description: string | null
          domain: string | null
          estimated_minutes: number | null
          feature_key: string | null
          id: string
          is_active: boolean | null
          is_individualized: boolean
          learning_mode: Database["public"]["Enums"]["learning_mode"] | null
          links: Json | null
          min_plan_tier: number | null
          module_type: string
          order_index: number
          plan_id: string | null
          program_id: string
          tier_required: string | null
          title: string
          unlock_after_days: number | null
          updated_at: string | null
        }
        Insert: {
          available_from_date?: string | null
          calendly_event_url?: string | null
          canonical_code?: string | null
          capability_assessment_id?: string | null
          capability_tags?: string[] | null
          code?: string | null
          content?: string | null
          content_package_id?: string | null
          content_package_path?: string | null
          content_package_type?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          estimated_minutes?: number | null
          feature_key?: string | null
          id?: string
          is_active?: boolean | null
          is_individualized?: boolean
          learning_mode?: Database["public"]["Enums"]["learning_mode"] | null
          links?: Json | null
          min_plan_tier?: number | null
          module_type: string
          order_index: number
          plan_id?: string | null
          program_id: string
          tier_required?: string | null
          title: string
          unlock_after_days?: number | null
          updated_at?: string | null
        }
        Update: {
          available_from_date?: string | null
          calendly_event_url?: string | null
          canonical_code?: string | null
          capability_assessment_id?: string | null
          capability_tags?: string[] | null
          code?: string | null
          content?: string | null
          content_package_id?: string | null
          content_package_path?: string | null
          content_package_type?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          estimated_minutes?: number | null
          feature_key?: string | null
          id?: string
          is_active?: boolean | null
          is_individualized?: boolean
          learning_mode?: Database["public"]["Enums"]["learning_mode"] | null
          links?: Json | null
          min_plan_tier?: number | null
          module_type?: string
          order_index?: number
          plan_id?: string | null
          program_id?: string
          tier_required?: string | null
          title?: string
          unlock_after_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_modules_capability_assessment_id_fkey"
            columns: ["capability_assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_modules_content_package_id_fkey"
            columns: ["content_package_id"]
            isOneToOne: false
            referencedRelation: "content_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_modules_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "program_modules_module_type_fkey"
            columns: ["module_type"]
            isOneToOne: false
            referencedRelation: "module_types"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "program_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_id: string
          id: string
          limit_value: number | null
          program_plan_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_id: string
          id?: string
          limit_value?: number | null
          program_plan_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_id?: string
          id?: string
          limit_value?: number | null
          program_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_plan_features_program_plan_id_fkey"
            columns: ["program_plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      program_plans: {
        Row: {
          created_at: string
          credit_allowance: number | null
          description: string | null
          display_name: string | null
          id: string
          is_active: boolean
          name: string
          tier_level: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_allowance?: number | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          tier_level?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_allowance?: number | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tier_level?: number
          updated_at?: string
        }
        Relationships: []
      }
      program_skills: {
        Row: {
          created_at: string
          id: string
          program_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_skills_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      program_terms: {
        Row: {
          content_html: string
          created_at: string
          effective_from: string
          id: string
          is_blocking_on_first_access: boolean
          is_blocking_on_update: boolean
          is_current: boolean
          program_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content_html: string
          created_at?: string
          effective_from?: string
          id?: string
          is_blocking_on_first_access?: boolean
          is_blocking_on_update?: boolean
          is_current?: boolean
          program_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          content_html?: string
          created_at?: string
          effective_from?: string
          id?: string
          is_blocking_on_first_access?: boolean
          is_blocking_on_update?: boolean
          is_current?: boolean
          program_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_terms_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_tier_plans: {
        Row: {
          created_at: string
          credit_cost: number | null
          id: string
          program_id: string
          program_plan_id: string
          tier_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_cost?: number | null
          id?: string
          program_id: string
          program_plan_id: string
          tier_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_cost?: number | null
          id?: string
          program_id?: string
          program_plan_id?: string
          tier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_tier_plans_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_tier_plans_program_plan_id_fkey"
            columns: ["program_plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      program_versions: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          is_current: boolean | null
          program_id: string
          snapshot_data: Json
          version_name: string | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          is_current?: boolean | null
          program_id: string
          snapshot_data: Json
          version_name?: string | null
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          is_current?: boolean | null
          program_id?: string
          snapshot_data?: Json
          version_name?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_versions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_waitlist: {
        Row: {
          created_at: string | null
          id: string
          notified: boolean | null
          position: number
          program_id: string
          scheduled_date_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notified?: boolean | null
          position: number
          program_id: string
          scheduled_date_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notified?: boolean | null
          position?: number
          program_id?: string
          scheduled_date_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_waitlist_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          allow_repeat_enrollment: boolean
          capacity: number | null
          category: Database["public"]["Enums"]["program_category"]
          code: string | null
          created_at: string | null
          credit_cost: number | null
          default_program_plan_id: string | null
          description: string | null
          id: string
          installment_options: Json | null
          is_active: boolean | null
          logo_url: string | null
          min_plan_tier: number | null
          name: string
          plan_id: string | null
          requires_separate_purchase: boolean
          scheduled_dates: Json | null
          slug: string
          tiers: Json | null
          updated_at: string | null
          upfront_discount_percent: number | null
        }
        Insert: {
          allow_repeat_enrollment?: boolean
          capacity?: number | null
          category: Database["public"]["Enums"]["program_category"]
          code?: string | null
          created_at?: string | null
          credit_cost?: number | null
          default_program_plan_id?: string | null
          description?: string | null
          id?: string
          installment_options?: Json | null
          is_active?: boolean | null
          logo_url?: string | null
          min_plan_tier?: number | null
          name: string
          plan_id?: string | null
          requires_separate_purchase?: boolean
          scheduled_dates?: Json | null
          slug: string
          tiers?: Json | null
          updated_at?: string | null
          upfront_discount_percent?: number | null
        }
        Update: {
          allow_repeat_enrollment?: boolean
          capacity?: number | null
          category?: Database["public"]["Enums"]["program_category"]
          code?: string | null
          created_at?: string | null
          credit_cost?: number | null
          default_program_plan_id?: string | null
          description?: string | null
          id?: string
          installment_options?: Json | null
          is_active?: boolean | null
          logo_url?: string | null
          min_plan_tier?: number | null
          name?: string
          plan_id?: string | null
          requires_separate_purchase?: boolean
          scheduled_dates?: Json | null
          slug?: string
          tiers?: Json | null
          updated_at?: string | null
          upfront_discount_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_default_program_plan_id_fkey"
            columns: ["default_program_plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      psychometric_assessments: {
        Row: {
          category: string
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          feature_key: string | null
          id: string
          is_active: boolean | null
          name: string
          provider: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          category: string
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          provider?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          provider?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "psychometric_assessments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "assessment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      psychometric_result_schemas: {
        Row: {
          assessment_id: string
          created_at: string
          dimensions: Json
          id: string
          updated_at: string
          version: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          dimensions?: Json
          id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          dimensions?: Json
          id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "psychometric_result_schemas_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "psychometric_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      psychometric_results: {
        Row: {
          assessed_at: string | null
          assessment_id: string
          created_at: string
          entered_by: string
          id: string
          notes: string | null
          schema_id: string
          scores: Json
          source_description: string | null
          updated_at: string
          user_assessment_id: string | null
          user_id: string
        }
        Insert: {
          assessed_at?: string | null
          assessment_id: string
          created_at?: string
          entered_by: string
          id?: string
          notes?: string | null
          schema_id: string
          scores?: Json
          source_description?: string | null
          updated_at?: string
          user_assessment_id?: string | null
          user_id: string
        }
        Update: {
          assessed_at?: string | null
          assessment_id?: string
          created_at?: string
          entered_by?: string
          id?: string
          notes?: string | null
          schema_id?: string
          scores?: Json
          source_description?: string | null
          updated_at?: string
          user_assessment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psychometric_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "psychometric_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psychometric_results_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "psychometric_result_schemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psychometric_results_user_assessment_id_fkey"
            columns: ["user_assessment_id"]
            isOneToOne: false
            referencedRelation: "user_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profile_interests: {
        Row: {
          created_at: string
          id: string
          interest_type: string
          item_value: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_type: string
          item_value: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_type?: string
          item_value?: string
          user_id?: string
        }
        Relationships: []
      }
      public_profile_settings: {
        Row: {
          created_at: string
          custom_slug: string | null
          id: string
          is_public: boolean
          show_avatar: boolean
          show_bio: boolean
          show_certifications: boolean
          show_education: boolean
          show_job_title: boolean
          show_name: boolean
          show_organisation: boolean
          show_social_links: boolean
          show_tagline: boolean
          show_target_role: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_slug?: string | null
          id?: string
          is_public?: boolean
          show_avatar?: boolean
          show_bio?: boolean
          show_certifications?: boolean
          show_education?: boolean
          show_job_title?: boolean
          show_name?: boolean
          show_organisation?: boolean
          show_social_links?: boolean
          show_tagline?: boolean
          show_target_role?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_slug?: string | null
          id?: string
          is_public?: boolean
          show_avatar?: boolean
          show_bio?: boolean
          show_certifications?: boolean
          show_education?: boolean
          show_job_title?: boolean
          show_name?: boolean
          show_organisation?: boolean
          show_social_links?: boolean
          show_tagline?: boolean
          show_target_role?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_collection_links: {
        Row: {
          collection_id: string
          created_at: string | null
          id: string
          notes: string | null
          order_index: number | null
          question_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          question_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_collection_links_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "resource_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_collection_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_module_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          notes: string | null
          order_index: number | null
          question_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          notes?: string | null
          order_index?: number | null
          question_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          notes?: string | null
          order_index?: number | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_module_links_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_module_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_program_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_index: number | null
          program_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          program_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          program_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_program_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_program_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_resource_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_index: number | null
          question_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          question_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_index?: number | null
          question_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_resource_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "capability_domain_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_resource_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_resource_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_collection_items: {
        Row: {
          collection_id: string
          created_at: string | null
          id: string
          order_index: number | null
          resource_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          id?: string
          order_index?: number | null
          resource_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          id?: string
          order_index?: number | null
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "resource_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_collection_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_collection_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      resource_library: {
        Row: {
          canonical_id: string
          category_id: string | null
          created_at: string
          created_by: string
          credit_cost: number | null
          description: string | null
          downloadable: boolean
          feature_key: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_active: boolean
          is_consumable: boolean | null
          metadata: Json | null
          mime_type: string | null
          min_plan_tier: number | null
          plan_id: string | null
          resource_type: string
          title: string
          updated_at: string
          url: string | null
          visibility: string | null
        }
        Insert: {
          canonical_id: string
          category_id?: string | null
          created_at?: string
          created_by: string
          credit_cost?: number | null
          description?: string | null
          downloadable?: boolean
          feature_key?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          is_consumable?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          min_plan_tier?: number | null
          plan_id?: string | null
          resource_type?: string
          title: string
          updated_at?: string
          url?: string | null
          visibility?: string | null
        }
        Update: {
          canonical_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          credit_cost?: number | null
          description?: string | null
          downloadable?: boolean
          feature_key?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          is_consumable?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          min_plan_tier?: number | null
          plan_id?: string | null
          resource_type?: string
          title?: string
          updated_at?: string
          url?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_library_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_library_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_library_program_tiers: {
        Row: {
          created_at: string | null
          id: string
          min_tier_index: number | null
          program_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_tier_index?: number | null
          program_id: string
          resource_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          min_tier_index?: number | null
          program_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_library_program_tiers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_library_program_tiers_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_library_program_tiers_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_library_programs: {
        Row: {
          created_at: string
          id: string
          program_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_library_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_library_programs_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_library_programs_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_library_skills: {
        Row: {
          created_at: string
          id: string
          resource_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resource_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resource_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_library_skills_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_library_skills_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_library_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_usage_tracking: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          resource_id: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          resource_id: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          resource_id?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_usage_tracking_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_usage_tracking_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resource_library"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          attempt_number: number
          created_at: string
          enrollment_id: string | null
          evaluated_at: string | null
          evaluated_by: string | null
          id: string
          module_id: string | null
          overall_notes: string | null
          parent_assignment_id: string | null
          revision_notes: string | null
          status: string
          submitted_at: string | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          attempt_number?: number
          created_at?: string
          enrollment_id?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
          module_id?: string | null
          overall_notes?: string | null
          parent_assignment_id?: string | null
          revision_notes?: string | null
          status?: string
          submitted_at?: string | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          attempt_number?: number
          created_at?: string
          enrollment_id?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
          module_id?: string | null
          overall_notes?: string | null
          parent_assignment_id?: string | null
          revision_notes?: string | null
          status?: string
          submitted_at?: string | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_assignments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_assignments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_assignments_parent_assignment_id_fkey"
            columns: ["parent_assignment_id"]
            isOneToOne: false
            referencedRelation: "scenario_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scenario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      scenario_sections: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          order_index: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          order_index?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          order_index?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "scenario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_templates: {
        Row: {
          allows_resubmission: boolean
          capability_assessment_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_locked: boolean
          is_protected: boolean | null
          locked_at: string | null
          locked_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allows_resubmission?: boolean
          capability_assessment_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_locked?: boolean
          is_protected?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allows_resubmission?: boolean
          capability_assessment_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_locked?: boolean
          is_protected?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_templates_capability_assessment_id_fkey"
            columns: ["capability_assessment_id"]
            isOneToOne: false
            referencedRelation: "capability_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "scenario_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      section_paragraphs: {
        Row: {
          content: string
          created_at: string
          id: string
          order_index: number
          requires_response: boolean | null
          section_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_index?: number
          requires_response?: boolean | null
          section_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_index?: number
          requires_response?: boolean | null
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_paragraphs_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "scenario_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      session_group_links: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_group_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_group_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_module_links: {
        Row: {
          created_at: string | null
          enrollment_id: string | null
          id: string
          module_id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          module_id: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          module_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_module_links_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_module_links_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_module_links_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_module_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          attended_at: string | null
          confirmed_at: string | null
          created_at: string | null
          custom_role: string | null
          id: string
          notes: string | null
          registered_at: string | null
          role_id: string | null
          session_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attended_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          custom_role?: string | null
          id?: string
          notes?: string | null
          registered_at?: string | null
          role_id?: string | null
          session_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attended_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          custom_role?: string | null
          id?: string
          notes?: string | null
          registered_at?: string | null
          role_id?: string | null
          session_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "session_type_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_type_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_required: boolean | null
          max_per_session: number | null
          order_index: number | null
          role_name: string
          session_type_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          max_per_session?: number | null
          order_index?: number | null
          role_name: string
          session_type_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          max_per_session?: number | null
          order_index?: number | null
          role_name?: string
          session_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_type_roles_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
        ]
      }
      session_types: {
        Row: {
          allow_self_registration: boolean | null
          created_at: string | null
          default_duration_minutes: number | null
          description: string | null
          feature_key: string | null
          id: string
          is_active: boolean | null
          max_participants: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          allow_self_registration?: boolean | null
          created_at?: string | null
          default_duration_minutes?: number | null
          description?: string | null
          feature_key?: string | null
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          allow_self_registration?: boolean | null
          created_at?: string | null
          default_duration_minutes?: number | null
          description?: string | null
          feature_key?: string | null
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          allow_self_registration: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          max_participants: number | null
          meeting_url: string | null
          notes: string | null
          registration_deadline: string | null
          session_date: string | null
          session_type_id: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_self_registration?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          max_participants?: number | null
          meeting_url?: string | null
          notes?: string | null
          registration_deadline?: string | null
          session_date?: string | null
          session_type_id: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_self_registration?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          max_participants?: number | null
          meeting_url?: string | null
          notes?: string | null
          registration_deadline?: string | null
          session_date?: string | null
          session_type_id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_contexts: {
        Row: {
          applied_at: string | null
          auth_context_id: string | null
          context_slug: string
          context_type: string
          created_at: string | null
          id: string
          organization_id: string | null
          organization_joined: boolean | null
          program_enrolled: boolean | null
          program_id: string | null
          track_assigned: boolean | null
          track_id: string | null
          user_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          applied_at?: string | null
          auth_context_id?: string | null
          context_slug: string
          context_type: string
          created_at?: string | null
          id?: string
          organization_id?: string | null
          organization_joined?: boolean | null
          program_enrolled?: boolean | null
          program_id?: string | null
          track_assigned?: boolean | null
          track_id?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          applied_at?: string | null
          auth_context_id?: string | null
          context_slug?: string
          context_type?: string
          created_at?: string | null
          id?: string
          organization_id?: string | null
          organization_joined?: boolean | null
          program_enrolled?: boolean | null
          program_id?: string | null
          track_assigned?: boolean | null
          track_id?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signup_contexts_auth_context_id_fkey"
            columns: ["auth_context_id"]
            isOneToOne: false
            referencedRelation: "auth_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_contexts_auth_context_id_fkey"
            columns: ["auth_context_id"]
            isOneToOne: false
            referencedRelation: "auth_contexts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_contexts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_contexts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_contexts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_verification_requests: {
        Row: {
          context_data: Json | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          name: string
          plan_interest: string | null
          user_id: string
          verification_token: string
        }
        Insert: {
          context_data?: Json | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          ip_address?: string | null
          name: string
          plan_interest?: string | null
          user_id: string
          verification_token: string
        }
        Update: {
          context_data?: Json | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          name?: string
          plan_interest?: string | null
          user_id?: string
          verification_token?: string
        }
        Relationships: []
      }
      skill_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          company_name: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          relationship_type: string
          specializations: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          relationship_type?: string
          specializations?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          relationship_type?: string
          specializations?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      status_markers: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      talentlms_progress: {
        Row: {
          completed_at: string | null
          completion_status: string
          course_name: string | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          progress_percentage: number | null
          talentlms_course_id: string
          test_score: number | null
          time_spent_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_status: string
          course_name?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          progress_percentage?: number | null
          talentlms_course_id: string
          test_score?: number | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_status?: string
          course_name?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          progress_percentage?: number | null
          talentlms_course_id?: string
          test_score?: number | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      talentlms_users: {
        Row: {
          created_at: string | null
          id: string
          talentlms_user_id: string
          talentlms_username: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          talentlms_user_id: string
          talentlms_username: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          talentlms_user_id?: string
          talentlms_username?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string | null
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string | null
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_note_resources: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          note_id: string
          resource_type: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          note_id: string
          resource_type?: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          note_id?: string
          resource_type?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_note_resources_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "task_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          task_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sharing_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_value: boolean
          old_value: boolean
          task_id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_value: boolean
          old_value: boolean
          task_id: string
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_value?: boolean
          old_value?: boolean
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_sharing_audit_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string | null
          created_at: string | null
          decision_id: string | null
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          importance: boolean | null
          is_private: boolean
          option_id: string | null
          quadrant: Database["public"]["Enums"]["task_quadrant"] | null
          shared_with_coach: boolean
          source_type: Database["public"]["Enums"]["task_source_type"] | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string | null
          urgency: boolean | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          decision_id?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          importance?: boolean | null
          is_private?: boolean
          option_id?: string | null
          quadrant?: Database["public"]["Enums"]["task_quadrant"] | null
          shared_with_coach?: boolean
          source_type?: Database["public"]["Enums"]["task_source_type"] | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string | null
          urgency?: boolean | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          decision_id?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          importance?: boolean | null
          is_private?: boolean
          option_id?: string | null
          quadrant?: Database["public"]["Enums"]["task_quadrant"] | null
          shared_with_coach?: boolean
          source_type?: Database["public"]["Enums"]["task_source_type"] | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string | null
          urgency?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "decision_options"
            referencedColumns: ["id"]
          },
        ]
      }
      template_conditions: {
        Row: {
          created_at: string
          id: string
          operator: string
          question_id: string
          template_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          operator?: string
          question_id: string
          template_id: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          operator?: string
          question_id?: string
          template_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "template_conditions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "family_survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_conditions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "guided_path_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_upgrade_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          current_tier: string
          enrollment_id: string
          id: string
          reason: string | null
          requested_tier: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          current_tier: string
          enrollment_id: string
          id?: string
          reason?: string | null
          requested_tier: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          current_tier?: string
          enrollment_id?: string
          id?: string
          reason?: string | null
          requested_tier?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_upgrade_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier_upgrade_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      track_features: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          is_enabled: boolean
          limit_value: number | null
          track_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          track_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_features_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_ui_visibility: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          track_id: string
          ui_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          track_id: string
          ui_key: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          track_id?: string
          ui_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_ui_visibility_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          created_at: string
          description: string | null
          display_name: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          created_at: string | null
          feature_key: string
          id: string
          period_end: string
          period_start: string
          updated_at: string | null
          used_count: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature_key: string
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string | null
          used_count?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature_key?: string
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string | null
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_add_ons: {
        Row: {
          add_on_id: string
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          quantity_granted: number | null
          quantity_remaining: number | null
          quantity_used: number
          user_id: string
        }
        Insert: {
          add_on_id: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          quantity_granted?: number | null
          quantity_remaining?: number | null
          quantity_used?: number
          user_id: string
        }
        Update: {
          add_on_id?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          quantity_granted?: number | null
          quantity_remaining?: number | null
          quantity_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assessment_shares: {
        Row: {
          id: string
          notes: string | null
          shared_at: string
          shared_by_user_id: string
          shared_with_user_id: string
          user_assessment_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          shared_at?: string
          shared_by_user_id: string
          shared_with_user_id: string
          user_assessment_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          shared_at?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
          user_assessment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assessment_shares_user_assessment_id_fkey"
            columns: ["user_assessment_id"]
            isOneToOne: false
            referencedRelation: "user_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assessments: {
        Row: {
          assessment_id: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          notes: string | null
          title: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "psychometric_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credit_balances: {
        Row: {
          available_credits: number
          created_at: string | null
          id: string
          reserved_credits: number
          total_consumed: number
          total_received: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_credits?: number
          created_at?: string | null
          id?: string
          reserved_credits?: number
          total_consumed?: number
          total_received?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_credits?: number
          created_at?: string | null
          id?: string
          reserved_credits?: number
          total_consumed?: number
          total_received?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_credit_purchases: {
        Row: {
          amount_cents: number
          created_at: string | null
          credits_purchased: number
          currency: string
          expires_at: string | null
          id: string
          notes: string | null
          package_id: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          credits_purchased: number
          currency?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          credits_purchased?: number
          currency?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credit_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_topup_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credit_transactions: {
        Row: {
          action_reference_id: string | null
          action_type: string | null
          add_on_id: string | null
          amount: number
          balance_after: number
          batch_id: string | null
          created_at: string | null
          description: string | null
          enrollment_id: string | null
          id: string
          metadata: Json | null
          plan_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          action_reference_id?: string | null
          action_type?: string | null
          add_on_id?: string | null
          amount: number
          balance_after: number
          batch_id?: string | null
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          action_reference_id?: string | null
          action_type?: string | null
          add_on_id?: string | null
          amount?: number
          balance_after?: number
          batch_id?: string | null
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credit_transactions_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "user_add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credit_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "credit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credit_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_external_calendars: {
        Row: {
          color: string | null
          created_at: string
          ical_url: string
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          ical_url: string
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          ical_url?: string
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          created_at: string
          drives: string[] | null
          id: string
          interests: string[]
          is_private: boolean
          preferred_categories: string[]
          updated_at: string
          user_id: string
          values: string[] | null
        }
        Insert: {
          created_at?: string
          drives?: string[] | null
          id?: string
          interests?: string[]
          is_private?: boolean
          preferred_categories?: string[]
          updated_at?: string
          user_id: string
          values?: string[] | null
        }
        Update: {
          created_at?: string
          drives?: string[] | null
          id?: string
          interests?: string[]
          is_private?: boolean
          preferred_categories?: string[]
          updated_at?: string
          user_id?: string
          values?: string[] | null
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          in_app_enabled: boolean | null
          notification_type_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          notification_type_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          notification_type_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_notification_type_id_fkey"
            columns: ["notification_type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_oauth_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          id: string
          provider: string
          provider_email: string | null
          provider_user_id: string | null
          refresh_token_encrypted: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          id?: string
          provider: string
          provider_email?: string | null
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          id?: string
          provider?: string
          provider_email?: string | null
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_organization_terms_acceptance: {
        Row: {
          accepted_at: string
          content_hash: string
          id: string
          ip_address: unknown
          organization_terms_id: string
          retention_expires_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          content_hash: string
          id?: string
          ip_address?: unknown
          organization_terms_id: string
          retention_expires_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          content_hash?: string
          id?: string
          ip_address?: unknown
          organization_terms_id?: string
          retention_expires_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organization_terms_acceptance_organization_terms_id_fkey"
            columns: ["organization_terms_id"]
            isOneToOne: false
            referencedRelation: "organization_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_platform_terms_acceptance: {
        Row: {
          accepted_at: string
          content_hash: string
          id: string
          ip_address: string | null
          platform_terms_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          content_hash: string
          id?: string
          ip_address?: string | null
          platform_terms_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          content_hash?: string
          id?: string
          ip_address?: string | null
          platform_terms_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_platform_terms_acceptance_platform_terms_id_fkey"
            columns: ["platform_terms_id"]
            isOneToOne: false
            referencedRelation: "platform_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_entitlement_usage: {
        Row: {
          created_at: string
          enrollment_id: string
          feature_key: string
          id: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          feature_key: string
          id?: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          feature_key?: string
          id?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_entitlement_usage_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_entitlement_usage_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_terms_acceptance: {
        Row: {
          accepted_at: string
          content_hash: string
          id: string
          ip_address: string | null
          program_terms_id: string
          retention_expires_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          content_hash: string
          id?: string
          ip_address?: string | null
          program_terms_id: string
          retention_expires_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          content_hash?: string
          id?: string
          ip_address?: string | null
          program_terms_id?: string
          retention_expires_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_terms_acceptance_program_terms_id_fkey"
            columns: ["program_terms_id"]
            isOneToOne: false
            referencedRelation: "program_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_qualifications: {
        Row: {
          created_at: string | null
          id: string
          module_type_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_type_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_qualifications_module_type_id_fkey"
            columns: ["module_type_id"]
            isOneToOne: false
            referencedRelation: "module_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          acquired_at: string
          created_at: string
          id: string
          is_private: boolean
          is_public: boolean
          skill_id: string
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          created_at?: string
          id?: string
          is_private?: boolean
          is_public?: boolean
          skill_id: string
          source_id?: string | null
          source_type?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          created_at?: string
          id?: string
          is_private?: boolean
          is_public?: boolean
          skill_id?: string
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tracks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      wheel_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_legacy: boolean
          key: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_legacy?: boolean
          key: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_legacy?: boolean
          key?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      wheel_domain_reflections: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wheel_of_life_snapshots: {
        Row: {
          career_business: number | null
          contribution: number | null
          created_at: string
          family_friends: number | null
          finances: number | null
          fun_recreation: number | null
          health_fitness: number | null
          id: string
          notes: string | null
          personal_growth: number | null
          physical_environment: number | null
          relationships: number | null
          romance: number | null
          shared_with_coach: boolean
          snapshot_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          career_business?: number | null
          contribution?: number | null
          created_at?: string
          family_friends?: number | null
          finances?: number | null
          fun_recreation?: number | null
          health_fitness?: number | null
          id?: string
          notes?: string | null
          personal_growth?: number | null
          physical_environment?: number | null
          relationships?: number | null
          romance?: number | null
          shared_with_coach?: boolean
          snapshot_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          career_business?: number | null
          contribution?: number | null
          created_at?: string
          family_friends?: number | null
          finances?: number | null
          fun_recreation?: number | null
          health_fitness?: number | null
          id?: string
          notes?: string | null
          personal_growth?: number | null
          physical_environment?: number | null
          relationships?: number | null
          romance?: number | null
          shared_with_coach?: boolean
          snapshot_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      xapi_sessions: {
        Row: {
          auth_token: string
          bookmark: string | null
          completed_at: string | null
          created_at: string | null
          enrollment_id: string
          id: string
          initialized_at: string | null
          launched_at: string | null
          module_id: string
          status: string | null
          suspend_data: string | null
          terminated_at: string | null
          token_consumed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_token: string
          bookmark?: string | null
          completed_at?: string | null
          created_at?: string | null
          enrollment_id: string
          id?: string
          initialized_at?: string | null
          launched_at?: string | null
          module_id: string
          status?: string | null
          suspend_data?: string | null
          terminated_at?: string | null
          token_consumed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_token?: string
          bookmark?: string | null
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string
          id?: string
          initialized_at?: string | null
          launched_at?: string | null
          module_id?: string
          status?: string | null
          suspend_data?: string | null
          terminated_at?: string | null
          token_consumed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xapi_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xapi_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xapi_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      xapi_statements: {
        Row: {
          created_at: string | null
          id: string
          module_id: string
          object_id: string
          object_name: string | null
          raw_statement: Json
          result_completion: boolean | null
          result_duration: string | null
          result_score_raw: number | null
          result_score_scaled: number | null
          result_success: boolean | null
          session_id: string
          statement_id: string | null
          statement_timestamp: string | null
          user_id: string
          verb_display: string | null
          verb_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_id: string
          object_id: string
          object_name?: string | null
          raw_statement: Json
          result_completion?: boolean | null
          result_duration?: string | null
          result_score_raw?: number | null
          result_score_scaled?: number | null
          result_success?: boolean | null
          session_id: string
          statement_id?: string | null
          statement_timestamp?: string | null
          user_id: string
          verb_display?: string | null
          verb_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_id?: string
          object_id?: string
          object_name?: string | null
          raw_statement?: Json
          result_completion?: boolean | null
          result_duration?: string | null
          result_score_raw?: number | null
          result_score_scaled?: number | null
          result_success?: boolean | null
          session_id?: string
          statement_id?: string | null
          statement_timestamp?: string | null
          user_id?: string
          verb_display?: string | null
          verb_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xapi_statements_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xapi_statements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "xapi_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auth_contexts_public: {
        Row: {
          allow_slug_access: boolean | null
          auto_assign_track: boolean | null
          auto_enroll_program: boolean | null
          context_type: string | null
          default_to_signup: boolean | null
          description: string | null
          features: Json | null
          headline: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          organization_id: string | null
          primary_color: string | null
          program_id: string | null
          public_code: string | null
          slug: string | null
          subheadline: string | null
          track_id: string | null
        }
        Insert: {
          allow_slug_access?: boolean | null
          auto_assign_track?: boolean | null
          auto_enroll_program?: boolean | null
          context_type?: string | null
          default_to_signup?: boolean | null
          description?: string | null
          features?: Json | null
          headline?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          program_id?: string | null
          public_code?: string | null
          slug?: string | null
          subheadline?: string | null
          track_id?: string | null
        }
        Update: {
          allow_slug_access?: boolean | null
          auto_assign_track?: boolean | null
          auto_enroll_program?: boolean | null
          context_type?: string | null
          default_to_signup?: boolean | null
          description?: string | null
          features?: Json | null
          headline?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          organization_id?: string | null
          primary_color?: string | null
          program_id?: string | null
          public_code?: string | null
          slug?: string | null
          subheadline?: string | null
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_contexts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_contexts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_contexts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_system_documentation: {
        Row: {
          architecture: Json | null
          description: string | null
          title: string | null
        }
        Relationships: []
      }
      email_change_requests_safe: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          new_email: string | null
          old_email: string | null
          status: string | null
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          new_email?: string | null
          old_email?: string | null
          status?: never
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          new_email?: string | null
          old_email?: string | null
          status?: never
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      module_sessions_safe: {
        Row: {
          booked_by: string | null
          calcom_booking_uid: string | null
          client_response: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          enrollment_id: string | null
          id: string | null
          instructor_id: string | null
          is_recurring: boolean | null
          location: string | null
          meeting_url: string | null
          module_id: string | null
          notes: string | null
          parent_session_id: string | null
          program_id: string | null
          recurrence_count: number | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          request_message: string | null
          requested_by: string | null
          session_date: string | null
          session_type: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          booked_by?: string | null
          calcom_booking_uid?: never
          client_response?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string | null
          instructor_id?: string | null
          is_recurring?: boolean | null
          location?: string | null
          meeting_url?: never
          module_id?: string | null
          notes?: never
          parent_session_id?: string | null
          program_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          request_message?: string | null
          requested_by?: string | null
          session_date?: string | null
          session_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          booked_by?: string | null
          calcom_booking_uid?: never
          client_response?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string | null
          instructor_id?: string | null
          is_recurring?: boolean | null
          location?: string | null
          meeting_url?: never
          module_id?: string | null
          notes?: never
          parent_session_id?: string | null
          program_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          request_message?: string | null
          requested_by?: string | null
          session_date?: string | null
          session_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "staff_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "program_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "module_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "module_sessions_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          bio: string | null
          bluesky_url: string | null
          certifications: Json | null
          constraints: string | null
          constraints_private: boolean | null
          created_at: string | null
          desired_target_role: string | null
          desired_target_role_private: boolean | null
          education: Json | null
          external_credential_profiles: Json | null
          facebook_url: string | null
          future_vision: string | null
          future_vision_private: boolean | null
          id: string | null
          instagram_url: string | null
          is_hidden: boolean | null
          job_title: string | null
          linkedin_url: string | null
          name: string | null
          organisation: string | null
          preferred_meeting_times: Json | null
          scheduling_url: string | null
          tagline: string | null
          timezone: string | null
          updated_at: string | null
          username: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          bluesky_url?: string | null
          certifications?: Json | null
          constraints?: string | null
          constraints_private?: boolean | null
          created_at?: string | null
          desired_target_role?: string | null
          desired_target_role_private?: boolean | null
          education?: Json | null
          external_credential_profiles?: Json | null
          facebook_url?: string | null
          future_vision?: string | null
          future_vision_private?: boolean | null
          id?: string | null
          instagram_url?: string | null
          is_hidden?: boolean | null
          job_title?: string | null
          linkedin_url?: string | null
          name?: string | null
          organisation?: string | null
          preferred_meeting_times?: Json | null
          scheduling_url?: string | null
          tagline?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          bluesky_url?: string | null
          certifications?: Json | null
          constraints?: string | null
          constraints_private?: boolean | null
          created_at?: string | null
          desired_target_role?: string | null
          desired_target_role_private?: boolean | null
          education?: Json | null
          external_credential_profiles?: Json | null
          facebook_url?: string | null
          future_vision?: string | null
          future_vision_private?: boolean | null
          id?: string | null
          instagram_url?: string | null
          is_hidden?: boolean | null
          job_title?: string | null
          linkedin_url?: string | null
          name?: string | null
          organisation?: string | null
          preferred_meeting_times?: Json | null
          scheduling_url?: string | null
          tagline?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      public_external_courses_view: {
        Row: {
          certificate_name: string | null
          certificate_path: string | null
          id: string | null
          provider: string | null
          status: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          bluesky_url: string | null
          certifications: Json | null
          created_at: string | null
          custom_slug: string | null
          education: Json | null
          id: string | null
          is_public: boolean | null
          linkedin_url: string | null
          name: string | null
          preferred_meeting_times: Json | null
          timezone: string | null
          updated_at: string | null
          username: string | null
          x_url: string | null
        }
        Relationships: []
      }
      resource_credit_summary: {
        Row: {
          access_type: string | null
          canonical_id: string | null
          credit_cost: number | null
          id: string | null
          is_consumable: boolean | null
          resource_type: string | null
          title: string | null
        }
        Insert: {
          access_type?: never
          canonical_id?: string | null
          credit_cost?: number | null
          id?: string | null
          is_consumable?: boolean | null
          resource_type?: string | null
          title?: string | null
        }
        Update: {
          access_type?: never
          canonical_id?: string | null
          credit_cost?: number | null
          id?: string | null
          is_consumable?: boolean | null
          resource_type?: string | null
          title?: string | null
        }
        Relationships: []
      }
      staff_enrollments: {
        Row: {
          client_user_id: string | null
          cohort_id: string | null
          created_at: string | null
          end_date: string | null
          id: string | null
          is_public: boolean | null
          program_id: string | null
          program_plan_id: string | null
          program_version_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["enrollment_status"] | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          client_user_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          is_public?: boolean | null
          program_id?: string | null
          program_plan_id?: string | null
          program_version_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"] | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          client_user_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          is_public?: boolean | null
          program_id?: string | null
          program_plan_id?: string | null
          program_version_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"] | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "program_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_program_plan_id_fkey"
            columns: ["program_plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_enrollments_program_version_id_fkey"
            columns: ["program_version_id"]
            isOneToOne: false
            referencedRelation: "program_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_org_credits: {
        Args: {
          p_credit_amount: number
          p_description?: string
          p_organization_id: string
          p_performed_by?: string
          p_purchase_id?: string
        }
        Returns: Json
      }
      add_user_credits: {
        Args: {
          p_add_on_id?: string
          p_credit_amount: number
          p_description?: string
          p_plan_id?: string
          p_transaction_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_bulk_delete_notifications: {
        Args: { notification_ids: string[] }
        Returns: number
      }
      are_group_peers: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      calculate_plan_rollover: {
        Args: {
          p_current_used: number
          p_feature_key: string
          p_period_end: string
          p_period_start: string
          p_plan_limit: number
          p_user_id: string
        }
        Returns: number
      }
      can_access_resource: {
        Args: { _resource_id: string; _user_id: string }
        Returns: boolean
      }
      can_assign_sponsored_seat: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      can_manage_module_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_billing_info: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      can_view_profile_email: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      can_view_profile_field: {
        Args: { _field_name: string; _profile_user_id: string }
        Returns: boolean
      }
      check_alumni_access: {
        Args: { p_program_id: string; p_user_id: string }
        Returns: Json
      }
      check_assessment_file_share_access: {
        Args: { file_name: string }
        Returns: boolean
      }
      check_cohort_capacity: { Args: { p_cohort_id: string }; Returns: Json }
      check_program_capacity: { Args: { p_program_id: string }; Returns: Json }
      check_resource_access: {
        Args: { p_org_id?: string; p_resource_id: string; p_user_id: string }
        Returns: Json
      }
      check_scenario_certification_requirements: {
        Args: { p_enrollment_id: string }
        Returns: {
          all_requirements_met: boolean
          completed_count: number
          missing_scenarios: Json
          total_required: number
        }[]
      }
      cleanup_old_announcements: {
        Args: { days_old?: number }
        Returns: number
      }
      cleanup_old_notifications: { Args: never; Returns: number }
      cleanup_old_webhook_logs: {
        Args: { retention_days?: number }
        Returns: number
      }
      client_can_view_staff_profile: {
        Args: { _client_id: string; _staff_id: string }
        Returns: boolean
      }
      consume_add_on: {
        Args: {
          p_action_reference_id?: string
          p_action_type?: string
          p_add_on_key: string
          p_notes?: string
          p_quantity?: number
          p_user_id: string
        }
        Returns: Json
      }
      consume_credit_service: {
        Args: {
          p_action_reference_id?: string
          p_notes?: string
          p_service_id: string
          p_user_id: string
        }
        Returns: Json
      }
      consume_credits_fifo: {
        Args: {
          p_action_reference_id?: string
          p_action_type?: string
          p_amount?: number
          p_description?: string
          p_feature_key?: string
          p_owner_id?: string
          p_owner_type?: string
        }
        Returns: Json
      }
      consume_enrollment_credits: {
        Args: {
          p_enrolled_by: string
          p_organization_id: string
          p_program_id: string
          p_user_ids: string[]
        }
        Returns: Json
      }
      consume_org_credits: {
        Args: {
          p_credit_amount: number
          p_description?: string
          p_enrollment_id?: string
          p_organization_id: string
          p_performed_by?: string
        }
        Returns: Json
      }
      consume_resource_credit: {
        Args: { p_org_id?: string; p_resource_id: string; p_user_id: string }
        Returns: Json
      }
      consume_unified_credits:
        | {
            Args: {
              p_action_reference_id?: string
              p_action_type?: string
              p_feature_key: string
              p_notes?: string
              p_quantity?: number
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_action_reference_id?: string
              p_action_type?: string
              p_feature_key: string
              p_notes?: string
              p_quantity?: number
              p_user_id: string
            }
            Returns: Json
          }
      consume_user_credits: {
        Args: {
          p_action_reference_id?: string
          p_action_type?: string
          p_credit_amount: number
          p_description?: string
          p_enrollment_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_link?: string
          p_message?: string
          p_metadata?: Json
          p_title: string
          p_type_key: string
          p_user_id: string
        }
        Returns: string
      }
      delete_analytics_events: {
        Args: { end_date: string; start_date: string }
        Returns: number
      }
      enroll_with_credits: {
        Args: {
          p_client_user_id: string
          p_cohort_id?: string
          p_description?: string
          p_discount_percent?: number
          p_enrollment_source?: string
          p_final_credit_cost?: number
          p_force?: boolean
          p_original_credit_cost?: number
          p_program_id: string
          p_program_plan_id?: string
          p_referral_note?: string
          p_referred_by?: string
          p_tier?: string
        }
        Returns: Json
      }
      enroll_with_user_credits: {
        Args: { p_program_id: string; p_user_id: string }
        Returns: Json
      }
      expire_credit_batches: { Args: never; Returns: number }
      generate_public_code: { Args: never; Returns: string }
      get_add_on_balance: {
        Args: { p_add_on_key: string; p_user_id: string }
        Returns: number
      }
      get_aggregated_analytics: {
        Args: { end_date: string; start_date: string }
        Returns: Json
      }
      get_available_credits: {
        Args: {
          p_feature_key?: string
          p_owner_id: string
          p_owner_type: string
        }
        Returns: {
          batches: Json
          earliest_expiry: string
          feature_available: number
          general_available: number
          total_available: number
        }[]
      }
      get_billing_period: {
        Args: { p_user_id: string }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      get_credit_service_by_feature: {
        Args: { p_feature_key: string; p_user_id: string }
        Returns: Json
      }
      get_credit_service_cost: {
        Args: { p_service_id: string; p_user_id: string }
        Returns: Json
      }
      get_current_usage: {
        Args: { _feature_key: string; _user_id: string }
        Returns: number
      }
      get_effective_track_features: {
        Args: { p_user_id: string }
        Returns: {
          feature_id: string
          feature_key: string
          feature_name: string
          is_enabled: boolean
          limit_value: number
          source_track_id: string
          source_track_name: string
        }[]
      }
      get_group_member_directory: {
        Args: { _group_id: string }
        Returns: {
          avatar_url: string
          email: string
          joined_at: string
          name: string
          preferred_meeting_times: Json
          role: Database["public"]["Enums"]["group_member_role"]
          scheduling_url: string
          timezone: string
          user_id: string
        }[]
      }
      get_org_credit_summary: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_org_credit_summary_v2: { Args: { p_org_id: string }; Returns: Json }
      get_org_max_sponsored_seats: {
        Args: { p_organization_id: string }
        Returns: number
      }
      get_org_sponsored_seat_count: {
        Args: { p_organization_id: string }
        Returns: number
      }
      get_program_id_from_module: {
        Args: { _module_id: string }
        Returns: string
      }
      get_track_ui_visibility: {
        Args: { p_user_id: string }
        Returns: {
          is_visible: boolean
          ui_key: string
        }[]
      }
      get_unified_credits: {
        Args: { p_feature_key: string; p_user_id: string }
        Returns: Json
      }
      get_user_credit_summary: { Args: { p_user_id: string }; Returns: Json }
      get_user_credit_summary_v2: { Args: { p_user_id: string }; Returns: Json }
      get_user_notification_preference: {
        Args: { p_notification_type_key: string; p_user_id: string }
        Returns: {
          email_enabled: boolean
          in_app_enabled: boolean
          is_critical: boolean
        }[]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      grant_credit_batch: {
        Args: {
          p_amount: number
          p_description?: string
          p_expires_at: string
          p_feature_key?: string
          p_owner_id: string
          p_owner_type: string
          p_source_reference_id?: string
          p_source_type: string
        }
        Returns: string
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_program_plan_access: {
        Args: { p_program_id: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shared_access_to_ac_result: {
        Args: { _result_id: string; _user_id: string }
        Returns: boolean
      }
      has_shared_access_to_user_assessment: {
        Args: { _assessment_id: string; _user_id: string }
        Returns: boolean
      }
      increment_resource_usage: {
        Args: { p_resource_id: string; p_user_id: string }
        Returns: Json
      }
      increment_usage: {
        Args: { _feature_key: string; _user_id: string }
        Returns: number
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin_or_manager: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_instructor_or_coach: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      is_same_organization: {
        Args: { _user_id_1: string; _user_id_2: string }
        Returns: boolean
      }
      is_session_instructor_or_coach: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      is_session_participant: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      join_cohort_waitlist: { Args: { p_cohort_id: string }; Returns: Json }
      module_type_has_session_capability: {
        Args: { _module_type: string }
        Returns: boolean
      }
      notify_cohort_session_recap: {
        Args: { p_session_id: string }
        Returns: number
      }
      owns_ac_assessment_result: {
        Args: { _result_id: string; _user_id: string }
        Returns: boolean
      }
      owns_user_assessment: {
        Args: { _assessment_id: string; _user_id: string }
        Returns: boolean
      }
      process_credit_rollover: {
        Args: {
          p_max_rollover_months?: number
          p_owner_id: string
          p_owner_type: string
        }
        Returns: Json
      }
      process_monthly_credit_rollovers: { Args: never; Returns: Json }
      process_monthly_rollover: { Args: never; Returns: undefined }
      purge_expired_terms_acceptances: { Args: never; Returns: number }
      send_cohort_session_reminders: { Args: never; Returns: Json }
      staff_has_client_relationship: {
        Args: { _client_user_id: string; _staff_id: string }
        Returns: boolean
      }
      update_installment_payment_status: {
        Args: {
          p_installment_amount_cents?: number
          p_new_status: string
          p_next_payment_date?: string
          p_stripe_subscription_id: string
        }
        Returns: Json
      }
      update_plan_rollover: {
        Args: {
          p_feature_key: string
          p_plan_limit: number
          p_unused_credits: number
          p_user_id: string
        }
        Returns: undefined
      }
      user_can_access_paragraph: {
        Args: { p_section_id: string }
        Returns: boolean
      }
      user_has_feature: {
        Args: { _feature_key: string; _user_id: string }
        Returns: boolean
      }
      user_is_enrolled_in_program: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      validate_discount_code: {
        Args: {
          p_code: string
          p_program_id: string
          p_tier_name: string
          p_user_id: string
        }
        Returns: {
          discount_code_id: string
          discount_type: string
          discount_value: number
          error_message: string
          is_valid: boolean
        }[]
      }
      validate_enrollment_code: { Args: { p_code: string }; Returns: Json }
      validate_partner_code: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "coach" | "client" | "instructor"
      decision_status: "upcoming" | "in_progress" | "made" | "cancelled"
      enrollment_status: "active" | "completed" | "paused"
      goal_category:
        | "family_home"
        | "financial_career"
        | "mental_educational"
        | "spiritual_ethical"
        | "social_cultural"
        | "physical_health"
        | "health_fitness"
        | "career_business"
        | "finances"
        | "relationships"
        | "personal_growth"
        | "fun_recreation"
        | "physical_environment"
        | "family_friends"
        | "romance"
        | "contribution"
      goal_priority: "low" | "medium" | "high"
      goal_status: "not_started" | "in_progress" | "completed" | "paused"
      goal_timeframe: "short" | "medium" | "long"
      group_join_type: "invitation_only" | "open"
      group_member_role: "member" | "leader"
      group_membership_status: "active" | "pending" | "left"
      group_status: "draft" | "active" | "completed" | "archived"
      importance_level: "low" | "medium" | "high" | "critical"
      learning_mode:
        | "group_independent"
        | "group_supervised"
        | "individual"
        | "asynchronous"
      milestone_status: "not_started" | "in_progress" | "completed"
      module_type:
        | "session"
        | "assignment"
        | "reflection"
        | "resource"
        | "content"
        | "coaching"
      org_role: "org_admin" | "org_manager" | "org_member"
      program_category: "cta" | "leadership" | "executive" | "ai" | "deep-dive"
      progress_status: "not_started" | "in_progress" | "completed"
      task_quadrant:
        | "important_urgent"
        | "important_not_urgent"
        | "not_important_urgent"
        | "not_important_not_urgent"
      task_source_type: "decision" | "goal" | "program" | "manual"
      task_status: "todo" | "in_progress" | "done" | "blocked"
      urgency_level: "low" | "medium" | "high"
      user_status: "active" | "inactive"
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
      app_role: ["admin", "coach", "client", "instructor"],
      decision_status: ["upcoming", "in_progress", "made", "cancelled"],
      enrollment_status: ["active", "completed", "paused"],
      goal_category: [
        "family_home",
        "financial_career",
        "mental_educational",
        "spiritual_ethical",
        "social_cultural",
        "physical_health",
        "health_fitness",
        "career_business",
        "finances",
        "relationships",
        "personal_growth",
        "fun_recreation",
        "physical_environment",
        "family_friends",
        "romance",
        "contribution",
      ],
      goal_priority: ["low", "medium", "high"],
      goal_status: ["not_started", "in_progress", "completed", "paused"],
      goal_timeframe: ["short", "medium", "long"],
      group_join_type: ["invitation_only", "open"],
      group_member_role: ["member", "leader"],
      group_membership_status: ["active", "pending", "left"],
      group_status: ["draft", "active", "completed", "archived"],
      importance_level: ["low", "medium", "high", "critical"],
      learning_mode: [
        "group_independent",
        "group_supervised",
        "individual",
        "asynchronous",
      ],
      milestone_status: ["not_started", "in_progress", "completed"],
      module_type: [
        "session",
        "assignment",
        "reflection",
        "resource",
        "content",
        "coaching",
      ],
      org_role: ["org_admin", "org_manager", "org_member"],
      program_category: ["cta", "leadership", "executive", "ai", "deep-dive"],
      progress_status: ["not_started", "in_progress", "completed"],
      task_quadrant: [
        "important_urgent",
        "important_not_urgent",
        "not_important_urgent",
        "not_important_not_urgent",
      ],
      task_source_type: ["decision", "goal", "program", "manual"],
      task_status: ["todo", "in_progress", "done", "blocked"],
      urgency_level: ["low", "medium", "high"],
      user_status: ["active", "inactive"],
    },
  },
} as const
