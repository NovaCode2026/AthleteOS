export type PlanId = "free" | "student" | "pro" | "champion" | "academy";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  aiLimit: number;
  audience: string;
  features: string[];
}

export interface Profile {
  id?: string;
  user_id?: string;
  full_name?: string;
  date_of_birth?: string;
  profile_image_path?: string;
  weight_kg?: number;
  height_cm?: number;
  belt?: string;
  academy?: string;
  coach?: string;
  emergency_contact?: string;
  achievements?: string;
  plan_id?: PlanId;
  verified_athlete?: boolean;
  founder_badge?: boolean;
  role?: "athlete" | "coach" | "academy_admin" | "support_admin" | "admin" | "super_admin";
}

export interface TrainingSession {
  id?: string;
  user_id?: string;
  title: string;
  session_date: string;
  minutes: number;
  intensity?: string;
  notes?: string;
}

export interface Tournament {
  id?: string;
  user_id?: string;
  name: string;
  starts_at?: string;
  location?: string;
  status?: string;
  result?: string;
  opponent_notes?: string;
  match_notes?: string;
}

export interface Medal {
  id?: string;
  user_id?: string;
  event_name: string;
  medal_type: string;
  category?: string;
  awarded_at?: string;
}

export interface WeightLog {
  id?: string;
  user_id?: string;
  logged_at: string;
  weight_kg: number;
  target_weight_kg?: number;
}

export interface Goal {
  id?: string;
  user_id?: string;
  title: string;
  target_date?: string;
  status?: string;
  progress?: number;
}

export interface ChecklistItem {
  id?: string;
  user_id?: string;
  item: string;
  category: string;
  completed?: boolean;
}

export interface DocumentRecord {
  id?: string;
  user_id?: string;
  title: string;
  document_type: string;
  expires_at?: string;
}

export interface FeedbackItem {
  id?: string;
  user_id?: string;
  title: string;
  details?: string;
  status?: string;
  priority?: string;
}

export interface VerificationRequest {
  id?: string;
  user_id?: string;
  document_type: string;
  file_path?: string;
  status?: "pending" | "approved" | "rejected";
  reviewer_notes?: string;
}

export interface RoadmapItem {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  votes?: number;
}

export interface UsageSummary {
  used: number;
  limit: number;
  plan: Plan;
}

export interface CloudData {
  profile: Profile;
  tournaments: Tournament[];
  training: TrainingSession[];
  medals: Medal[];
  weights: WeightLog[];
  goals: Goal[];
  checklist: ChecklistItem[];
  documents: DocumentRecord[];
  notifications: Array<{ id?: string; title: string; body?: string; read_at?: string }>;
  feedback: FeedbackItem[];
  verifications: VerificationRequest[];
  roadmap: RoadmapItem[];
}
