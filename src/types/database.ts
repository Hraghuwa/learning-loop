export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type ProfileRow = {
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

type QuestionRow = {
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

type SessionRow = {
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

type CognitiveProfileRow = {
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

type InstituteClassRow = {
  id: string;
  institute_name: string;
  batch_name: string;
  teacher_id: string;
  join_code: string | null;
  created_at: string;
};

type ClassEnrollmentRow = {
  class_id: string;
  student_id: string;
};

type AnalysisCacheRow = {
  cache_key: string;
  response_json: Json;
  created_at: string;
};

type ImprovementTrackingRow = {
  id: string;
  error_type: string;
  subtopic: string;
  percentile_delta: number;
  created_at: string;
};

type ReviewQueueRow = {
  id: string;
  user_id: string;
  question_id: string;
  due_at: string;
  interval_days: number;
  ease: number;
  attempts: number;
  last_outcome: "correct" | "wrong" | "skipped" | null;
  created_at: string;
};

type SubtopicMasteryRow = {
  user_id: string;
  topic: string;
  subtopic: string;
  mastery: number;
  attempts: number;
  correct: number;
  updated_at: string;
};

type DailyUsageRow = {
  user_id: string;
  usage_date: string;
  analyses_count: number;
  hints_count: number;
};

type MockTestRow = {
  id: string;
  user_id: string;
  status: "in_progress" | "completed" | "abandoned";
  question_ids: string[];
  answers: Json;
  duration_seconds: number;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  created_at: string;
};

type CognitiveInsightRow = {
  id: string;
  user_id: string;
  payload: Json;
  generated_at: string;
  sessions_analyzed: number;
};

type StudyPlanRow = {
  id: string;
  user_id: string;
  payload: Json;
  target_percentile: number;
  weekly_hours: number;
  generated_at: string;
  active: boolean;
};

type TutorThreadRow = {
  id: string;
  user_id: string;
  session_id: string;
  question_id: string;
  messages: Json;
  created_at: string;
  updated_at: string;
};

type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
};

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow> & { Insert: Partial<ProfileRow> & { id: string } };
      questions: TableShape<QuestionRow>;
      sessions: TableShape<SessionRow>;
      cognitive_profiles: TableShape<CognitiveProfileRow>;
      institute_classes: TableShape<InstituteClassRow>;
      class_enrollments: TableShape<ClassEnrollmentRow>;
      analysis_cache: TableShape<AnalysisCacheRow>;
      improvement_tracking: TableShape<ImprovementTrackingRow>;
      review_queue: TableShape<ReviewQueueRow>;
      subtopic_mastery: TableShape<SubtopicMasteryRow>;
      daily_usage: TableShape<DailyUsageRow>;
      mock_tests: TableShape<MockTestRow>;
      cognitive_insights: TableShape<CognitiveInsightRow>;
      study_plans: TableShape<StudyPlanRow>;
      tutor_threads: TableShape<TutorThreadRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      increment_daily_analyses: {
        Args: { uid: string };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
