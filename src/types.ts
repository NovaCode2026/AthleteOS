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
  role?: "user" | "athlete" | "coach" | "academy_admin" | "support_admin" | "admin" | "super_admin";
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
  issued_at?: string;
  file_path?: string;
  expires_at?: string;
  notes?: string;
}

export interface FeedbackItem {
  id?: string;
  user_id?: string;
  title: string;
  details?: string;
  status?: string;
  priority?: string;
  visibility?: "public" | "private";
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
  user_has_voted?: boolean;
}

export interface RoadmapVote {
  id?: string;
  roadmap_item_id: string;
  user_id?: string;
}

export interface TournamentScan {
  id?: string;
  user_id?: string;
  source_url: string;
  tournament_name?: string;
  tournament_date?: string;
  venue?: string;
  registration_deadline?: string;
  weigh_in_information?: string;
  categories?: string;
  notices?: string;
  pdfs?: Array<{ href: string; label: string }>;
  schedules_results?: string;
  detected_changes?: string;
  status?: "pending" | "checked" | "blocked" | "failed";
  last_checked_at?: string;
  next_check_at?: string;
}

export interface UsageSummary {
  used: number;
  limit: number;
  plan: Plan;
}

export interface AiUsageEvent {
  id?: string;
  user_id?: string;
  plan_id?: PlanId;
  topic: string;
  tokens_used?: number;
  created_at?: string;
}

export interface Subscription {
  id?: string;
  user_id?: string;
  plan_id: PlanId;
  provider?: "manual" | "razorpay" | "stripe" | "cashfree";
  status: "active" | "trialing" | "past_due" | "canceled";
  current_period_end?: string;
}

export interface SubscriptionUsage {
  id?: string;
  user_id?: string;
  usage_month: string;
  ai_requests_used: number;
  ai_requests_limit: number;
  storage_mb_used?: number;
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
  roadmapVotes: RoadmapVote[];
  tournamentScans: TournamentScan[];
  aiUsage: AiUsageEvent[];
  subscriptions: Subscription[];
  subscriptionUsage: SubscriptionUsage[];
}
