import { createClient } from "@supabase/supabase-js";

const allowedTopics = new Set([
  "Training Coach",
  "Tournament Preparation",
  "Match Analysis",
  "Nutrition Advice",
  "Recovery Advice",
  "Goal Suggestions",
  "Performance Reports",
  "Motivational Feedback"
]);

const planLimits = {
  free: 0,
  student: 50,
  pro: 100,
  champion: 500,
  academy: 2000
};

const MAX_PROMPT_LENGTH = 4000;
const MAX_TOPIC_LENGTH = 64;

function json(error, status) {
  return Response.json({ error }, { status });
}

function createUserSupabaseClient(accessToken) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function createBackendSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("SUPABASE_BACKEND_CONFIG_MISSING");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export default async function handler(request) {
  if (request.method !== "POST") return json("Method not allowed.", 405);

  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!allowedTopics.has(topic) || !prompt) {
    return json("Choose a topic and enter a prompt.", 400);
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return json(`Topic is too long. Maximum length is ${MAX_TOPIC_LENGTH} characters.`, 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json(`Prompt is too long. Maximum length is ${MAX_PROMPT_LENGTH} characters.`, 413);
  }

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return json("Please sign in again before using AI Coach.", 401);

  let supabase;
  let backendSupabase;
  try {
    supabase = createUserSupabaseClient(accessToken);
    backendSupabase = createBackendSupabaseClient();
  } catch (error) {
    if (error?.message === "SUPABASE_BACKEND_CONFIG_MISSING") {
      return json("AI Coach backend services are not configured.", 503);
    }
    return json("AthleteOS services are not configured for AI access.", 503);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) return json("Please sign in again before using AI Coach.", 401);

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, plan_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) return json("Unable to verify your AI entitlement.", 503);
  if (!profile) return json("Complete onboarding before using AI Coach.", 403);

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (subscriptionError) return json("Unable to verify your subscription.", 503);

  const planId = subscription?.plan_id || profile.plan_id || "free";
  const monthlyLimit = planLimits[planId] ?? 0;
  if (monthlyLimit <= 0) return json("AI Coach is not available on the Free plan.", 403);

  // Quota mutation runs with the backend secret only. Browser roles cannot call
  // the SECURITY DEFINER quota functions directly.
  const { data: reservationId, error: reservationError } = await backendSupabase.rpc("reserve_ai_usage", {
    p_user_id: userId,
    p_plan_id: planId,
    p_topic: topic,
    p_monthly_limit: monthlyLimit
  });
  if (reservationError) return json("Unable to reserve your monthly AI usage. Please try again.", 503);
  if (!reservationId) return json("Monthly AI limit reached for your current plan.", 429);

  const releaseReservation = async () => {
    await backendSupabase.rpc("cancel_ai_usage", { p_usage_id: reservationId });
  };

  if (!process.env.OPENAI_API_KEY) {
    await releaseReservation();
    return json("AI Coach is temporarily unavailable.", 503);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: "You are AthleteOS, a careful Taekwondo performance assistant. Give practical, age-safe, non-medical guidance. Encourage professional medical help for injuries." },
        { role: "user", content: `Topic: ${topic}\nAthlete request: ${prompt}` }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await releaseReservation();
    return json("AI Coach request failed. Please try again later.", 502);
  }

  const answer = payload.output_text
    || payload.output?.flatMap(item => item.content || []).map(item => item.text || "").join("")
    || "No response generated.";

  const { error: meterError } = await backendSupabase.rpc("complete_ai_usage", {
    p_usage_id: reservationId,
    p_tokens_used: payload.usage?.total_tokens ?? 0
  });

  if (meterError) {
    return json("AI usage could not be recorded. Please try again.", 503);
  }

  return Response.json({ answer });
}
