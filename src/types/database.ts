export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          target_exam: string;
          target_percentile: number;
          plan: "free" | "pro" | "institute";
          streak_count: number;
          xp: number;
          last_active_date: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      questions: {
        Row: {
          id: string;
          topic: string;
          subtopic: string;
          difficulty: string;
          question_text: string;
          options: string[];
          correct_index: number;
          hint: string | null;
          explanation: string | null;
          exam_type: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          selected_option: number;
          is_correct: boolean;
          reasoning_text: string;
          reasoning_input_method: "typed" | "voice";
          error_type: string | null;
          reasoning_score: number | null;
          ai_diagnosis: string | null;
          ai_correction: string | null;
          ai_pattern_alert: string | null;
          ai_next_topic: string | null;
          time_taken_seconds: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sessions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["sessions"]["Row"]>;
      };
      cognitive_profiles: {
        Row: {
          user_id: string;
          quant_score: number;
          varc_score: number;
          dilr_score: number;
          reasoning_score: number;
          speed_score: number;
          accuracy_score: number;
          percentile_estimate: number;
          total_sessions: number;
          top_error_pattern: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cognitive_profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["cognitive_profiles"]["Row"]>;
      };
      analysis_cache: {
        Row: {
          cache_key: string;
          response_json: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["analysis_cache"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["analysis_cache"]["Row"]>;
      };
      improvement_tracking: {
        Row: {
          id: string;
          error_type: string;
          subtopic: string;
          percentile_delta: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["improvement_tracking"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["improvement_tracking"]["Row"]>;
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      [_ in never]: never
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
}
